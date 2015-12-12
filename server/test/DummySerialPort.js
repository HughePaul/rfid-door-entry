'use strict';

var mocha = require('mocha');

var chai = require('chai');
var should = chai.should();

var DummySerialPort = require('../lib/DummySerialPort');

describe('DummySerialPort', () => {

  describe('generateId', () => {
    var firstId;

    it('should return a number', () => {
      firstId = DummySerialPort.generateId()
      firstId.should.be.a('number');
    });

    it('should return a different number each time', () => {
      var secondId = DummySerialPort.generateId()
      secondId.should.not.equal(firstId);
    });
  });


  describe('cardToHex', () => {

    it('should return fail if no card given', () => {
      should.throw( () => {
        DummySerialPort.cardToHex();
      }, /No card id specified/);
      should.throw( () => {
        DummySerialPort.cardToHex({});
      }, /No card id specified/);
      should.throw( () => {
        DummySerialPort.cardToHex({id:1234});
      }, /No card id specified/);
    });

    it('should return valid hex card with no level', () => {
      var hex = DummySerialPort.cardToHex({id:'4-12345678901234'});
      hex.should.equal('1234567890123404');
    });


    it('should return valid hex card with level', () => {
      var hex = DummySerialPort.cardToHex({id:'4-12345678901234', level: 7});
      hex.should.equal('1234567890123474');
    });

  });


  describe('hexToCard', () => {

    it('should return fail if no card given', () => {
      should.throw( () => {
        DummySerialPort.hexToCard();
      }, /No card hex specified/);
      should.throw( () => {
        DummySerialPort.hexToCard(1234);
      }, /No card hex specified/);
    });

    it('should return valid card record', () => {
      var hex = DummySerialPort.hexToCard('1234567890123494');
      hex.should.deep.equal({id:'4-12345678901234', level: 9});
    });

  });

  describe('constuctor', () => {
    it('should complain if no options are given', () => {
      should.throw( () => {
        new DummySerialPort();
      }, /Options not specified/);
    });

    it('should complain if no parser function is given', () => {
      should.throw( () => {
        new DummySerialPort(null, {});
      }, /Parser function not specified/);
      should.throw( () => {
        new DummySerialPort(null, {parser: 1234});
      }, /Parser function not specified/);
      should.not.throw( () => {
        new DummySerialPort(null, {parser: () => 0});
      }, /Parser function not specified/);
    });

    it('should assign a name if one is not given', () => {
      var port = new DummySerialPort(null, {parser: () => 0});
      port.name.should.match(/^DummySerialPort\d+$/);
    });

    it('should eventually fire open event', (done) => {
      var port = new DummySerialPort(null, {parser: () => 0, replyDelay: 100});
      port.on('open', done);
    });

  });


});

