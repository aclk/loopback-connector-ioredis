'use strict';

var should = require('should');
var uuid = require('node-uuid');

var init = require('./init');

describe('IORedis CRUD', function () {

  var db;
  var connector;
  var Person;
  var persons;

  before(function (done) {
    return init.getDataSource(null, done).then(function (db) {
      connector = db.connector;

      Person = db.createModel('person', {
        id: {
          type: String,
          id: true
        },
        name: String,
        age: Number
      });

      persons = [{
        id: 0,
        name: 'Charlie',
        age: 24
      }, {
        id: 0,
        name: 'CharlieLi',
        age: 44
      }, {
        id: 1,
        name: 'Mary',
        age: 34
      }, {
        id: 2,
        name: 'David',
        age: 44
      }, {
        name: 'Jason',
        age: 44
      }];
    });
  });

  describe('Create', function () {
    after(function (done) {
      connector.connect().call('flushall').then(function () {
        done();
      }, done);
    });

    it('should create an instance', function (done) {
      Person.create(persons[0]).then(function (person) {
        person.id.should.equal('0');
        person.name.should.equal('Charlie');
        person.age.should.equal(24);
        done();
      }).catch(done);
    });

    it('should create an instance without id attribute', function (done) {
      Person.create(persons[4]).then(function (person) {
        person.id.should.be.String();
        person.name.should.equal('Jason');
        person.age.should.equal(44);
        done();
      }).catch(done);
    });

    // TODO: should not create with a duplicate id

  });

  describe('Update', function () {
    after(function (done) {
      connector.connect().call('flushall').then(function () {
        done();
      }, done);
    });

    it('should update(create) a new instance', function (done) {
      Person.updateOrCreate(persons[0]).then(function (person) {
        person.id.should.equal('0');
        person.name.should.equal('Charlie');
        person.age.should.equal(24);
        done();
      }).catch(done);
    });

    it('should update a existent instance', function (done) {
      Person.updateOrCreate(persons[1]).then(function (person) {
        person.id.should.equal('0');
        person.name.should.equal('CharlieLi');
        person.age.should.equal(44);
        done();
      }).catch(done);
    });

  });
});
