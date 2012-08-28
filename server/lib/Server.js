var Reader = require('./Reader');
var Cards = require('./Cards');

function Server(config) {
	var that = this;

	this.cards = new Cards(config.database);

	// event log
	var eventLog = [];

	this.getEventLog = function(from) {
		return from ? eventLog.slice(from) : eventLog;
	};


	function addEvent(type, desc, data) {
		eventLog.push({
			id: eventLog.length,
			time: Date(),
			type: type,
			desc: desc,
			data: data
		});
		console.log('Event:',type, desc, data);
	}

	this.tryOpen = function() {
		// find PL com port
		var port;
		var devs = require('fs').readdirSync('/dev/');
		devs.forEach(function(dev){
			if(dev.substr(0,config.comPort.length) === config.comPort) {
				port = dev;
			}
		});
		if(!port) {
			throw new Error('Cannot guess reader serial port');
		}

		that.reader.open('/dev/'+port);
	};

	this.reader = new Reader()
		.on('close', function() {
			console.error('Reader port closed. trying again in 5 seconds');
			setTimeout(function(){
				try {
					that.tryOpen();
				} catch(e) {
					that.addEvent('ERROR','Error opening port', {error: e});
				}
			}, 5000);
		})
		.on('cards', function(cards){
			that.cards.syncCards(cards, function(err, cardsToAddToReader) {
				if(err) { console.error('Error Syncing cards', err); }
				for(var id in cardsToAddToReader) {
					that.reader.add(id, cardsToAddToReader[id]);
				}
			});
		})
		.on('error', function(e) {
			that.addEvent('ERROR','Reader error', {error: e});
		})
		.on('reset', function() {
			that.addEvent('RESET','Reader reset');
		})
		.on('access', function(id, level){
			that.addEvent('ACCESS', 'Access granted', {id: id, level: level});
			cards.updateCard(id, {level: level});
		})
		.on('noaccess', function(id, level){
			that.addEvent('NOACCESS', 'Access denied', {id: id, level: level});
			cards.updateCard(id, {level: level});
		})
		.on('unknown', function(id){
			that.addEvent('NOACCESS', 'Access denied', {id: id});
			console.log('Unknown card',id);
		})
		.on('add', function(id, level){
			that.addEvent('ADDED', 'Added card', {id: id, level: level});
		})
		.on('remove', function(id, level){
			that.addEvent('REMOVED', 'Removed card', {id: id, level: level});
		})
		.on('level', function(level){
			that.addEvent('ADDED', 'Added card', {id: id, level: level});
		});

	this.remove = function(id, cb) {
	};

	this.update = function(id, details) {
		if(details) {
			// add or update card
			// only get the reader to update if the level has changed
			if(!this.reader.cards[id] || this.reader.cards[id] !== this.details.level) {
				this.reader.remove(id);
				this.reader.add(id, details.level);
			}
			this.cards.updateCard(id, details, cb);
		} else {
			// remove card
			this.reader.remove(id);
			this.cards.removeCard(id, cb);
		}
	};

	this.list = function(cb) {
		this.cards.getCards(cb);
		return this;
	};

	this.get = function(id, cb) {
		this.cards.getCard(id, cb);
		return this;
	};

}


module.exports = Server;
