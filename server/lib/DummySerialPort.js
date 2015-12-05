'use strict';

var EventEmitter = require('events')
	.EventEmitter;

class DummySerialPort extends EventEmitter {
	static generateId(){
		this._incId = this._incId || 0;
		this._incId++;
		return this._incId;
	}

	constructor(name, options) {
		super();
		this._options = options;
		this._options.id = this._options.id || DummySerialPort.generateId();
		this._options.level = this._options.level || 15;
		this._options.name = name || options.name || 'DummySerialPort' + this._options.id;

		if(typeof this._options != 'object') {
			throw new Error('Options not specified');
		}

		if(typeof this._options.parser != 'function') {
			throw new Error('Parser function not specified');
		}

		this._options.cards = this._options.cards || [
			{ id: '4-12345678901234', level: 4 },
			{ id: '8-98765432109876', level: 5 }
		];

		this._options.replyDelay = this._options.replyDelay = 1000;

		this._isOpen = false;
		this._isBusy = false;
		this._data = '';

		this.resetDevice();

		setTimeout( () => this.open() , this._options.replyDelay);
	}

	open() {
		if(this._isOpen) return;
		this._isOpen = true;
		this.emit('open');
	}

	close() {
		if(!this._isOpen) return;
		this._isOpen = false;
		this.emit('close');
	}

	resetDevice() {
		this._data = '';
		this._isBusy = false;
		console.log(this._options.name,
			'resetDevice',
			'id:', this._options.id,
			'cards:', this._options.cards.length,
			'level:', this._options.level);
		this._sendResponse('\r\n@ ' + this._options.id + '\r\n');
	}

	_cardToHex(card) {
		var parts = card.id.split('-');
		var type = parts[0].substr(0,1);
		var id = parts[1].substr(0,14);
		var level = card.level.toString(16).substr(-1, 1) || '0';
		return id + level + type;
	}

	_hexToCard(hex) {
		var id = hex.substr(0, 14);
		var type = hex.substr(15, 1);
		var level = parseInt(hex.substr(14, 1), 16) || 0
		return {
			id: type + '-' + id,
			level: level
		};		
	}

	_findCard(id) {
		return this._options.cards.find( (c) => c.id == id );
	}

	presentCard(id) {
		var card = this._findCard(id);
		if(!card) {
			console.log(this._options.name, 'presentCard', 'Card not found', id);
			this._sendResponse('\r\nB ' + this._cardToHex({id:id}) + '\r\n');
			return;
		}
		if(card.level < this._options.level) {
			console.log(this._options.name, 'presentCard', 'Card level not high enough', id);
			this._sendResponse('\r\nN ' + this._cardToHex(card) + '\r\n');
			return;
		}

		console.log(this._options.name, 'presentCard', 'Access granted', id);
		this._sendResponse('\r\nG ' + this._cardToHex(card) + '\r\n');
	}

	programCard(id) {
		var card = this._findCard(id);
		if(card) {
			console.log(this._options.name, 'programCard', 'Removing card', id);
			return removeCard(id);
		}

		console.log(this._options.name, 'programCard', 'Adding card', id, this._options.level);
		return updateCard({id: id, level: this._options.level});
	}

	updateCard(card) {
		var existingCard = this._findCard(card.id);
		if (existingCard) {
			existingCard.level = card.level;
			console.log(this._options.name, 'updateCard', 'Updated card', existingCard.id, existingCard.level);
		} else {
			this._options.cards.push(card);
			console.log(this._options.name, 'updateCard', 'Added card', card.id, card.level);
		}
		this._sendResponse('\r\nA ' + this._cardToHex(card) + '\r\n');
	}

	removeCard(id) {
		var card = this._findCard(id);
		if(!card) {
			console.log(this._options.name, 'removeCard', 'Card not found', id);
			this._sendError(50);
			return;
		}
		this._options.cards = this._options.cards.filter( (c) => c.id != id );
		console.log(this._options.name, 'removeCard', 'Removed card', id);
		this._sendResponse('\r\nR ' + this._cardToHex(card) + '\r\n');
	}

	write(data) {
		console.log(this._options.name, 'write', data.toString('ascii').replace(/[\n\r]/g,'•'));
		if(!this._isOpen) {
			throw new Error('Cannot write to serial ' + this._options.name + ' port when closed');
		}
		if(this._isBusy) {
			throw new Error('Cannot write to device ' + this._options.name + ' when busy');
		}
		this._parseIncomming(data);
	}

	_sendResponse(data) {
		setTimeout(() => {
			this._isBusy = false;
			if(this._isOpen) {
				console.log(this._options.name, 'Outgoing', data.replace(/[\n\r]/g,'•'));
				this._options.parser(this, new Buffer(data, 'ascii'));
			}
		}, this._options.replyDelay);
	}

	_sendError(error) {
		this._sendResponse('\r\n! ' + error + '\r\n');
	}

	_parseIncomming(buffer) {
		// check buffer isn't out of range
		for (var i = 0; i < buffer.length; i++) {
			if (buffer[i] < 10 || buffer[i] > 'Z') {
				throw new Error('Bad data sent to ' + this._options.name + ': ', buffer[i]);
			}
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

	_decode(line) {
		var command = line.substr(0, 1);
		var level = parseInt(line.substr(2, 1), 16);
		var card = this._hexToCard(line.substr(2));

		if (line === '') {
			return;
		}

		console.log(this._options.name, 'Incomming', line);

		this._isBusy = true;

		switch (command) {
			// reset
			case 'I':
				console.log(this._options.name,'Get Level');
				this._sendResponse('\r\nI ' + this._options.id.toString(16) + '\r\n');
				break;
			case 'O':
				console.log(this._options.name,'Open door');
				this._sendResponse('\r\nO\r\n');
				if(this._options.doorOpeningDelay) {
					setTimeout( () => this._sendResponse('\r\nD R\r\n'),
						this._options.doorOpeningDelay);
					setTimeout( () => this._sendResponse('\r\nD C\r\n'),
						this._options.doorOpeningDelay * 2);
				}
				break;
				// card list
			case 'P':
				console.log(this._options.name,'Print cards');
				this._sendResponse('\r\n');
				this._options.cards.forEach((card) => {
					this._sendResponse('P ' + this._cardToHex(card) + '\r\n');
				});
				this._sendResponse('\r\nP\r\n');
				break;
				// current access level
			case 'S':
				console.log(this._options.name,'Set/Get Level', level);
				if(level) {
					this._options.level = level;
				}
				var hexLevel = this._options.level.toString(16).substr(-1,1) || '0';
				this._sendResponse('\r\nS ' + hexLevel + '\r\n');
				break;
				// a card was added
			case 'A':
				console.log(this._options.name,'add card', card.id, card.level);
				this.updateCard(card);
				break;
				// a card was removed
			case 'R':
				console.log(this._options.name,'remove card', card.id);
				this.removeCard(card.id);
				break;
			default:
				console.log(this._options.name,'Unknown command');
				this._sendResponse('\r\n?\r\n');
		}

	}

}

module.exports = DummySerialPort;