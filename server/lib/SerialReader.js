'use strict';

var SerialPort = require('serialport');
var fs = require('fs');
var Reader = require('./Reader');

class SerialReader extends Reader {
	constructor(comPortPattern) {
		super();
		this._comPortPattern = comPortPattern;
	}

	_getSerialPort() {
		var rePort = new RegExp(this._comPortPattern);

		var port;
		var devs = fs.readdirSync('/dev/');
		devs.forEach(function(dev) {
			if (rePort.test(dev)) {
				port = dev;
			}
		});
		if (!port) {
			this.retryOpen();
			return console.log('Cannot guess reader serial port ' + this._comPortPattern);
		}

		port = '/dev/' + port;

		return new SerialPort.SerialPort(port, {
			baudrate: 9600,
			parser: this._parser.bind(this)
		});

	}
}

module.exports = SerialReader;