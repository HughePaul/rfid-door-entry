'use strict';

var Reader = require('./Reader');
var DummySerialPort = require('./DummySerialPort');

class DummyReader extends Reader {
	constructor(options) {
		super();
		this._options = options;
		this._options.parser = this._parser.bind(this);
	}

	_getSerialPort() {
		return new DummySerialPort(this._options.name, this._options);
	}
}

module.exports = DummyReader;