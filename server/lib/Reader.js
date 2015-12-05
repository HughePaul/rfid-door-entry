'use strict';

var util = require('util');
var EventEmitter = require('events')
	.EventEmitter;
var SerialPort = require('serialport');
var fs = require('fs');

class Reader extends EventEmitter {
	constructor(comPortPattern) {
		super();
		this._comPortPattern = comPortPattern;
		this._serialPort = null;
		this._readerThrottleTimer = null;
		this._readerId = 0;
		this._lastid = '';

		this.reset();
	}

	reset() {
		this._data = '';
		this._readerId = 0;
		this._cards = {};
		this._level = 0;
		this._busy = false;
		this._commands = [];
	}

	get isOpen() {
		return !!this._serialPort;
	}

	get level() {
		return this._level;
	}

	set level(l) {
		this.setLevel(l);
	}

	get cards() {
		return this._cards || {};
	}

	get busy() {
		return this._busy;
	}

  retryOpen() {
		this._readerThrottleTimer = setTimeout(() => {
			this._readerThrottleTimer = null;
			this.open();
		}, 5000);
	}

	_parser(emitter, buffer) {
			// check buffer isn't out of range
			var bad = false;
			for (var i = 0; i < buffer.length; i++) {
				if (buffer[i] < 10 || buffer[i] > 'Z') {
					bad = true;
				}
			}

			this.emit('datain', buffer, bad);

			if (bad) {
				return;
			}

			// Collect data
			data += buffer.toString('ascii');

			// Split collected data by delimiter
			var parts = data.split('\r\n');
			data = parts.pop();
			parts.forEach((part) => {
				this._decode(part);
			});
		};


  open() {
		if (this._readerThrottleTimer) {
			return;
		}

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

		this.data = '';

		try {
			this._serialPort = new SerialPort.SerialPort(port, {
				baudrate: 9600,
				parser: this._parser.bind(this)
			});
		} catch (e) {
			this._serialPort = null;
			this.emit('error', e);
			return;
		}

		this._serialPort.on('open', () => {
			this.emit('open', port);
			this.getIdFromReader();
			this.setLevel(reader.level);
			this.getCards();
		});

		this._serialPort.on('close', () => {
			this._serialPort = null;
			this.emit('close');
			this.reset();
			this.retryOpen();
		});

		this.reset();
	}

	close() {
		if (!this._serialPort) {
			throw new Error('Not open');
		}
		this.serialport.close();
	}



	write(command, id) {
		this._commands.push({
			command: command,
			id: id
		});
		this._writeWaiting();
	}

	_writeWaiting() {
		if (this._commands.length && !this.busy && this._serialPort) {
			var next = this._commands.shift();
			var data = new Buffer('\r\n' + next.command + '\r\n', 'ascii');
			this._busy = true;
			this._lastid = next.id;
			this.emit('dataout', data);
			this._serialPort.write(data);
		}
	}

	_decode(line) {
		var reply = line.substr(0, 1);
		var id = line.substr(17, 1) + '-' + line.substr(2, 14);
		var level = parseInt(line.substr(16, 1), 16);

		this._busy = false;

		if (line === '') {
			return;
		}

		switch (reply) {
			// reset
			case '@':
				this.reset();
				this.emit('reset');
				this.setLevel(this.level);
				this.getCards();
				break;
				// error from reader
			case '!':
				var error = {
					code: line.substr(2)
				};

				if (error.code === '50') {
					this.emit('notfound', this._lastid);
				} else {
					switch (error.code) {
						case '01':
							error.message = 'No card present';
							break;
						case '10':
							error.message = 'No ack from command write';
							break;
						case '20':
							error.message = 'No reply length';
							break;
						case '30':
							error.message = 'Incorrect reply command';
							break;
						case '40':
							error.message = 'Memory write error';
							break;
						case '41':
							error.message = 'Memory read error';
							break;
						case '42':
							error.message = 'Out of memory when adding record';
							break;
						case '43':
							error.message = 'End of memory when removing record';
							break;
						case '50':
							error.message = 'Record not found';
							break;
					}
					this.emit('error', error, this._lastid);
				}
				break;
				// id from reader
			case 'I':
				this._readerId = parseInt(line.substr(2, 2), 16);
				this.emit('id', this._readerId);
				break;
				// relay was manually activated
			case 'O':
				this.emit('activate');
				break;
				// card list
			case 'P':
				if (id.length === 16) {
					this._cards[id] = level;
					this._busy = true;
				} else {
					this.emit('cards', this.cards);
				}
				break;
				// current access level
			case 'S':
				this._level = parseInt(line.substr(2, 1), 16);
				this.emit('level', this._level);
				break;
				// a card was added
			case 'A':
				this._cards[id] = level;
				this.emit('add', id, level);
				break;
				// a card was removed
			case 'R':
				delete this._cards[id];
				this.emit('remove', id, level);
				break;
				// access granted
			case 'G':
				this._cards[id] = level;
				this.emit('access', id, level);
				break;
				// unknwon card
			case 'B':
				this.emit('unknown', id);
				break;
				// card found but access level too low
			case 'N':
				this._cards[id] = level;
				this.emit('noaccess', id, level);
				break;
			case '?':
				this.emit('badcommand');
				break;
			default:
				this.emit('error', 'Unknown reply: ' + line);
		}

		this._writeWaiting();
	}

	setLevel(level, cb) {
		if (!this._serialPort) {
			throw new Error('Not open');
		}
		if (level) {
			level = parseInt(level, 10);
			level = level.toString(16)
				.toUpperCase();
		} else {
			level = '';
		}
		if (typeof cb === 'function') {
			this.once('level', cb);
		}
		console.log('Set Level', level);
		this.write('S ' + level);
	}

	getIdFromReader(cb) {
		if (!this._serialPort) {
			throw new Error('Not open');
		}
		if (typeof cb === 'function') {
			this.once('id', cb);
		}
		console.log('Get Id');
		this.write('I');
	}

	getId() {
		return this._readerId;
	}

	activate(cb) {
		if (!this._serialPort) {
			throw new Error('Not open');
		}
		if (typeof cb === 'function') {
			this.once('activate', cb);
		}
		this.write('O');
	}

	getCards(cb) {
		if (!this._serialPort) {
			throw new Error('Not open');
		}
		this._cards = {};
		if (typeof cb === 'function') {
			this.once('cards', cb);
		}
		this.write('P');
	}

	add(id, level) {
		if (!this._serialPort) {
			throw new Error('Not open');
		}
		level = parseInt(level, 10);
		console.log('Reader add', id, level);
		this._cards[id] = level;
		var card = id.substr(2, 14);
		card += level.toString(16)
			.substr(-1, 1);
		card += id.substr(0, 1);
		this.write('A ' + card.toUpperCase(), id);
	}

	remove(id) {
		if (!this._serialPort) {
			throw new Error('Not open');
		}
		console.log('Reader remove', id);
		delete this._cards[id];
		var card = id.substr(2, 14);
		card += '0';
		card += id.substr(0, 1);
		this.write('R ' + card.toUpperCase(), id);
	}

}

module.exports = Reader;