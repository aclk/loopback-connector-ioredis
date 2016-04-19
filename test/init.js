'use strict';

var Promise = require('bluebird');
var DataSource = require('loopback-datasource-juggler').DataSource;

var config = {
  // // Connection
  // host: 'localhost',
  // port: 6379,
  // family: 4,
  // password: '',
  // db: 0,
  // connectTimeout: 3000,
  // retryStrategy: function (times) {
  //   return Math.min(times * 2, 2000);
  // },
  // keepAlive: 0,
  // connectionName: null,
  // // Sentinel
  // sentinels: null,
  // name: null,
  // role: 'master',
  // sentinelRetryStrategy: function (times) {
  //   return Math.min(times * 10, 1000);
  // },
  // // Status
  // password: null,
  // db: 0,
  // // Others
  // parser: 'auto',
  // enableOfflineQueue: true,
  // enableReadyCheck: true,
  // autoResubscribe: true,
  // autoResendUnfulfilledCommands: true,
  // lazyConnect: false,
  // keyPrefix: '',
  // reconnectOnError: null,
  // readOnly: false
};

exports.getDataSource = function(customConfig, callback) {
  var promise = new Promise(function(resolve, reject) {
    var db = new DataSource(require('../'), customConfig || config);

    db.log = function(a) {
      console.log(a);
    };
    db.on('connected', function() {
      resolve(db);
    });
    db.on('error', reject);
  });
  return promise.asCallback(callback);
};
