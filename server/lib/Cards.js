'use strict';

var path = require('path');
var util = require('util');
var EventEmitter = require('events')
	.EventEmitter;
var sqlite3 = require('sqlite3')
	.verbose();

var Reader = require('./Reader');

function Cards(config, readers) {
	var that = this;

	that.readers = readers;

	that.level = 15;

	// open database
	var filename = config.database ? path.resolve(__dirname, '..', config.database) : ':memory:';
	console.log('Opening database:', filename);
	var db = new sqlite3.Database(filename, function(err) {
		if (err) {
			return console.error(err);
		}

		// test database to see if we need to make the table
		db.serialize(function() {
			db.get("SELECT level FROM settings LIMIT 1", function(err, data) {
				// if there was an error then create the table
				if (err) {
					console.log('Creating cards table');
					db.serialize(function() {
						db.run("CREATE TABLE settings (level INTEGER)", function(err) {
							if (err) {
								return console.error(err);
							}
							console.log('log settings created');
						});
					});
					return;
				}
				if (data && data.level) {
					that.level = parseInt(data.level, 10) || 15;
				} else {
					that.level = 15;
					db.run("INSERT INTO settings (level) VALUES (?)", [that.level]);
					console.log('Creating settings record');
				}
			});
			db.get("SELECT count(id) FROM cards", function(err) {
				// if there was an error then create the table
				if (err) {
					console.log('Creating cards table');
					db.serialize(function() {
						db.run("CREATE TABLE cards (id TEXT, level INTEGER, name TEXT, modified TEXT, avatar TEXT, notes TEXT, pattern TEXT)", function(err) {
							if (err) {
								return console.error(err);
							}
							console.log('log cards created');

							if(config.cardseed) {
								console.log('adding seed cards');
								config.cardseed.forEach( function(card) {
									that.updateCard(card.id, card);									
								});
							}

						});
					});
				}
			});
			db.get("SELECT count(id) FROM log", function(err) {
				// if there was an error then create the table
				if (err) {
					console.log('Creating log table');
					db.serialize(function() {
						db.run("CREATE TABLE log (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, type STRING, desc TEXT, cardid TEXT, level INTEGER, reader TEXT)", function(err) {
							if (err) {
								return console.error(err);
							}
							console.log('log table created');
						});
					});
				}
			});
		});
	});

	this.addLog = function(item) {
		item.timestamp = new Date()
			.toISOString()
			.replace('T', ' ')
			.replace(/\..*$/, '');
		db.run("INSERT INTO log (timestamp, type, desc, cardid, level, reader) VALUES (datetime('now'),?,?,?,?, ?)", [
			item.type,
			item.desc,
			item.cardid,
			item.level,
			item.reader
		], function(err) {
			if (err) {
				return console.error('Cards:db:', err, 'inserting log', item);
			}
			if(this.lastID) { item.id = this.lastID; }
			console.log('LOG:', item);
			if (item.type !== 'UPDATED') {
				that.emit('log', item);
			}
		});
		return that;
	};
	this.saveLevel = function() {
		db.run("UPDATE settings SET level = ?", [that.level], function(err) {
			if (err) {
				console.error('Cards:db:', err);
			}
		});
		return that;
	};
	this.getLog = function(count, cb) {
		if (!count) {
			count = 100;
		}
		db.serialize(function() {
			db.all("SELECT id, timestamp, type, desc, cardid, level, reader FROM log WHERE type != 'UPDATED' ORDER BY id DESC LIMIT $count", {
				$count: count
			}, function(err, items) {
				if (err) {
					console.error('Cards:db:', err);
				}
				if (cb) {
					cb(err, items.reverse());
				}
			});
		});
	};

	this.getCard = function(id, cb) {
		db.serialize(function() {
			db.get("SELECT id, level, name, modified, avatar, notes, pattern FROM cards WHERE id = $id", {
				$id: id
			}, function(err, card) {
				if (err) {
					console.error('Cards:db:', err);
				}
				if (cb) {
					cb(err, card);
				}
			});
		});
		return that;
	};

	this.updateCardTimers = function() {
		that.getCards(function(err, cards) {
			if (err) {
				return console.error(err);
			}
			for (var id in cards) {
				var details = cards[id];
				if (details.pattern) {
					var now = new Date();
					var hour = (now.getHours() * 2) + (now.getMinutes() >= 30 ? 1 : 0);
					var last = (details.pattern.substr(hour ? hour - 1 : 47, 1) === '#');
					var current = (details.pattern.substr(hour, 1) === '#');
					if (current !== last) {
						if (current) {
							console.log('Enable card on timer', details.name, id);
							that.readers.forEach(function(reader) {
								reader.add(id, details.level);
							});
						} else {
							console.log('Disable card on timer', id);
							that.readers.forEach(function(reader) {
								reader.add(id, 1);
							});
						}
					}
				}
			}
		});
		return that;
	};

	var firstInterval = (30 * 60000) - (Date.now() % (30 * 60000));
	setTimeout(function() {
		setInterval(that.updateCardTimers, 30 * 60000);
	}, firstInterval);
	setTimeout(that.updateCardTimers, 5000);

	this.updateCard = function(id, details, cb) {
		// if no details given then remove card
		if (!details) {
			return this.removeCard(id, cb);
		}

		that.getCard(id, function(err, card) {
			if (err) {
				return console.error('Cards:db:', err);
			}

			that.readers.forEach(function(reader) {

				try {
					// if card is not on reader or level has changed then remove and add with new level
					if (details && (!reader.cards[id] || reader.cards[id] !== details.level || (details.pattern && details.pattern !== card.pattern))) {
						if (details.level > 1) {
							if (details.pattern) {
								var now = new Date();
								var hour = (now.getHours() * 2) + (now.getMinutes() >= 30 ? 1 : 0);
								var current = (details.pattern.substr(hour, 1) === '#');
								console.log(current ? 'Enabled' : 'Disable', 'card on reader', reader.name, id, details.level);
								reader.add(id, current ? details.level : 1);
							} else {
								console.log('Add card to reader', reader.name, id, details.level);
								reader.add(id, details.level);
							}
						}
					}
				} catch (e) {
					console.error('Reader error:', e);
				}

			});

			db.serialize(function() {
				var isNew = false;
				if (!card) {
					// if level is zero and no card then it was removed
					if (!details.level) {
						return;
					}
					// otherwise insert new record
					console.log('Add card to database', id);
					db.run("INSERT INTO cards (id) VALUES ($id)", {
						$id: id
					}, function(err) {
						if (err) {
							console.error('Cards:db:cards:insert', err);
						}
					});
					card = {
						id: id
					};
					isNew = true;
				}
				// update record with details
				console.log('Update card in database', id);

				// only update level if it is more than 1, to stop a pattern card having its db level removed
				if (details.level > 1) {
					card.level = details.level || card.level || 0;
				}

				card.name = details.name || card.name || 'UNKNOWN';
				card.avatar = details.avatar !== undefined ? details.avatar : (card.avatar || '');
				card.notes = details.notes !== undefined ? details.notes : (card.notes || '');
				card.pattern = details.pattern !== undefined ? details.pattern : (card.pattern || '################################################');

				db.run("UPDATE cards SET level = $level, name = $name, modified = datetime('now'), avatar = $avatar, notes = $notes, pattern = $pattern WHERE id = $id", {
					$id: id,
					$level: card.level,
					$name: card.name,
					$avatar: card.avatar,
					$notes: card.notes,
					$pattern: card.pattern
				}, function(err) {
					if (err) {
						return console.error('Cards:db:cards:update', err);
					}

					if (cb) {
						cb(id, card);
					}

					// get card back from the db and send to everyone as an update
					that.getCard(id, function(err, card) {
						if (!err) {
							that.emit('card', id, card, isNew);
						}
					});

				});
			});
		});
		return that;
	};

	this.removeCard = function(id, cb) {
		that.getCard(id, function(err, card) {
			if (err) {
				return console.error('Cards:db:', err);
			}

			db.serialize(function() {
				console.log('Remove card from database', id);
				db.run("DELETE FROM cards WHERE id = $id", {
					$id: id
				}, function(err) {
					if (err) {
						console.error('Cards:db:', err);
					}
				});
			});
			that.readers.forEach(function(reader) {
				try {
					if (reader.cards[id]) {
						console.log('Remove card from reader', reader.name, id);
						reader.remove(id);
					}
					if (cb) {
						cb(id, card);
					}
				} catch (e) {
					console.error('Reader', reader.name, 'error:', e);
				}
			});
			that.emit('card', id);
		});
		return that;
	};

	this.getCards = function(cb) {
		db.serialize(function() {
			db.all("SELECT id, level, name, modified, avatar, notes, pattern FROM cards", function(err, cardArray) {
				var cards = {};
				if (err) {
					console.error('Cards:db:', err);
				} else {
					cardArray.forEach(function(item) {
						cards[item.id] = item;
					});
				}
				if (cb) {
					cb(err, cards);
				}
			});
		});
		return that;
	};

	that.readers.forEach(function(reader) {

		reader
			.on('close', function() {
				console.error('Reader', reader.name, 'port closed.');
				reader.retryOpen();
			})
			.on('error', function(e) {
				that.addLog({
					reader: reader.name,
					type: 'ERROR',
					desc: 'Reader error ' + e
				});
			})
			.on('reset', function() {
				that.addLog({
					reader: reader.name,
					type: 'RESET',
					desc: 'Reader reset'
				});
			})
			.on('cards', function(readerCards) {
				console.log('Syncing cards between db and reader', reader.name);

				that.getCards(function(err, dbCards) {
					if (err) {
						return console.error(err);
					}

					var id;

					for (id in dbCards) {
						if (!readerCards[id]) {
							console.log('Syncing: Adding card', id, 'to reader', reader.name);
							reader.add(id, dbCards[id].level);
						}
					}

					for (id in readerCards) {
						if (!dbCards[id]) {
							console.log('Syncing: Adding card', id, 'to db from', reader.name);
							that.updateCard(id, {
								level: readerCards[id]
							});
						}
					}

				});

			})
			.on('access', function(id, level) {
				that.addLog({
					reader: reader.name,
					type: 'ACCESS',
					desc: 'Access granted',
					cardid: id,
					level: level
				});
				//that.updateCard(id, {level: level});
			})
			.on('noaccess', function(id, level) {
				that.addLog({
					reader: reader.name,
					type: 'NOACCESS',
					desc: 'Access denied',
					cardid: id,
					level: level
				});
				//that.updateCard(id, {level: level});
			})
			.on('unknown', function(id) {
				that.addLog({
					reader: reader.name,
					type: 'NOACCESS',
					desc: 'Access denied',
					cardid: id,
					level: 0
				});
			})
			.on('add', function(id, level) {
				that.updateCard(id, {
					level: level
				}, function(id, card, isNew) {
					that.addLog({
						reader: reader.name,
						type: isNew ? 'ADDED' : 'UPDATED',
						desc: JSON.stringify(card),
						cardid: id,
						level: card.level
					});
				});
			})
			.on('remove', function(id) {
				that.updateCard(id, {
					level: 0
				}, function(id, card) {
					that.addLog({
						reader: reader.name,
						type: 'REMOVED',
						desc: JSON.stringify(card),
						cardid: id,
						level: card.level
					});
				});
			})
			.on('level', function(level) {
				if (level !== that.level) {
					reader.setLevel(that.level);
				}
			})
			.on('activate', function() {
				//			that.addLog({reader: reader.name, type: 'OPENED', desc: 'Door Unlocked'});
				that.emit('opened', reader.name);
			})
			.on('door', function(state) {
				//			that.addLog({reader: reader.name, type: 'DOOR', desc: state});
				if (state === Reader.DOOR_MANUAL) {
					that.addLog({
						reader: reader.name,
						type: 'DOOR',
						desc: 'Door manually opened'
					});
				}
				that.emit('door', reader.name, state);
			});
	});

	this.activate = function(readerName, loggedInUsername, cb) {
		that.readers.forEach(function(reader) {
			if (reader.name != readerName) {
				return;
			}
			reader.activate(function() {
				that.addLog({
					reader: reader.name,
					type: 'OPENED',
					desc: 'Door opened by ' + loggedInUsername
				});
				if (cb) {
					cb(reader.name, loggedInUsername);
					cb = null;
				}
			});
		});
	};

	this.setLevel = function(level, loggedInUsername, cb) {
		that.level = parseInt(level, 10) || 15;
		that.saveLevel();
		var responses = 0;
		that.readers.forEach(function(reader) {
			reader.setLevel(that.level, function(level) {
				that.addLog({
					reader: reader.name,
					type: 'LEVEL',
					desc: 'Security level changed by ' + loggedInUsername,
					level: level
				});
				responses++;
				if (responses === that.readers.length) {
					if (cb) {
						cb(level, loggedInUsername);
					}
					that.emit('level', that.level);
				}
			});
		});
	};

	that.addLog({
		type: 'STARTUP',
		desc: 'Server started'
	});
}
util.inherits(Cards, EventEmitter);

module.exports = Cards;