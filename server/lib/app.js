'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

// Load config
var config = require('./config')
	.load();

// Load Reader
var SerialReader = require('./SerialReader');
var DummyReader = require('./DummyReader');
var readers = [];
config.readers.forEach(function(options) {
	if(options.type && options.type.toLowerCase() === 'serial') {
		readers.push(new SerialReader(options));
	} else {
		readers.push(new DummyReader(options));		
	}
});

// Load card database
var Cards = require('./Cards');
var cards = new Cards(config, readers);

// Load push module
var Push = require('./Push');
var push = new Push(config);

cards.on('log', function(item) {

	// filter log events to send a push for
	switch (item.type) {
		case 'DOOR':
		case 'ACCESS':
		case 'NOACCESS':
		case 'OPENED':
			break; // continue
		default:
			return; // abort
	}

	// build array of tokens to push to
	var pushTokens = [];
	config.users.forEach( (user) => {
		// single token
		if (user.pushToken) {
			pushTokens.push(user.pushToken);
		}
		// array of tokens
		if (user.pushTokens) {
			pushTokens = pushTokens.concat(user.pushTokens);
		}
	});

	// abort if there are no tokens
	if (!pushTokens.length) {
		return;
	}

	// convert text timestamp into ms epoch datetime
	if (item.timestamp) {
		var timeParts = item.timestamp.split(/[-: ]/);
		timeParts[1]--;
		item.ms = Date.UTC.apply(Date, timeParts);
	} else {
		item.ms = Date.now();
	}

	var payload = {
		item: item
	};

	// if log item has a card id then fetch card from db and send push
	if (item.cardid) {
		cards.getCard(item.cardid, function(err, card) {
			if (card) {
				payload.card = card;
			}
			push.send(payload, pushTokens);
		});
	} else {
		// else push straight away
		push.send(payload, pushTokens);
	}

});

// Create app server
var connect = require('connect');
var app = connect();

app.use(require('morgan')('combined'));

app.use(require('serve-static')(path.resolve(__dirname, '..', 'html')));

// Create http server
var server;
if (config.ssl) {
	server = require('https')
		.createServer({
			key: fs.readFileSync(config.ssl.key),
			cert: fs.readFileSync(config.ssl.cert)
		}, app);
} else {
	server = require('http')
		.Server(app);
}

// Listen for sockets
var socketio = require('socket.io');
var io = socketio.listen(server);

function userCookie(username) {
	if (!config.users[username]) {
		return null;
	}
	return crypto.createHmac('sha1', config.secret)
		.update(username + ':' + config.users[username])
		.digest('hex');
}

// listen for connections
io.sockets.on('connection', function(socket) {
	socket.authed = false;

	var loggedInUsername = '';

	function init() {
		// return whole database
		cards.getCards(function(err, cards) {
			if (!err) {
				socket.emit('cards', cards);
			}
		});
		// get a bunch of logs
		cards.getLog(30, function(err, items) {
			if (!err) {
				socket.emit('logs', items);
			}
		});

		socket.emit('level', cards.level);
	}

	// check auth cookie
	socket.on('auth', function(username, testCookie) {
		console.log('auth', username);
		var cookie = userCookie(username);
		socket.authed = (testCookie && cookie && testCookie === cookie);
		if (!socket.authed) {
			return socket.emit('noauth');
		}
		var readerNames = readers.map(function(reader){
				return { name: reader.name, door: reader.door };
		});
		socket.emit('auth', username, cookie, readerNames);
		loggedInUsername = username;
		init();
	});

	// login request
	socket.on('login', function(username, password) {
		console.log('login', username);
		// try login
		socket.authed = (config.users[username] !== undefined && config.users[username].password === password);
		if (!socket.authed) {
			return socket.emit('noauth', 'badlogin');
		}
		// set up cookie
		var readerNames = readers.map(function(reader){
				return { name: reader.name, door: reader.door };
		});
		socket.emit('auth', username, userCookie(username), readerNames);
		loggedInUsername = username;
		init();
	});

	// login request
	socket.on('logout', function() {
		console.log('logout', loggedInUsername);
		// try login
		socket.authed = false;
		socket.emit('noauth', 'logout');
		loggedInUsername = '';
	});

	var logHandler = function(item) {
		if (socket.authed) {
			socket.emit('log', item);
		}
	};

	var cardHandler = function(id, card) {
		if (socket.authed) {
			socket.emit('card', id, card);
		}
	};

	var levelHandler = function(level) {
		if (socket.authed) {
			socket.emit('level', level);
		}
	};

	var openedHandler = function(readerName, loggedInUsername) {
		if (socket.authed) {
			socket.emit('opened', readerName, loggedInUsername);
		}
	};

	var doorHandler = function(readerName, doorState) {
		if (socket.authed) {
			socket.emit('door', readerName, doorState);
		}
	};

	cards.on('log', logHandler);
	cards.on('card', cardHandler);
	cards.on('level', levelHandler);
	cards.on('opened', openedHandler);
	cards.on('door', doorHandler);

	socket.on('disconnect', function() {
		console.log('disconnect');
		cards.removeListener('log', logHandler);
		cards.removeListener('card', cardHandler);
		cards.removeListener('level', levelHandler);
		cards.removeListener('opened', openedHandler);
		cards.removeListener('door', doorHandler);
	});

	socket.on('card', function(id, data) {
		console.log('card update', id, data);
		if (!socket.authed) {
			return socket.emit('noauth');
		}
		cards.updateCard(id, data);
	});

	socket.on('level', function(level) {
		if (!socket.authed) {
			return socket.emit('noauth');
		}
		cards.setLevel(level, loggedInUsername);
	});
	socket.on('open', function(readerName) {
		if (!socket.authed) {
			return socket.emit('noauth');
		}
		try {
			cards.activate(readerName, loggedInUsername);
		} catch (e) {
			console.error(e);
			socket.emit('error', e.message);
		}
	});

});

// open readers
readers.forEach(function(reader) {
	reader.open();
});

// start server listening
server.listen(config.port);