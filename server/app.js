
var config = require('./config');

var crypto = require('crypto');
var http = require('http');
var connect = require('connect');
var socketio = require('socket.io');

var Cards = require('./lib/Cards');
var cards = new Cards(config);

// create app server
var app = connect.createServer(
	connect.logger(),
	connect.static(__dirname + '/html')
);

// create http server
var server = http.createServer(app);

// listen for sockets
var io = socketio.listen(server);

function userCookie(username) {
	if(!config.users[username]) { return null; }
	return crypto.createHmac('sha1', config.secret).update(username+':'+config.users[username]).digest('hex');
}

// listen for connections
io.sockets.on('connection', function (socket) {
	socket.authed = false;

	function init() {
		// get a bunch of logs
		cards.getLog(10,function(err, items){
			if(!err) { socket.emit('logs', items); }
		});

		// return whole database
		cards.getCards(function(err, cards){
			if(!err) { socket.emit('cards', cards); }
		});
	}

	// check auth cookie
	socket.on('auth', function (username, testCookie) {
		var cookie = userCookie(username);
		socket.authed = (testCookie && cookie && testCookie === cookie);
		if(!socket.authed) { return socket.emit('noauth'); }
		socket.emit('auth', username, cookie);
		init();
	});

	// login request
	socket.on('login', function (username, password) {
		// try login
		socket.authed = (config.users[username] !== undefined && config.users[username] === password);
		if(!socket.authed) { return socket.emit('noauth'); }
		// set up cookie
		socket.emit('auth', username, userCookie(username));
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

	cards.on('log', logHandler);
	cards.on('card', cardHandler);

	socket.on('disconnect', function () {
		cards.removeListener('log',logHandler);
		cards.removeListener('card', cardHandler);
	});

	socket.on('card', function (id, data) {
		if(!socket.authed) { return socket.emit('noauth'); }
	    cards.updateCard(id, data);
	});

});


if (!module.parent) {
  server.listen(config.port);
}


