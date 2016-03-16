'use strict';

var should = require('should');
var Redis = require('ioredis');

var init = require('./init');

describe('Redis connector', function () {

  var db;
  var connector;

  it('can connect.', function (done) {
    init.getDataSource(null, function (err, res) {
      if (err) return done(err);
      res.should.be.Object();
      res.should.have.property('connected', true);
      res.should.have.property('connector').which.is.Object();
      db = res;
      connector = res.connector;
      done();
    });
  });

  it('can connect.', function (done) {
    connector.connect(function (err, res) {
      if (err) return done(err);
      res.should.be.instanceof(Redis);
      done();
    });
  });

  it('can disconnect.', function (done) {
    db.disconnect(done);
  });

  it('can disconnect.', function (done) {
    connector.disconnect(function (err, res) {
      if (err) return done(err);
      res.should.equal(true);
      done();
    });
  });

  it('can connect twice the same time.', function (done) {
    connector.connect();
    connector.connect(done);
  });

  it('can disconnect twice the same time.', function (done) {
    connector.disconnect();
    connector.disconnect(done);
  });

  it('can connect and disconnect.', function (done) {
    connector.connect();
    connector.disconnect(done);
  });

});
