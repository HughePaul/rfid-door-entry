'use strict';

require('mocha');
var chai = require('chai');
chai.should();
var mockery = require('mockery');
var sinon = require('sinon');

describe('Push', function() {

  var sandbox;
  var Push;
  var gcmStub;

  var pushConfig = {
    push: {
      key: 'test'
    }
  };

  beforeEach(function() {

    // create a sandbox
    sandbox = sinon.sandbox.create();

    gcmStub = {
      Sender: sandbox.stub(),
      Message: sandbox.stub()
        .returns({
          gcmMessage: true
        })
    };

    gcmStub.Sender.prototype.sendNoRetry = sandbox.stub();

    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true
    });
    mockery.registerMock('node-gcm', gcmStub);

    Push = require('../lib/Push');
  });

  afterEach(function() {
    sandbox.restore();
    mockery.disable();
  });

  describe('constructor', function() {

    it('should create a push instance', function() {
      var p = new Push(pushConfig);
      p.should.be.ok;
    });

    it('send should create message and send to tokens', function() {
      var p = new Push(pushConfig);
      p.send({
        payload: 'value'
      }, ['token1']);
      sinon.assert.calledOnce(gcmStub.Message);
      sinon.assert.calledWith(gcmStub.Message, {
        collapseKey: sinon.match.string,
        data: {
          payload: "value"
        },
        delayWhileIdle: false,
        timeToLive: 86400
      });
      sinon.assert.calledOnce(gcmStub.Sender.prototype.sendNoRetry);
      sinon.assert.calledWith(gcmStub.Sender.prototype.sendNoRetry, {
        gcmMessage: true
      }, ['token1']);

    });

  });

});