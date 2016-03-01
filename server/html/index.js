'use strict';

/*global io*/

window.onload = function() {

	var login = document.getElementById('login');
	var username = document.getElementById('username');
	var password = document.getElementById('password');
	var loginBtn = document.getElementById('loginBtn');
	var logoutBtn = document.getElementById('logoutBtn');

	var addBtn = document.getElementById('addBtn');
	var currentLevel = document.getElementById('currentLevel');
	var openBtns = document.getElementById('openBtns');

	addBtn.disabled = true;
	currentLevel.disabled = true;

	// connect socket and listen to events
	var socket = io.connect();
	window.socket = socket;

	var cardCache = {};
	var readers = [];

	socket.on('connect', function() {
		var username = sessionStorage.getItem('username');
		var cookie = sessionStorage.getItem('cookie');
		socket.emit('auth', username, cookie);
	});

	socket.on('auth', function(username, cookie, readers) {
		sessionStorage.setItem('username', username);
		sessionStorage.setItem('cookie', cookie);
		updateReaders(readers);
		addBtn.disabled = false;
		currentLevel.disabled = false;
		hideLogin();
	});

	socket.on('noauth', function() {
		sessionStorage.setItem('username', '');
		sessionStorage.setItem('cookie', '');
		reset();
		showLogin();
		updateReaders();
	});

	socket.on('error', function(err) {
		console.error('API error: ', err);
	});

	socket.on('cards', function(cards) {
		window.app && app.setCards(cards);
	});

	socket.on('card', function(id, card) {
		if(card) {
			window.app && app.updateCard(id, card);
		} else {
			window.app && app.deleteCard(id);			
		}
	});

	socket.on('logs', function(items) {
		window.app && app.setLogs(items);
	});

	socket.on('log', function(item) {
		window.app && app.addLog(item);
	});

	socket.on('level', function(level) {
		currentLevel.value = level;
	});

	socket.on('door', function(readerName, doorState) {
		updateReaderBtn(readerName, doorState);
	});

	var authing = false;

	function reset() {
		window.app && app.setCards({});
		window.app && app.setLogs([]);
		addBtn.disabled = true;
	}

	function updateReaders(newReaders) {
		readers = {};
		openBtns.innerHTML = '';
		if(!newReaders) { return; }
		for(var i=0; i < newReaders.length; i++) {
			(function(reader) {
				readers[reader.name] = reader;
				reader.id = reader.name.replace(/[^A-Za-z0-9]/g,'_');
				var button = document.createElement('button');
				button.id = 'openBtn' + reader.id;
				button.textContent = 'Open ' + reader.name;
				openBtns.appendChild(button);

				button.onclick = function() {
					if (confirm('Are you sure you want to open the '+reader.name+' door?')) {
						console.log('Open', reader.name);
						socket.emit('open', reader.name);
					}
				};

				updateReaderBtn(reader);
			})(newReaders[i]);
		}
	}

	function updateReaderBtn(reader, doorState) {
		if(typeof reader === 'string') {
			reader = readers[reader];
		}
		if(!reader) { return; }
		if(doorState) {
			reader.door = doorState;			
		}
		var btn = document.getElementById('openBtn' + reader.id);
		if(!btn) { return; }
		switch(reader.door) {
			case 'Door Opened':
				btn.className = 'doorOpened';
				break;
			case 'Manually Opened':
				btn.className = 'manuallyOpened';
				break;
			case 'Door Closed':
			default:
				btn.className = '';
		}
	}



	function showLogin() {
		if (authing) {
			return;
		}
		authing = true;
		console.log('Auth required');

		username.value = sessionStorage.getItem('username');
		password.value = '';

		login.style.display = 'block';

		function doLogin() {
			socket.emit('login', username.value.toLowerCase(), password.value);
		}
		loginBtn.onclick = doLogin;
		username.onkeypress = password.onkeypress = function(e) {
			var code = e.keyCode ? e.keyCode : e.which;
			if (code === 13) {
				if (!username.value) {
					username.focus();
				} else if (!password.value) {
					password.focus();
				} else {
					doLogin();
				}
				e.preventDefault();
			}
		};

		if (username.value) {
			password.focus();
		} else {
			username.focus();
		}
	}

	function hideLogin() {
		authing = false;
		login.style.display = 'none';
	}

	addBtn.onclick = function() {
		window.app && app.handleNewCard();
	};

	currentLevel.onchange = function() {
		var newLevel = currentLevel.value;
		console.log('Change level:', newLevel);
		socket.emit('level', newLevel);
	};

	logoutBtn.onclick = function() {
		console.log('Logout');
		socket.emit('logout');
	};


	reset();
	showLogin();
};