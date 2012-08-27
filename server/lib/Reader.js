var sys = require('sys');
var EventEmitter = require('events').EventEmitter;
var SerialPort = require('serialport');

function Reader(port){
	this.serialPort = null;

	this._busy = false;
	this._commands = [];

	this._def('isOpen', function(){ return !! this.serialPort; });
	this._def('level', function(){ return this._level; }, function(l){ this.setLevel(l); });
	this._def('cards', function(){ return this._cards || {}; });
	this._def('busy', function(){ return this._busy; });

	if(port) {
		this.open(port);
	}

}

sys.inherits(Reader, EventEmitter);

Reader.prototype._def = function(name, getter, setter) {
	Object.defineProperty(this, name, {
		enumerable: false,
		get: getter,
		set: setter
	});
};

Reader.prototype.open = function(port) {
	var reader = this;

	var data = "";
	var parser = function (emitter, buffer) {
		// check buffer isn't out of range
		var bad = false;
		for(var i=0; i<buffer.length; i++) {
			if(buffer[i] < 10 || buffer[i] > 'Z') {
				bad = true;
			}
		}

		reader.emit('datain', buffer, bad);

		if(bad) { return; }

		// Collect data
		data += buffer.toString('ascii');

		// Split collected data by delimiter
		var parts = data.split("\r\n");
		data = parts.pop();
		parts.forEach(function (part, i, array) {
			reader.decode(part);
		});
	};

	try {
		this.serialPort = new SerialPort.SerialPort(port, {
			baudrate: 9600,
		    parser: parser
		});
	} catch(e) {
		this.serialPort = null;
		this.emit('error',e);
		return;
	}

	this.serialPort.on('open', function() {
		reader.emit('open', port);
		if(reader.level) {
			reader.setLevel(reader.level);
		}
		reader.getCards();
	});

	this.serialPort.on("close", function () {
		reader.serialPort = null;
		reader.emit('close');
		reader.reset();
	});

	this.reset();
};

Reader.prototype.close = function() {
	if(!this.serialPort) { throw new Error("Not open"); }
	this.serialport.close();
};

Reader.prototype.reset = function() {
	this._cards = {};
	this._level = 15;
	this._busy = false;
	this._commands = [];
};

Reader.prototype.write = function(command) {
	this._commands.push(command);
	this._writeWaiting();
};

Reader.prototype._writeWaiting = function(command) {
	if(this._commands.length && !this.busy && this.serialPort) {
		var data = new Buffer('\r\n'+this._commands.shift()+'\r\n', 'ascii');
		this._busy = true;
		this.emit('dataout', data);
		this.serialPort.write(data);
	}
};

Reader.prototype.decode = function(line) {
	var reply = line.substr(0,1);
	var id = line.substr(17,1)+'-'+line.substr(2, 14);
	var level = parseInt(line.substr(16,1),16);

	this._busy = false;

	if(line === '') { return; }

	switch(reply) {
		// reset
		case '@':
			this.reset();
			this.emit('reset');
			if(reader.level) {
				reader.setLevel(reader.level);
			}
			reader.getCards();
			break;
		// error from reader
		case '!':
			var error = {code: line.substr(2)};
			switch(error.code) {
				case '01': error.message = 'No card present'; break;
				case '10': error.message = 'No ack from command write'; break;
				case '20': error.message = 'No reply length'; break;
				case '30': error.message = 'Incorrect reply command'; break;
				case '40': error.message = 'Memory write error'; break;
				case '41': error.message = 'Memory read error'; break;
				case '42': error.message = 'Out of memory when adding record'; break;
				case '43': error.message = 'End of memory when removing record'; break;
				case '50': error.message = 'Record not found'; break;
			}
			this.emit('error',error);
			break;
		// relay was manually activated
		case 'O':
			this.emit('activate');
			break;
		// card list
		case 'P':
			if(id.length === 16) {
				this._cards[id] = level;
				this._busy = true;
			} else {
				this.emit('cards', this.cards);
			}
			break;
		// current access level
		case 'S':
			this._level = parseInt(line.substr(2,1),16);
			this.emit('level',this._level);
			break;
		// a card was added
		case 'A':
			this._cards[id] = level;
			this.emit('add',id,level);
			break;
		// a card was removed
		case 'R':
			delete this._cards[id];
			this.emit('remove',id,level);
			break;
		// access granted
		case 'G':
			delete this._cards[id];
			this.emit('access',id,level);
			break;
		// unknwon card
		case 'B':
			delete this._cards[id];
			this.emit('unknown',id);
			break;
		// card found but access level too low
		case 'N':
			this._cards[id] = level;
			this.emit('noaccess',id,level);
			break;
		case '?':
			this.emit('badcommand');
			break;
		default:
			this.emit('error', 'Unknown reply: '+line);
	}

	this._writeWaiting();
};

Reader.prototype.setLevel = function(level, cb) {
	if(!this.serialPort) { throw new Error("Not open"); }
	if(level) {
		level = level.toString(16).toUpperCase();
	} else {
		level = '';
	}
	if(typeof cb === 'function') {
		this.once('level', cb);
	}
	this.write('S '+level);
};

Reader.prototype.activate = function(cb) {
	if(!this.serialPort) { throw new Error("Not open"); }
	if(typeof cb === 'function') {
		this.once('activate', cb);
	}
	this.write('O');
};

Reader.prototype.getCards = function(cb) {
	if(!this.serialPort) { throw new Error("Not open"); }
	this._cards = {};
	if(typeof cb === 'function') {
		this.once('cards', cb);
	}
	this.write('P');
};


Reader.prototype.add = function(id, level) {
	if(!this.serialPort) { throw new Error("Not open"); }
	var card = id.substr(2,14);
	card[14] = level.toString(16).substr(-1,1);
	card[15] = id.substr(0,1);
	this.write('A '+card.toUpperCase());
};


Reader.prototype.remove = function(id) {
	if(!this.serialPort) { throw new Error("Not open"); }
	var card = id.substr(2,14);
	card[14] = '0';
	card[15] = id.substr(0,1);
	this.write('R '+card.toUpperCase());
};



module.exports = Reader;

