
var config = require('./config');

var fs = require('fs');
var crypto = require('crypto');
var connect = require('connect');
var socketio = require('socket.io');

var Cards = require('./lib/Cards');
var cards = new Cards(config);

// create app server
var app = connect.createServer(
//	connect.logger(),
	connect.static(__dirname + '/html')
);

// create http server
var server;
if(config.ssl) {
	server = require('https').createServer({
		key: fs.readFileSync(config.ssl.key),
		cert: fs.readFileSync(config.ssl.cert)
	}, app);
} else {
	server = require('http').createServer(app);
}

// listen for sockets
var io = socketio.listen(server);
io.set('log level', 1);

function userCookie(username) {
	if(!config.users[username]) { return null; }
	return crypto.createHmac('sha1', config.secret).update(username+':'+config.users[username]).digest('hex');
}

// listen for connections
io.sockets.on('connection', function (socket) {
	socket.authed = false;

	var loggedInUsername = '';

	function init() {
		// return whole database
		cards.getCards(function(err, cards){
			if(!err) { socket.emit('cards', cards); }
		});
		// get a bunch of logs
		cards.getLog(10,function(err, items){
			if(!err) { socket.emit('logs', items); }
		});

		socket.emit('level', cards.level);
	}

	// check auth cookie
	socket.on('auth', function (username, testCookie) {
		console.log('auth', username);
		var cookie = userCookie(username);
		socket.authed = (testCookie && cookie && testCookie === cookie);
		if(!socket.authed) { return socket.emit('noauth'); }
		socket.emit('auth', username, cookie);
		loggedInUsername = username;
		init();
	});

	// login request
	socket.on('login', function (username, password) {
		console.log('login', username);
		// try login
		socket.authed = (config.users[username] !== undefined && config.users[username] === password);
		if(!socket.authed) { return socket.emit('noauth'); }
		// set up cookie
		socket.emit('auth', username, userCookie(username));
		loggedInUsername = username;
		init();
	});

	var logHandler = function(item) {
		if(socket.authed) {
			socket.emit('log', item);
		}
	};

	var cardHandler = function(id, card) {
		if(socket.authed) {
			socket.emit('card', id, card);
		}
	};

	var levelHandler = function(level) {
		if(socket.authed) {
			socket.emit('level', level);
		}
	};

	var openedHandler = function() {
		if(socket.authed) {
			socket.emit('opened');
		}
	};

	cards.on('log', logHandler);
	cards.on('card', cardHandler);
	cards.on('level', levelHandler);
	cards.on('opened', openedHandler);

	socket.on('disconnect', function () {
		console.log('disconnect');
		cards.removeListener('log',logHandler);
		cards.removeListener('card', cardHandler);
		cards.removeListener('level', levelHandler);
		cards.removeListener('opened', openedHandler);
	});

	socket.on('card', function (id, data) {
		console.log('card update', id, data);
		if(!socket.authed) { return socket.emit('noauth'); }
	    cards.updateCard(id, data, loggedInUsername);
	});

	socket.on('level', function (level) {
		if(!socket.authed) { return socket.emit('noauth'); }
	    cards.setLevel(level, loggedInUsername);
	});

	socket.on('open', function (level) {
		if(!socket.authed) { return socket.emit('noauth'); }
		try{
		    cards.activate(loggedInUsername);
		} catch(e) {
			console.error(e);
			socket.emit('error',e.message);
		}
	});

});


if (!module.parent) {
  server.listen(config.port);
}


