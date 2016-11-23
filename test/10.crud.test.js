'use strict';

var should = require('should');
var uuid = require('uuid');
var Promise = require('bluebird');

var init = require('./init');

describe('Redis CRUD', function() {

  var db;
  var connector;
  var Person;
  var persons;
  var Noise;
  var noises;

  before(function(done) {
    init.getDataSource(null, function(err, res) {
      if (err) {
        return done(err);
      }
      db = res;
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
        id: '0',
        name: 'Charlie',
        age: 24
      }, {
        id: '1',
        name: 'Mary',
        age: 24
      }, {
        id: '2',
        name: 'David',
        age: 24
      }, {
        name: 'Jason',
        age: 44
      }];
      Noise = db.createModel('noise', {
        id: {
          type: String,
          id: true
        },
        name: String,
        age: Number
      });
      noises = [{
        id: '0',
        name: 'Charlie',
        age: 99
      }];
      done();
    });
  });

  after(function(done) {
    connector.connect().call('flushall').then(function() {
      done();
    }, done);
  });

  describe('Create', function() {
    after(function(done) {
      connector.connect().call('flushall').then(function() {
        done();
      }).catch(done);
    });

    it('can create an instance with an id', function(done) {
      Person.create(persons[0]).then(function(person) {
        person.id.should.equal('0');
        person.name.should.equal('Charlie');
        done();
      }).catch(done);
    });

    it('can create an instance without an id', function(done) {
      Person.create(persons[3]).then(function(person) {
        person.id.should.be.String();
        person.name.should.equal('Jason');
        done();
      }).catch(done);
    });

    it('cannot create with a duplicate id ', function(done) {
      Person.create(persons[0]).then(function() {
        done(new Error('expected an error'));
      }, function(err) {
        should.exist(err);
        done();
      });
    });

    it('cannot create when there is a lock', function(done) {
      Promise.using(connector.lockById('person', persons[2].id), function(lock) {
        return Person.create(persons[2]).then(function() {
          throw new Error('expected an error');
        }, function(err) {
          should.exist(err);
        });
      }).asCallback(done);
    });

    it('can create now when it is unlocked', function(done) {
      Person.create(persons[2]).then(function(person) {
        person.id.should.equal('2');
        person.name.should.equal('David');
        done();
      }).catch(done);
    });

    // TODO: more errors
  });

  describe('Find by ID', function() {
    var id3;

    before(function(done) {
      Person.create(persons[0]).then(function() {
        done();
      }).catch(done);
    });

    before(function(done) {
      Person.create(persons[3]).then(function(person) {
        id3 = person.id;
        done();
      }).catch(done);
    });

    before(function(done) {
      Noise.create(noises[0]).then(function() {
        done();
      }).catch(done);
    });

    after(function(done) {
      connector.connect().call('flushall').then(function() {
        done();
      }).catch(done);
    });

    it('can find a saved instance', function(done) {
      Person.findById('0').then(function(person) {
        person.should.be.Object();
        person.id.should.equal('0');
        person.name.should.equal('Charlie');
        person.age.should.equal(24);
        done();
      }).catch(done);
    });

    it('can find a saved instance', function(done) {
      Person.find({
        where: {
          id: '0'
        }
      }).then(function(res) {
        res.should.be.Array().with.length(1);
        res[0].id.should.equal('0');
        res[0].name.should.equal('Charlie');
        res[0].age.should.equal(24);
        done();
      }).catch(done);
    });

    it('can find a saved instance', function(done) {
      Person.findById(id3).then(function(person) {
        person.should.be.Object();
        person.id.should.equal(id3);
        person.name.should.equal('Jason');
        person.age.should.equal(44);
        done();
      }).catch(done);
    });

    it('cannot find an unsaved instance', function(done) {
      Person.findById('1234').then(function(res) {
        should.not.exist(res);
        done();
      }).catch(done);
    });

    // TODO: more errors
  });

  describe('Destroy', function() {
    before(function(done) {
      Person.create(persons[0]).then(function() {
        done();
      }).catch(done);
    });

    after(function(done) {
      connector.connect().call('flushall').then(function() {
        done();
      }).catch(done);
    });

    it('can destroy a saved instance', function(done) {
      var person = Person(persons[0]);
      person.remove().then(function(res) {
        res.should.be.Object().with.property('count', 1);
        done();
      }).catch(done);
    });

    it('cannot destroy an unsaved instance', function(done) {
      var person = Person(persons[2]);
      person.remove().then(function(res) {
        res.should.be.Object().with.property('count', 0);
        done();
      }).catch(done);
    });

    // TODO: more errors
  });

  describe('Destroy by ID', function() {
    before(function(done) {
      Person.create(persons[0]).then(function() {
        done();
      }).catch(done);
    });

    after(function(done) {
      connector.connect().call('flushall').then(function() {
        done();
      }).catch(done);
    });

    it('can destroy a saved instance', function(done) {
      Person.destroyById('0').then(function(res) {
        res.should.be.Object().with.property('count', 1);
        done();
      }).catch(done);
    });

    it('cannot destroy an unsaved instance', function(done) {
      Person.destroyById('2').then(function(res) {
        res.should.be.Object().with.property('count', 0);
        done();
      }).catch(done);
    });

    it('cannot destroy without giving id', function(done) {
      Person.destroyById('').then().catch(function(err) {
        should.exist(err);
        done();
      });
    });

    // TODO: more errors
  });

  describe('Update or Create', function() {
    before(function(done) {
      Person.create(persons[0]).then(function() {
        done();
      }).catch(done);
    });

    after(function(done) {
      connector.connect().call('flushall').then(function() {
        done();
      }).catch(done);
    });

    it('can update an instance', function(done) {
      Person.updateOrCreate({
        id: '0',
        name: 'Charlie II',
        age: 24
      }).then(function(res) {
        res.should.be.Object();
        res.should.have.property('id', '0');
        res.should.have.property('name', 'Charlie II');
        res.should.have.property('age', 24);
        done();
      }).catch(done);
    });

    it('can create an instance', function(done) {
      Person.updateOrCreate(persons[1]).then(function(res) {
        res.should.be.Object();
        res.should.have.property('id', '1');
        res.should.have.property('name', 'Mary');
        res.should.have.property('age', 24);
        done();
      }).catch(done);
    });

    // TODO: more errors
  });

  describe('Save', function() {
    before(function(done) {
      Person.create(persons[0]).then(function() {
        done();
      }).catch(done);
    });

    after(function(done) {
      connector.connect().call('flushall').then(function() {
        done();
      }).catch(done);
    });

    it('can update an instance', function(done) {
      Person.findById('0').then(function(person) {
        person.name = 'Charlie II';
        person.save().then(function(res) {
          res.should.be.Object();
          res.should.have.property('id', '0');
          res.should.have.property('name', 'Charlie II');
          res.should.have.property('age', 24);
          done();
        });
      }).catch(done);
    });

    it('can create an instance', function(done) {
      var person = Person(persons[1]);
      person.save().then(function(res) {
        res.should.be.Object();
        res.should.have.property('id', '1');
        res.should.have.property('name', 'Mary');
        res.should.have.property('age', 24);
        done();
      }).catch(done);
    });

    // TODO: more errors
  });

  describe('Find multiple', function() {
    before(function(done) {
      Person.create(persons[0]).then(function() {
        done();
      }).catch(done);
    });

    before(function(done) {
      Person.create(persons[1]).then(function() {
        done();
      }).catch(done);
    });

    before(function(done) {
      Noise.create(noises[0]).then(function() {
        done();
      }).catch(done);
    });

    after(function(done) {
      connector.connect().call('flushall').then(function() {
        done();
      }).catch(done);
    });

    it('can find 2 instances by id', function(done) {
      Person.findByIds(['0', '1']).then(function(res) {
        res.should.be.Array().with.length(2);
        res[0].should.have.property('id', '0');
        res[0].should.have.property('name', 'Charlie');
        res[1].should.have.property('id', '1');
        res[1].should.have.property('name', 'Mary');
        done();
      }).catch(done);
    });

    it('cannot find wrong instances by id', function(done) {
      Person.findByIds(['0', 'lorem']).then(function(res) {
        res.should.be.Array().with.length(1);
        res[0].should.have.property('name', 'Charlie');
        done();
      }).catch(done);
    });

    it('can find empty when giving a empty array of ids', function(done) {
      Person.findByIds([]).then(function(res) {
        res.should.be.Array().with.length(0);
        done();
      }).catch(done);
    });

    it('can find 2 instances', function(done) {
      Person.find({
        where: {
          id: {
            inq: ['0', '1']
          }
        }
      }).then(function(res) {
        res.should.be.Array().with.length(2);
        res[0].should.have.property('id', '0');
        res[0].should.have.property('name', 'Charlie');
        res[1].should.have.property('id', '1');
        res[1].should.have.property('name', 'Mary');
        done();
      }).catch(done);
    });

    it('cannot find wrong instances', function(done) {
      Person.find({
        where: {
          id: {
            inq: ['0', 'lorem']
          }
        }
      }).then(function(res) {
        res.should.be.Array().with.length(1);
        res[0].should.have.property('name', 'Charlie');
        done();
      }).catch(done);
    });

    it('can find empty when giving empty id array in inq', function(done) {
      Person.find({
        where: {
          id: {
            inq: []
          }
        }
      }).then(function(res) {
        res.should.be.Array().with.length(0);
        done();
      }).catch(done);
    });

    it('can find empty when giving empty id object', function(done) {
      Person.find({
        where: {
          id: {}
        }
      }).then(function(res) {
        res.should.be.Array().with.length(0);
        done();
      }).catch(done);
    });

    it('can find all instances with empty where', function(done) {
      Person.find({
        where: {}
      }).then(function(res) {
        res.should.be.Array().with.length(2);
        done();
      }).catch(done);
    });

    it('can find all instances with empty query', function(done) {
      Person.find({}).then(function(res) {
        res.should.be.Array().with.length(2);
        done();
      }).catch(done);
    });

    it('can find all instances with no arguments', function(done) {
      Person.find().then(function(res) {
        res.should.be.Array().with.length(2);
        done();
      }).catch(done);
    });

    // TODO: more errors
  });

  describe('Destroy multiple', function() {
    describe('Destroy multiple instances', function() {
      before(function(done) {
        Person.create(persons[0]).then(function() {
          done();
        }).catch(done);
      });

      before(function(done) {
        Person.create(persons[1]).then(function() {
          done();
        }).catch(done);
      });

      before(function(done) {
        Person.create(persons[2]).then(function() {
          done();
        }).catch(done);
      });

      after(function(done) {
        connector.connect().call('flushall').then(function() {
          done();
        }).catch(done);
      });

      it('can remove 2 instances', function(done) {
        Person.remove({
          id: {
            inq: ['0', '1']
          }
        }).then(function(res) {
          res.should.deepEqual({
            count: 2
          });
          done();
        }).catch(done);
      });

      it('cannot remove them again', function(done) {
        Person.remove({
          id: {
            inq: ['0', '1']
          }
        }).then(function(res) {
          res.should.deepEqual({
            count: 0
          });
          done();
        }).catch(done);
      });

      it('can remove a saved instance while cannot remove unsaved one', function(done) {
        Person.remove({
          id: {
            inq: ['0', '2']
          }
        }).then(function(res) {
          res.should.deepEqual({
            count: 1
          });
          done();
        }).catch(done);
      });
    });

    describe('Destroy all instances', function() {
      before(function(done) {
        Person.create(persons[0]).then(function() {
          done();
        }).catch(done);
      });

      before(function(done) {
        Person.create(persons[1]).then(function() {
          done();
        }).catch(done);
      });

      before(function(done) {
        Person.create(persons[2]).then(function() {
          done();
        }).catch(done);
      });

      after(function(done) {
        connector.connect().call('flushall').then(function() {
          done();
        }).catch(done);
      });

      it('can remove all instances of one model', function(done) {
        Person.remove().then(function(res) {
          res.should.deepEqual({
            count: 3
          });
          done();
        }).catch(done);
      });

      it('cannot remove all instances of one model again', function(done) {
        Person.remove().then(function(res) {
          res.should.deepEqual({
            count: 0
          });
          done();
        }).catch(done);
      });
    });
  });

});
