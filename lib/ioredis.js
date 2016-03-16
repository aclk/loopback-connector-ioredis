'use strict';

/*!
 * Module dependencies
 */
require('es6-shim');
var debug = require('debug')('loopback:connector:ioredis');

var Redis = require('ioredis');
var util = require('util');
var Connector = require('loopback-connector').Connector;
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
 */
function IORedis(settings, dataSource) {
  Connector.call(this, 'ioredis', settings);

  // TODO: default settings.

  debug('Settings: %j', settings);

  this.dataSource = dataSource;

  this.Redis = Redis;
}

util.inherits(IORedis, Connector);

/**
 * Connect to IORedis
 * @param {Function} [callback] The callback function
 *
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
 * Implement `create()`. Create an instance of Model with given data and save to
 * the attached data source.
 * @see `DataAccessObject.create()`
 */
IORedis.prototype.create = function create(model, data, options, callback) {};

/**
 * Implement `save()`. Save instance.
 * @see `DataAccessObject.save()`
 */
IORedis.prototype.save = function save(model, data, options, callback) {};

/**
 * Implement `destroy()`. Delete object from persistence.
 * @see `DataAccessObject.remove()`
 */
IORedis.prototype.destroy = function destroy(model, id, options, callback) {};

/**
 * Implement `updateOrCreate()`. Update or insert a model instance.
 * @see `DataAccessObject.updateOrCreate()`
 */
IORedis.prototype.updateOrCreate = function upsert(model, data, options, callback) {};

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
 * Implement `all()`. Find all instances of Model that match the specified
 * query.
 * @see `DataAccessObject.find()`
 */
IORedis.prototype.all = function all(model, query, options, callback) {};

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
