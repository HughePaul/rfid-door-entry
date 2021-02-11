'use strict';

var Reader = require('./Reader');
var DummySerialPort = require('./DummySerialPort');

class DummyReader extends Reader {
	_getDevice() {
		return new DummySerialPort(this._options.name, this._options);
	}
}

module.exports = DummyReader;