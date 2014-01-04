var fs = require('fs');
var path = require('path');
var crypto = require('crypto');


// Load config
var config = require('./config').load();


// Load Reader
var Reader = require('./Reader');
var reader = new Reader(config);


// Load card database
var Cards = require('./Cards');
var cards = new Cards(config, reader);


// Load push module
var Push = require('./Push');
var push = new Push(config);

cards.on('log', function(item){
	if(item.timestamp) {
 		var timeParts = item.timestamp.split(/[-: ]/);
 		timeParts[1]++;
 		item.ms = Date.UTC.apply(Date, timeParts);
	} else {
		item.ms = Date.now();
	}
	switch(item.type) {
		case 'ACCESS':
		case 'NOACCESS':
		case 'OPENED':
		if(item.cardid) {
			cards.getCard(item.cardid, function(err, card){
				if(card) {
					push.send({item:item, card:card});
				} else {
					push.send({item:item});
				}
			});
		} else {
			push.send({item:item});
		}
	}
});



// Create app server
var connect = require('connect');
var app = connect.createServer(
	connect.logger(),
	connect['static']( path.resolve(__dirname, '..', 'html'))
);


// Create http server
var server;
if(config.ssl) {
	server = require('https').createServer({
		key: fs.readFileSync(config.ssl.key),
		cert: fs.readFileSync(config.ssl.cert)
	}, app);
} else {
	server = require('http').createServer(app);
}


// Listen for sockets
var socketio = require('socket.io');
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
		cards.getLog(30,function(err, items){
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
		socket.authed = (config.users[username] !== undefined && config.users[username].password === password);
		if(!socket.authed) { return socket.emit('noauth'); }
		// set up cookie
		socket.emit('auth', username, userCookie(username));
		loggedInUsername = username;
		init();
	});

	// login request
	socket.on('logout', function () {
		console.log('logout', loggedInUsername);
		// try login
		socket.authed = false;
		socket.emit('noauth');
		loggedInUsername = '';
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
	    cards.updateCard(id, data);
	});

	socket.on('level', function (level) {
		if(!socket.authed) { return socket.emit('noauth'); }
	    cards.setLevel(level,loggedInUsername);
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


// open reader
reader.open();


// start server listening
server.listen(config.port);



