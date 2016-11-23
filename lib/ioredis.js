'use strict';

/*!
 * Module dependencies
 */
const debug = require('debug')('loopback:connector:ioredis');

const Redis = require('ioredis');
const Redlock = require('redlock');
const httpError = require('http-errors');
const Promise = require('bluebird');
const uuid = require('uuid');
const moment = require('moment');
const url = require('url');

const NoSQL = require('loopback-connector-nosql');
const Accessor = NoSQL.Accessor;

/**
 * The constructor for IORedis connector
 *
 * @param {Object} settings The settings object
 * @param {DataSource} dataSource The data source instance
 * @constructor
 * @see https://github.com/luin/ioredis/blob/master/API.md#new-redisport-host-options
 */
class IORedis extends NoSQL {

  /**
   * ID type.
   */
  getDefaultIdType(prop) {
    return String;
  }

  /**
   * Connect to IORedis
   */
  _connect(settings, database) {
    // Force lazyConnect here and do a explicit connect, as we always want to have it connected when
    // the app is started, and we want to wait for it.
    settings = Object.assign({}, settings || {}, {
      lazyConnect: true
    });
    // Copied from `loopback-connector-redis`.
    if (settings.url) {
      const redisUrl = url.parse(settings.url);
      const redisAuth = (redisUrl.auth || '').split(':');
      settings.host = redisUrl.hostname;
      settings.port = redisUrl.port;
      if (redisAuth.length > 1) {
        settings.db = redisAuth[0];
        settings.password = redisAuth.slice(1).join(':');
      }
    }
    // Override name with the sentinels master name.
    // @see https://github.com/luin/ioredis#sentinel
    if (settings.sentinels) {
      settings.name = settings.sentinelMasterName;
    }
    const redis = new Redis(settings);
    // Lock is used to handle potential race conditions.
    this._redlock = new Redlock([redis], { retryCount: 0 });
    // Resolve it to a newer Bluebird promise.
    return Promise.resolve(redis.connect()).return(redis);
  }

  /**
   * Disconnect from IORedis
   */
  _disconnect(redis) {
    return redis.disconnect();
  }

  /**
   * Lock resource by ID.
   */
  lockById(modelName, id, ttl) {
    const accessor = this.getAccessor(modelName);
    return accessor.lockById(id, ttl);
  }

}

/**
 * Implement Accessor.
 */
class IORedisAccessor extends Accessor {

  /**
   * Lock resource by ID.
   */
  lockById(id, ttl) {
    const resource = 'locks:' + this.modelName + ':' + id;
    return this.connector._redlock.disposer(resource, ttl || 1000, function unlockFailed(err) {
      debug('failed to unlock:', resource);
    });
  }

  /**
   * Save data to DB without a given id.
   *
   * Result is a promise with `[id, rev]` or an error.
   */
  postWithoutId(data, options) {
    // Generate ID.
    const id = uuid.v4();
    return this.postWithId(id, data, options);
  }

  /**
   * Save data to DB with a given id.
   *
   * Result is a promise with `[id, rev]` or an error.
   */
  postWithId(id, data, options) {
    const key = this.modelName + ':' + id;
    return this.exists(key).then((exists) => {
      // To satisfy the tests from `loopback-datasource-juggler`.
      if (exists) {
        return Promise.reject(httpError(409, 'Conflict: duplicate id'));
      }
      // Lock the key, and throw if it's already locked.
      return Promise.using(this.lockById(id), (lock) => {
        return this.connection.call('hmset', [key, data]).return([id, null]);
      }).catchReturn(Promise.reject(httpError(409)));
    });
  }

  /**
   * Save data to DB with a given id.
   *
   * Result is a promise with `[id, rev]` or an error.
   */
  putWithId(id, data, options) {
    const key = this.modelName + ':' + id;
    return this.connection.call('hmset', [key, data]).return([id, null]);
  }

  /**
   * Destroy data from DB by id.
   *
   * Result is a promise with whatever or an error.
   */
  destroyById(id, data, options) {
    const key = this.modelName + ':' + id;
    return this.connection.call('del', key, options);
  }

  /**
   * Find data from DB by id.
   *
   * Result is a promise with the data or an error.
   */
  findById(id, options) {
    const key = this.modelName + ':' + id;
    // `hgetall` cannot tell if it exists.
    return this.exists(key).then((exists) => {
      if (!exists) {
        return Promise.reject(httpError(404));
      }
      return this.connection.call('hgetall', key);
    });
  }

  /**
   * Find data from DB by multiple ids.
   *
   * Result is a promise with an array of 0 to many `[id, data]`.
   */
  findAll(options) {
    return this.connection.call('keys', this.modelName + ':*').map((key) => {
      const id = key.split(':')[1];
      return this.findById(id, options).then((data) => {
        return [id, data];
      }).catchReturn(false);
    }).filter(Boolean);
  }

  /**
   * Helper.
   */
  exists(key, options) {
    return this.connection.call('exists', key).then(Boolean);
  }

  /**
   * Convert data from model to DB format.
   */
  forDb(data) {
    for (let i in data) {
      if (data[i] == null) {
        data[i] = '';
        continue;
      }
      let prop = this.properties[i];
      if (prop == null) {
        data[i] = JSON.stringify(data[i]);
        continue;
      }
      switch (prop.type.name) {
        case 'Date':
          data[i] = moment(data[i]).toJSON();
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
  }

  /**
   * Convert data from DB format to model.
   */
  fromDb(data) {
    for (let i in data) {
      if (data[i] == null || data[i] === '') {
        data[i] = null;
        continue;
      }
      let prop = this.properties[i];
      if (prop == null) {
        continue;
      }
      switch (prop.type.name) {
        case 'Date':
          data[i] = moment(data[i]).toDate();
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
          let d = data[i];
          try {
            data[i] = JSON.parse(data[i]);
          } catch (e) {
            data[i] = d;
          }
      }
    }
    return data;
  }

}

// Export initializer.
exports.initialize = NoSQL.initializer('ioredis', IORedis, IORedisAccessor);

// Export classes.
exports.IORedis = IORedis;
exports.IORedisAccessor = IORedisAccessor;
