'use strict';

var EventEmitter = require('events')
	.EventEmitter;

var Throttle = require('./throttle');

class Reader extends EventEmitter {
	constructor(options) {
		super();
		this._options = options;
		this._device = null;
		this._readerThrottleTimer = null;
		this._readerId = 0;
		this._lastid = '';

		this.reset();

		this._doorNotificationThrottle = new Throttle({maxCalls: 1, period: 5000});
	}

	reset() {
		this._data = '';
		this._readerId = 0;
		this._cards = {};
		this._level = 0;
		this._door = Reader.DOOR_CLOSED;
		this._busy = false;
		this._commands = [];
	}

	get name() {
		return this._options.name || ('Reader' + this._readerId);
	}

	get isOpen() {
		return !!this._device;
	}

	get level() {
		return this._level;
	}

	get door() {
		return this._door;
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
		this._data += buffer.toString('ascii');

		// Split collected data by delimiter
		var parts = this._data.split('\r\n');
		this._data = parts.pop();
		parts.forEach((part) => {
			this._decode(part);
		});
	}

	_getDevice() {
		throw new Error('Cannot use abstract Reader class');
	}

  open() {
		if (this._readerThrottleTimer) {
			return;
		}

		try {
			this._device = this._getDevice();
			if(!this.isOpen) { throw 'Unable to assign reader device ' + this.name; }
		} catch (e) {
			this._device = null;
			this.emit('error', e);
			return;
		}

		this._device.on('open', () => {
			this.emit('open');
			this.getIdFromReader();
			this.setLevel(this.level);
			this.getCards();
		});

		this._device.on('close', () => {
			this._device = null;
			this.emit('close');
			this.reset();
			this.retryOpen();
		});

		this.reset();
	}

	close() {
		if (!this.isOpen) {
			throw new Error('Reader device is not open');
		}
		this.serialport.close();
	}

	write(command, id, cb) {
		this._commands.push({
			command: command,
			id: id,
			cb: cb
		});
		this._writeWaiting();
	}

	_writeWaiting() {
		if (this._commands.length && !this.busy && this._device) {
			var next = this._commands.shift();
			var data = new Buffer('\r\n' + next.command + '\r\n', 'ascii');
			this._busy = true;
			this._lastid = next.id;
			this.emit('dataout', data);
			this._device.write(data);
			if(next.cb) { next.cb(); }
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
						case '4f':
							error.message = 'Database error';
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
					this._cards[id] = level || 1;
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
				// current door state
			case 'D':
				var doorState = line.substr(2, 1);
				switch(doorState) {
					case 'R':
						this._door = Reader.DOOR_OPENED;
						break;
					case 'M':
						this._door = Reader.DOOR_MANUAL;
						break;
					case 'C':
						this._door = Reader.DOOR_CLOSED;
						break;
					default:
						this.emit('error', 'Unknown door state from reader: ' + doorState);
						break;
				}
				this._doorNotificationThrottle( () => this.emit('door', this.door) );
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
				// unknown card
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
				this.emit('error', 'Unknown response from reader: ' + line);
		}

		this._writeWaiting();
	}

	setLevel(level, cb) {
		if (!this.isOpen) {
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
			var writeCb = () => this.once('level', cb);
		}
		console.log('Set Level', level);
		this.write('S ' + level, null, writeCb );
	}

	getIdFromReader(cb) {
		if (!this.isOpen) {
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
		if (!this.isOpen) {
			throw new Error('Not open');
		}
		if (typeof cb === 'function') {
			var writeCb = () => this.once('activate', cb);
		}
		this.write('O', null, writeCb);
	}

	getCards(cb) {
		if (!this.isOpen) {
			throw new Error('Not open');
		}
		this._cards = {};
		if (typeof cb === 'function') {
			this.once('cards', cb);
		}
		this.write('P');
	}

	add(id, level) {
		if (!this.isOpen) {
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
		if (!this.isOpen) {
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

Reader.DOOR_CLOSED = 'Door Closed';
Reader.DOOR_MANUAL = 'Manually Opened';
Reader.DOOR_OPENED = 'Door Opened';

module.exports = Reader;