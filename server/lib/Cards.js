var sqlite3 = require('sqlite3').verbose();

function Cards(database) {
	var that = this;

	var filename = database || ':memory:';

	console.log('Opening database:',filename);
	var db = new sqlite3.Database(filename, function(err) {
		if(err) { return console.error(err); }

		// test database to see if we need to make the table
		db.serialize(function() {
			db.get("SELECT count(id) FROM cards", function(err) {
				// if there was an error then create the table
				if(err) {
					console.log('Creating cards database');
					db.serialize(function() {
						db.run("CREATE TABLE cards (id TEXT, level INTEGER, name TEXT, modified TEXT, avatar TEXT, notes TEXT)", function(err){
							if(err) { return console.error(err); }
							console.log('Cards database created');
						});
					});
				}
			});
		});
	});

	process.on('exit', function(){
		if(db) {
			db.close();
		}
	});


	this.getCard = function(id, cb) {
		db.serialize(function() {
			db.get("SELECT id, level, name, modified, avatar, notes FROM cards WHERE id = $id", { $id: id }, cb);
		});
		return this;
	};

	this.updateCard = function(id, details, cb) {
		this.getCard(id, function(err, card) {
			if(err) { return cb(err); }

			db.serialize(function() {
				if(!card) {
					db.run("INSERT INTO cards (id) VALUES ($id)", { $id: id });
					card = {};
				}
				db.run("UPDATE cards SET level = $level, name = $name, modified = NOW(), avatar = $avatar, notes = $notes) WHERE id = $id", {
					$id: id,
					$level: details.level || card.level || 0,
					$name: details.name || card.name || 'UNKNOWN',
					$avatar: details.avatar || card.avatar || '',
					$notes: details.notes || card.notes || ''
				}, cb);
			});
		});
		return this;
	};

	this.removeCard = function(id, cb) {
		db.serialize(function() {
			db.run("DELETE FROM cards WHERE id = $id", { $id: id }, cb);
		});
		return this;
	};

	this.getCards = function(cb) {
		db.serialize(function() {
			db.all("SELECT id, level, name, modified, avatar, notes FROM cards", { $id: id }, function(err, cardArray) {
				if(err) { return cb(err); }
				var cards = {};
				cardArray.forEach(function(item){
					cards[item.id] = item;
				});
				cb(null, cards);
			});
		});
		return this;
	};

	this.syncCards = function(readerCards, cb) {
		this.getCards(function(err, dbCards){
			if(err) { return cb(err); }
			db.serialize(function() {

				var addCardsToReader = {};
				var id;

				for(id in dbCcards) {
					if(!readeCards[id]) {
						addCardsToReader[id] = dbCards[id].level;
					}
				}

				for(id in readerCards) {
					if(!dbCards[id]) {
						that.updateCard(id, { level: readerCards[id] });
					}
				}

				cb(null, addCardsToReader);
			});

		});
		return this;
	};


}


module.exports = Cards;
