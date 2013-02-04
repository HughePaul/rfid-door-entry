var sys = require('sys');
var EventEmitter = require('events').EventEmitter;
var sqlite3 = require('sqlite3').verbose();
var Reader = require('./Reader');

function Cards(config) {
	var that = this;

	that.level = 0;

	// open database
	var filename = config.database || ':memory:';
	console.log('Opening database:',filename);
	var db = new sqlite3.Database(filename, function(err) {
		if(err) { return console.error(err); }

		// test database to see if we need to make the table
		db.serialize(function() {
			db.get("SELECT count(id) FROM cards", function(err) {
				// if there was an error then create the table
				if(err) {
					console.log('Creating cards table');
					db.serialize(function() {
						db.run("CREATE TABLE cards (id TEXT, level INTEGER, name TEXT, modified TEXT, avatar TEXT, notes TEXT)", function(err){
							if(err) { return console.error(err); }
							console.log('log cards created');
						});
					});
				}
			});
			db.get("SELECT count(id) FROM log", function(err) {
				// if there was an error then create the table
				if(err) {
					console.log('Creating log table');
					db.serialize(function() {
						db.run("CREATE TABLE log (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, type STRING, desc TEXT, cardid TEXT, level INTEGER)", function(err){
							if(err) { return console.error(err); }
							console.log('log table created');
						});
					});
				}
			});
		});
	});

	this.addLog = function(item) {
		item.timestamp = new Date().toISOString().replace('T',' ').replace(/\..*$/,'');
		db.run("INSERT INTO log (timestamp, type, desc, cardid, level) VALUES (datetime('now'),?,?,?,?)", [
			item.type,
			item.desc,
			item.cardid,
			item.level
		], function(err) {
			if(err) { console.error('Cards:db:',err); }
		});
		console.log('LOG:', item);
		this.emit('log', item);
	};
	this.getLog = function(count, cb) {
		if(!count) { count = 100; }
		db.serialize(function() {
			db.all("SELECT id, timestamp, type, desc, cardid, level FROM log ORDER BY id DESC LIMIT $count", { $count: count }, function(err, items) {
				if(err) { console.error('Cards:db:',err); }
				if(cb) { cb(err, items.reverse()); }
			});
		});
	};


	this.getCard = function(id, cb) {
		db.serialize(function() {
			db.get("SELECT id, level, name, modified, avatar, notes FROM cards WHERE id = $id", { $id: id }, function(err, card) {
				if(err) { console.error('Cards:db:',err); }
				if(cb) { cb(err, card); }
			});
		});
		return this;
	};

	this.updateCard = function(id, details, cb) {
		// if no details given then remove card
		if(!details) {
			return this.removeCard(id, cb);
		}

		try {
			// if card is not on reader or level has changed then remove and add with new level
			if (details && (!that.reader.cards[id] || that.reader.cards[id] !== details.level) ) {
				if(details.level) {
					console.log('Add card to reader', id, details.level);
					that.reader.add(id, details.level);
				}
			}
		} catch(e) {
			console.error('Reader error:', e);
		}

		this.getCard(id, function(err, card) {
			if(err) { return console.error('Cards:db:',err); }

			db.serialize(function() {
				var isNew = false;
				if(!card) {
					// if level is zero and no card then it was removed
					if(!details.level) { return; }
					// otherwise insert new record
					console.log('Add card to database', id);
					db.run("INSERT INTO cards (id) VALUES ($id)", { $id: id }, function(err) {
						if(err) { console.error('Cards:db:cards:insert',err); }
					});
					card = { id: id };
					isNew = true;
				}
				// update record with details
				console.log('Update card in database', id);

				card.level = details.level || card.level || 0;
				card.name =	details.name || card.name || 'UNKNOWN';
				card.avatar = details.avatar || card.avatar || '';
				card.notes = details.notes || card.notes || '';

				db.run("UPDATE cards SET level = $level, name = $name, modified = datetime('now'), avatar = $avatar, notes = $notes WHERE id = $id", {
					$id: id,
					$level: card.level,
					$name: card.name,
					$avatar: card.avatar,
					$notes: card.notes
				}, function(err) {
					if(err) { return console.error('Cards:db:cards:update',err); }

					if(cb){ cb(id, card); }

					// get card back from the db and send to everyone as an update
					that.getCard(id, function(err, card) {
						if(!err) {
							that.emit('card', id, card, isNew);
						}
					});

				});
			});
		});
		return this;
	};

	this.removeCard = function(id, cb) {
		this.getCard(id, function(err, card) {
			if(err) { return console.error('Cards:db:',err); }

			db.serialize(function() {
				console.log('Remove card from database', id);
				db.run("DELETE FROM cards WHERE id = $id", { $id: id }, function(err) {
					if(err) { console.error('Cards:db:',err); }
				});
			});
			try {
				if(this.reader.cards[id]) {
					console.log('Remove card from reader', id);
					this.reader.remove(id);
				}
				if(cb) { cb(id, card); }
			} catch(e) {
				console.error('Reader error:', e);
			}
			this.emit('card', id);
		});
		return this;
	};

	this.getCards = function(cb) {
		db.serialize(function() {
			db.all("SELECT id, level, name, modified, avatar, notes FROM cards", function(err, cardArray) {
				var cards = {};
				if(err) {
					console.error('Cards:db:',err);
				} else {
					cardArray.forEach(function(item){
						cards[item.id] = item;
					});
				}
				if(cb) { cb(err, cards); }
			});
		});
		return this;
	};



	// open reader
	this.reader = new Reader();

	var readerThrottle = null;
	function retryOpenReader() {
		readerThrottle = setTimeout(function(){
			readerThrottle = null;
			openReader();
		}, 5000);
	}
	function openReader() {
		if(readerThrottle) { return; }

		var port;
		var devs = require('fs').readdirSync('/dev/');
		devs.forEach(function(dev){
			if(config.comPort.test(dev)) {
				port = dev;
			}
		});
		if(!port) {
			retryOpenReader();
			return console.log('Cannot guess reader serial port');
		}

		try {
			that.reader.open('/dev/'+port);
		} catch (e) {
			retryOpenReader();
			return console.log('Cannot open reader serial port:',e);
		}
	}

	this.reader
		.on('close', function() {
			console.error('Reader port closed. trying again in 5 seconds');
			retryOpenReader();
		})
		.on('error', function(e) {
			that.addLog({type: 'ERROR', desc: 'Reader error '+e});
		})
		.on('reset', function() {
			that.addLog({type: 'RESET', desc: 'Reader reset'});
		})
		.on('cards', function(readerCards){
			console.log('Syncing cards between db and reader');

			that.getCards(function(err, dbCards){
				if(err) { return console.error(err); }

				var id;

				for(id in dbCards) {
					if(!readerCards[id]) {
						console.log('Syncing: Adding card',id,'to reader');
						that.reader.add(id, dbCards[id].level);
					}
				}

				for(id in readerCards) {
					if(!dbCards[id]) {
						console.log('Syncing: Adding card',id,'to db');
						that.updateCard(id, { level: readerCards[id] });
					}
				}


			});

		})
		.on('access', function(id, level){
			that.addLog({type: 'ACCESS', desc: 'Access granted', cardid: id, level: level});
			that.updateCard(id, {level: level});
		})
		.on('noaccess', function(id, level){
			that.addLog({type: 'NOACCESS', desc: 'Access denied', cardid: id, level: level});
			that.updateCard(id, {level: level});
		})
		.on('unknown', function(id){
			that.addLog({type: 'NOACCESS', desc: 'Access denied', cardid: id, level: 0});
		})
		.on('add', function(id, level){
			that.updateCard(id, {level: level}, function(id, card, isNew){
				that.addLog({type: isNew?'ADDED':'UPDATED', desc: JSON.stringify(card), cardid: id, level: card.level});
			});
		})
		.on('remove', function(id, level){
			that.updateCard(id, {level: 0}, function(id, card){
				that.addLog({type: 'REMOVED', desc: JSON.stringify(card), cardid: id, level: card.level});
			});
		})
		.on('level', function(level){
			that.level = level;
//			that.addLog({type: 'LEVEL', desc: 'Security Level', level: level});
			that.emit('level', level);
		})
		.on('activate', function(){
//			that.addLog({type: 'OPENED', desc: 'Door Opened'});
			that.emit('opened');
		});

	this.activate = function(loggedInUsername, cb) {
		var that = this;
		this.reader.activate(function(){
			that.addLog({type: 'OPENED', desc:'Door opened by '+loggedInUsername});
			if(cb){ cb(loggedInUsername); }
		});
	};

	this.setLevel = function(level, loggedInUsername, cb) {
		var that = this;
		this.reader.setLevel(level, function(level){
			that.addLog({type: 'LEVEL', desc:'Security level changed by '+loggedInUsername, level:level});
			if(cb){ cb(level, loggedInUsername); }
		});
	};

	this.addLog({type: 'STARTUP', desc:'Server started'});
	openReader();
}
sys.inherits(Cards, EventEmitter);

module.exports = Cards;
