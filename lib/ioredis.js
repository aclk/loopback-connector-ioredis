'use strict';

/*!
 * Module dependencies
 */
require('es6-shim');
var debug = require('debug')('loopback:connector:ioredis');

var Redis = require('ioredis');
var util = require('util');
var Connector = require('loopback-connector').Connector;
var httpError = require('http-errors');
var Promise = require('bluebird');
var uuid = require('node-uuid');

/**
 * Initialize the ioredis connector for the given data source
 * @param {DataSource} dataSource The data source instance
 * @param {Function} [callback] The callback function
 */
exports.initialize = function initializeDataSource(dataSource, callback) {
  var settings = dataSource.settings;

  dataSource.connector = new IORedis(settings, dataSource);

  // Though not mentioned, `dataSource.setup()` assumes it's connected when `initialize()` is done.
  debug('Initialize and connect');
  dataSource.connector.connect(callback);
};

exports.IORedis = IORedis;

/**
 * The constructor for IORedis connector
 * @param {Object} settings The settings object
 * @param {DataSource} dataSource The data source instance
 * @constructor
 * @see https://github.com/luin/ioredis/blob/master/API.md#new-redisport-host-options
 */
function IORedis(settings, dataSource) {
  Connector.call(this, 'ioredis', settings);

  // Copied from `loopback-connector-redis`.
  if (settings.url) {
    var url = require('url');
    var redisUrl = url.parse(settings.url);
    var redisAuth = (redisUrl.auth || '').split(':');
    settings.host = redisUrl.hostname;
    settings.port = redisUrl.port;
    if (redisAuth.length > 1) {
      settings.db = redisAuth[0];
      settings.password = redisAuth.slice(1).join(':');
    }
  }

  debug('Settings: %j', settings);
  this.dataSource = dataSource;
  this.Redis = Redis;
}

util.inherits(IORedis, Connector);

/**
 * Connect to IORedis
 * @param {Function} [callback] The callback function
 * @callback callback
 * @param {Error} err The error object
 * @param {Object} redis The Redis instance
 */
IORedis.prototype.connect = function (callback) {
  if (this._redis == null) {
    // Force lazyConnect here and do a explicit connect, as we always want to have it connected when
    // the app is started, and we want to wait for it.
    var settings = Object.assign({}, this.settings, {
      lazyConnect: true
    });
    var redis = new this.Redis(settings);
    this._redis = redis.connect().return(redis);
  }
  // Callback is optional.
  return this._redis.asCallback(callback);
};

/**
 * Disconnect from IORedis
 */
IORedis.prototype.disconnect = function (callback) {
  if (this._redis == null) {
    // Callback is optional.
    return Promise.resolve(true).asCallback(callback);
  }
  // Disconnect.
  var promise = this._redis.call('disconnect').then(true);
  // Cleanup.
  this._redis = null;
  // Callback is optional.
  return promise.asCallback(callback);
};

/**
 * Hooks.
 */

/**
 * Implement `create()`. Create an instance of Model with given data and save to the attached data
 * source.
 * @see `DataAccessObject.create()`
 */
IORedis.prototype.create = function create(model, data, options, callback) {
  var self = this;
  var connection = this.connect();
  var id = this.getIdValue(model, data);
  if (id == null) {
    // Generate ID and set it back.
    var promise = connection.call('incr', 'id:' + model).then(function (id) {
      id = id.toString();
      self.setIdValue(model, data, id);
      return id;
    });
  } else {
    id = id.toString();
    // Throw if it exists in DB.
    var promise = this.exists(model, id).then(function (exists) {
      if (exists) {
        return Promise.reject(httpError(409));
      }
      return id;
    });
  }
  // Push the id to the list of user ids for sorting.
  // TODO: why?
  // promise = Promise.join(connection, promise, function (redis, id) {
  //   redis.sadd(['s:' + model, id]);
  //   return id;
  // });
  // Result need to be `id` and `rev`.
  return promise.then(function (id) {
    return self.save(model, data, options).return(id);
  }).asCallback(callback);
};

/**
 * Implement `save()`. Save instance.
 * @see `DataAccessObject.save()`
 */
IORedis.prototype.save = function save(model, data, options, callback) {
  var self = this;
  var connection = this.connect();
  var id = this.getIdValue(model, data);
  data = this.forDb(model, data);
  deleteNulls(data);
  // Result is not used.
  // TODO: Update index?
  return connection.call('hmset', [model + ':' + id, data]).then(function (res) {
    return self.fromDb(model, data);
  }).asCallback(callback);
};

/**
 * Implement `destroy()`. Delete object from persistence.
 * @see `DataAccessObject.remove()`
 */
IORedis.prototype.destroy = function destroy(model, id, options, callback) {};

/**
 * Implement `updateOrCreate()`. Update or insert a model instance.
 * @see `DataAccessObject.updateOrCreate()`
 */
IORedis.prototype.updateOrCreate = function upsert(model, data, options, callback) {
  var self = this;
  var connection = this.connect();
  var id = this.getIdValue(model, data);
  // Result need to be the updated data.
  if (id == null) {
    return this.create(model, data, options).then(function (id) {
      return connection.call('hgetall', model + ':' + id).then(function (res) {
        return self.fromDb(model, res);
      });
    }).asCallback(callback);
  }
  return this.save(model, data, options).then(function (obj) {
    return connection.call('get', 'id:' + model).then(function (id) {
      if (id == null) {
        return connection.call('set', ['id:' + model, id]).return(obj);
      }
      return obj;
    });
  }).asCallback(callback);
};

/**
 * @todo Implement `findOrCreate()`?
 */

/**
 * Implement `updateAttributes()`. Update set of attributes.
 * @see `DataAccessObject.updateAttributes()`
 * @todo Implement
 */
IORedis.prototype.updateAttributes = function updateAttributes(model, id, data, options, callback) {};

/**
 * Hooks that do bulk operations.
 */

/**
 * Implement `all()`. Find all instances of Model that match the specified query.
 * @see `DataAccessObject.find()`
 */
IORedis.prototype.all = function all(model, query, options, callback) {
  var self = this;
  var connection = this.connect();
  // TODO: ?
  if (query.where == null) {
    return Promise.reject(new Error('...'));
  };
  var id = this.getIdValue(model, query.where);
  // Result need to be an array.
  if (id != null) {
    var promise = this.exists(model, id).then(function (exists) {
      if (!exists) {
        return [];
      }
      return connection.call('hgetall', model + ':' + id).then(function (res) {
        return [self.fromDb(model, res)];
      });
    });
  } else {
    // TODO: Do query
    var promise = Promise.reject(new Error('...'));
  }
  // Callback is optional.
  return promise.asCallback(callback);
};

/**
 * Implement `update()`. Update multiple instances that match the where clause.
 * @see `DataAccessObject.update()`
 * @see https://apidocs.strongloop.com/loopback/#persistedmodel-updateall
 * @deprecated This API (`updateAll`) is super confusing and most likely useless.
 */
// IORedis.prototype.update = function update(model, where, data, options, callback) {};

/**
 * Implement `destroyAll()`. Destroy all matching records.
 * @see `DataAccessObject.remove()`
 */
IORedis.prototype.destroyAll = function destroyAll(model, where, options, callback) {};

/**
 * Implement `count()`. Return count of matched records.
 * @see `DataAccessObject.count()`
 * @todo Implement
 */
IORedis.prototype.count = function count(model, where, options, callback) {};

/**
 * Helpers.
 */

/**
 * .
 */
IORedis.prototype.exists = function (model, id, callback) {
  return this.connect().call('exists', model + ':' + id).then(Boolean).asCallback(callback);
};

/**
 * Copied from `loopback-connector-redis`.
 */
IORedis.prototype.forDb = function (model, data) {
  var p = this._models[model].properties;
  for (var i in data) {
    if (typeof data[i] === 'undefined') {
      delete data[i];
      continue;
    }
    if (!p[i]) {
      data[i] = JSON.stringify(data[i]);
      continue;
    }
    if (p[i].type.name != 'Boolean' && !(i in data && data[i] !== null)) {
      data[i] = '';
      continue;
    }
    switch (p[i].type.name) {
      case 'Date':
        if (data[i].getTime) {
          // just Date object
          data[i] = data[i].getTime().toString();
        } else if (typeof data[i] === 'number') {
          // number of milliseconds
          data[i] = parseInt(data[i], 10).toString();
        } else if (typeof data[i] === 'string' && !isNaN(parseInt(data[i]))) {
          // numeric string
          data[i] = data[i];
        } else {
          // something odd
          data[i] = '0';
        }
        break;
      case 'Number':
        data[i] = data[i] && data[i].toString();
        break;
      case 'Boolean':
        data[i] = data[i] ? 'true' : 'false';
        break;
      case 'String':
      case 'Text':
        break;
      default:
        data[i] = JSON.stringify(data[i]);
    }
  }
  return data;
};

/**
 * Copied from `loopback-connector-redis`.
 */
function isIncluded(fields, f) {
  if (!fields) {
    return true;
  }
  if (Array.isArray(fields)) {
    return fields.indexOf(f) >= 0;
  }
  if (fields[f]) {
    // Included
    return true;
  }
  if ((f in fields) && !fields[f]) {
    // Excluded
    return false;
  }
  for (var f1 in fields) {
    return !fields[f1]; // If the fields has exclusion
  }
  return true;
}

/**
 * Copied from `loopback-connector-redis`.
 */
IORedis.prototype.fromDb = function (model, data, fields) {
  fields = fields || {};
  var p = this._models[model].properties;
  var d;
  for (var i in data) {
    if (!isIncluded(fields, i)) {
      // Exclude
      delete data[i];
      continue;
    }
    if (!p[i]) continue;
    if (!data[i]) {
      data[i] = '';
      continue;
    }
    switch (p[i].type.name) {
      case 'Date':
        d = new Date(data[i]);
        d.setTime(data[i]);
        data[i] = d;
        break;
      case 'Number':
        data[i] = Number(data[i]);
        break;
      case 'Boolean':
        data[i] = data[i] === 'true' || data[i] === '1';
        break;
      case 'String':
      case 'Text':
        break;
      default:
        d = data[i];
        try {
          data[i] = JSON.parse(data[i]);
        } catch (e) {
          data[i] = d;
        }
    }
  }
  return data;
};

/**
 * Copied from `loopback-connector-redis`.
 */
function deleteNulls(data) {
  Object.keys(data).forEach(function (key) {
    if (data[key] === null) delete data[key];
  });
}
