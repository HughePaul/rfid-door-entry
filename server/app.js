
var config = require('./config');

var Server = require('./lib/Server');
var server = new Server(config);

var connect = require('connect');
var app = connect()
	.use(connect.logger())
	.use(connect.cookieParser())
	.use(connect.cookieSession({ secret: config.secret, key: 'doorentry.sess', cookie: { maxAge: 60 * 60 * 24 }}))
	.use(connect.json());

// Router
app.method = function(method, url, handler) {
	return this.use(function(req, res, next){
		var p;
		if (method.toUpperCase() !== req.method) { return next(); }
		if(typeof url === 'string' && url === req.url) {
			handler(req, res);
			return;
		}
		if(typeof url === 'object' && (p = url.exec(req.url)) ) {
			req.params = p;
			handler(req, res);
			return;
		}
		return next();
	});
};
app.get = function(url, handler) { return app.method('GET', url, handler); };
app.post = function(url, handler) { return app.method('POST', url, handler); };
app.put = function(url, handler) { return app.method('PUT', url, handler); };



// respond with data
function respond(res, json) {
	if(!json.result) { json.result = 'OK'; }
	res.writeHead(200, {'Content-Type': 'application/json'});
	res.end(JSON.stringify(json));
}


// check auth
function checkAuth(req, res) {
	if(!req.session.auth) {
		respond(res, { status: 'NOAUTH' } );
		return false;
	}
	return true;
}





// Routes

// log in
app.post('/login', function(req, res){
	if(req.body.username && req.body.password && config.users[req.body.username] === req.body.password) {
		req.session.auth = true;
	} else {
		req.session.auth = false;
	}
	respond(res, { status: req.session.auth ? 'OK' : 'NOAUTH' } );
});

// log out
app.post('/logout', function(req, res){
	req.session.auth = false;
	respond(res, { status: 'NOAUTH' } );
});



// get card list
app.get('/list', function(req, res){
	if(checkAuth(req,res)) {
		server.list(function(err, cards) {
			respond(res, { status: err ? 'ERROR' : 'OK', error: err, cards: cards });
		});
	}
});


// update card
app.put(/^\/card\/([0-9-]+)/, function(req, res){
	if(checkAuth(req,res)) {
		var cardId = req.params[1];
		var cardData = req.body;
		server.update(cardId, cardData, function(err) {
			respond(res, { status: err ? 'ERROR' : 'OK', error: err });
		});
	}
});


// view log
app.get(/^\/log(\/([0-9]+))?/, function(req, res){
	if(checkAuth(req, res)) {
		var from = req.params[2] || 0;
		respond(res, { from: from, log: server.getEventLog(from) });
	}
});


// static files
app.use(connect.static(__dirname + '/html'));


if (!module.parent) {
  app.listen(config.port);
}
