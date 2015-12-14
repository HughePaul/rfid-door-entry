'use strict';

var EventEmitter = require('events')
	.EventEmitter;

var Throttle = require('./throttle');

var pad = (v, l) => {
	v = (v + '').substr(0,l);
	while (v.length < l) {
		v = v = '0';
	}
	return v;
};

class Reader extends EventEmitter {
	static cardToHex(card) {
		if(!card || typeof card.id !== 'string') { return false; }
		var parts = card.id.split('-');
		var type = parts[0]
			.substr(0,1)
			.toUpperCase() || '0';
		var id = parts[1]
			.substr(0,14)
			.toUpperCase() || '0';
		var level = (card.level || 0)
			.toString(16)
			.substr(-1, 1)
			.toUpperCase();
		return pad(id, 14) + pad(level, 1) + pad(type, 1);
	}

	static hexToCard(hex) {
		if(typeof hex !== 'string') { return false; }
		if(hex === '') { return false; }
		var id = hex
			.substr(0, 14)
			.toUpperCase() || '0';
		var type = hex
			.substr(15, 1)
			.toUpperCase() || '0';
		var level = parseInt(hex.substr(14, 1), 16) || 0;
		return {
			id: pad(type, 1) + '-' + pad(id, 14),
			level: level
		};		
	}

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
		var card = Reader.hexToCard( line.substr(2, 16));

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
				this._readerId = parseInt(line.substr(2, 2), 16) || 0;
				this.emit('id', this._readerId);
				break;
				// relay was manually activated
			case 'O':
				this.emit('activate');
				break;
				// card list
			case 'P':
				if (card) {
					this._cards[card.id] = card.level || 2;
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
				this._doorNotificationThrottle.call( () => this.emit('door', this.door) );
				break;
				// a card was added
			case 'A':
				if(!card) { break; }
				this._cards[card.id] = card.level;
				this.emit('add', card.id, card.level);
				break;
				// a card was removed
			case 'R':
				if(!card) { break; }
				delete this._cards[card.id];
				this.emit('remove', card.id, card.level);
				break;
				// access granted
			case 'G':
				if(!card) { break; }
				this._cards[card.id] = card.level;
				this.emit('access', card.id, card.level);
				break;
				// unknown card
			case 'B':
				if(!card) { break; }
				this.emit('unknown', card.id);
				break;
				// card found but access level too low
			case 'N':
				if(!card) { break; }
				this._cards[card.id] = card.level;
				this.emit('noaccess', card.id, card.level);
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
			level = level
				.toString(16)
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
		this._cards[id.toUpperCase()] = level;
		var card = Reader.cardToHex({id: id, level: level});
		this.write('A ' + card, id);
	}

	remove(id) {
		if (!this.isOpen) {
			throw new Error('Not open');
		}
		console.log('Reader remove', id);
		delete this._cards[id.toUpperCase()];
		var card = Reader.cardToHex({id: id, level: 0});
		this.write('R ' + card, id);
	}

}

Reader.DOOR_CLOSED = 'Door Closed';
Reader.DOOR_MANUAL = 'Manually Opened';
Reader.DOOR_OPENED = 'Door Opened';

module.exports = Reader;