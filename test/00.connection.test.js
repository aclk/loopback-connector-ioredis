'use strict';

const should = require('should');
const Redis = require('ioredis');

const init = require('./init');

describe('Redis connector', function() {

  let db;
  let connector;

  it('can connect', function(done) {
    init.getDataSource(null, function(err, res) {
      if (err) {
        return done(err);
      }
      res.should.be.Object();
      res.should.have.property('connected', true);
      res.should.have.property('connector').which.is.Object();
      db = res;
      connector = res.connector;
      done();
    });
  });

  it('can connect', function(done) {
    connector.connect(function(err, res) {
      if (err) {
        return done(err);
      }
      res.should.be.instanceof(Redis);
      done();
    });
  });

  it('can disconnect', function(done) {
    db.disconnect(done);
  });

  it('can disconnect', function(done) {
    connector.disconnect(function(err, res) {
      if (err) {
        return done(err);
      }
      res.should.equal(true);
      done();
    });
  });

  it('can connect twice the same time', function(done) {
    connector.connect();
    connector.connect(done);
  });

  it('can disconnect twice the same time', function(done) {
    connector.disconnect();
    connector.disconnect(done);
  });

  it('can connect and disconnect', function(done) {
    connector.connect();
    connector.disconnect(done);
  });

  it('can connect with a host', function(done) {
    init.getDataSource({
      host: 'localhost'
    }).then(function(res) {
      res.should.be.Object();
      res.should.have.property('connected', true);
      res.should.have.property('connector').which.is.Object();
      res.disconnect(done);
    }).catch(done);
  });

  it('can connect with a port', function(done) {
    init.getDataSource({
      port: '6379'
    }).then(function(res) {
      res.should.be.Object();
      res.should.have.property('connected', true);
      res.should.have.property('connector').which.is.Object();
      res.disconnect(done);
    }).catch(done);
  });

  it('can connect with a host and a port', function(done) {
    init.getDataSource({
      host: 'localhost',
      port: '6379'
    }).then(function(res) {
      res.should.be.Object();
      res.should.have.property('connected', true);
      res.should.have.property('connector').which.is.Object();
      res.disconnect(done);
    }).catch(done);
  });

  it('cannot connect with a wrong port', function(done) {
    init.getDataSource({
      port: '1234'
    }).then(function(res) {
      done(new Error('expected an error'));
    }).catch(function(err) {
      err.should.be.instanceof(Error);
      done();
    });
  });

  it('can connect with a URL', function(done) {
    init.getDataSource({
      url: 'redis://localhost:6379'
    }).then(function(res) {
      res.should.be.Object();
      res.should.have.property('connected', true);
      res.should.have.property('connector').which.is.Object();
      res.disconnect(done);
    }).catch(done);
  });

});
