
window.onload = function(){

	var login = document.getElementById('login');
	var username = document.getElementById('username');
	var password = document.getElementById('password');
	var loginBtn = document.getElementById('loginBtn');

	var logsDiv = document.getElementById('log');
	var cardsDiv = document.getElementById('cards');
	var detailsDiv = document.getElementById('details');
	var addBtn = document.getElementById('addBtn');
	var removeBtn = document.getElementById('removeBtn');
	var currentLevel = document.getElementById('currentLevel');
	var openBtn = document.getElementById('openBtn');

	var cardAvatarImg = document.getElementById('cardavatarimg');
	var cardName = document.getElementById('cardname');
	var cardId = document.getElementById('cardid');
	var cardLevel = document.getElementById('cardlevel');
	var cardAvatar = document.getElementById('cardavatar');
	var cardNotes = document.getElementById('cardnotes');
	var saveBtn = document.getElementById('saveBtn');

	saveBtn.disabled = true;
	removeBtn.disabled = true;
	addBtn.disabled = true;
	currentLevel.disabled = true;
	openBtn.disabled = true;

	// connect socket and listen to events
	var socket = io.connect();

	var cardCache = {};

	socket.on('connect', function () {
		var username = sessionStorage.getItem("username");
		var cookie = sessionStorage.getItem("cookie");
		socket.emit('auth', username, cookie);
	});

	socket.on('auth', function (username, cookie) {
		sessionStorage.setItem("username", username);
		sessionStorage.setItem("cookie", cookie);
		addBtn.disabled = false;
		currentLevel.disabled = false;
		openBtn.disabled = false;
	});

	socket.on('noauth', function () {
		reset();
		showLogin();
	});

	socket.on('error', function (err) {
		console.error('API error: ',err);
	});

	socket.on('cards', function (cards) {
		updateCards(cards);
	});

	socket.on('card', function (id, card) {
		updateCard(id, card);
	});

	socket.on('logs', function (items) {
		appendLogs(items);
	});

	socket.on('log', function (item) {
		appendLog(item);
	});

	socket.on('level', function (level) {
		currentLevel.value = level;
	});

	var currentCardId = '';
	var authing = false;

	function reset() {
		updateDetails(null);
		removeBtn.disabled = true;
		addBtn.disabled = true;
		cardsDiv.innerHTML = '';
	}

	function updateCards(cards) {
		authing = false;
		login.style.display = 'none';
		cardCache = cards;
		cardsDiv.innerHTML = '';
		for(var id in cards) {
			updateCard(id, cards[id]);
		}
		addBtn.disabled = false;
	}

	function updateCard(id, card) {
		// update cache
		if(!card) {
			delete cardCache[id];
		} else {
			cardCache[id] = card;
		}

		// update details display if currently shown
		if(id === currentCardId) {
			updateDetails(id);
		}

		// update card list
		var cardDiv = document.getElementById('card-'+id);
		// if no details then remove the item
		if(!card) {
			if(cardDiv) {
				cardDiv.parentNode.removeChild(cardDiv);
			}
			return;
		}

		// if item doesn't exist then added it, otherwise blank it
		if(!cardDiv) {
			cardDiv = document.createElement('div');
			cardDiv.id = 'card-'+id;
			cardDiv.className = 'card';
			cardDiv.onclick = function() {
				updateDetails(id);
			};
			cardsDiv.insertBefore(cardDiv, cardsDiv.firstChild);
		} else {
			cardDiv.innerHTML = '';
		}
		// update item details
		var avatar = document.createElement('div');
		avatar.className = 'avatar';
		avatar.style.backgroundImage = 'url('+ (card.avatar ? card.avatar : 'img/user.png') +')';
		cardDiv.appendChild(avatar);
		var name = document.createElement('div');
		name.className = 'cardsName';
		name.textContent = card.name;
		cardDiv.appendChild(name);
		var detail = document.createElement('div');
		detail.className = 'cardsDetail';
		detail.textContent = id+' Level '+card.level;
		cardDiv.appendChild(detail);
	}

	function showLogin() {
		if(authing) { return; }
		authing = true;
		console.log('Auth required');

		username.value = sessionStorage.getItem("username");

		login.style.display = 'block';

		function doLogin() {
			socket.emit('login', username.value, password.value);
		}
		loginBtn.onclick = doLogin;
		username.onkeypress = function(e) {
			var code = (e.keyCode ? e.keyCode : e.which);
			if (code === 13) {
				e.preventDefault();
				doLogin();
			}
		};

		username.focus();
	}

	function appendLogs(logs) {
		logsDiv.innerHTML = '';
		for(var i = 0; i < logs.length; i++) {
			appendLog(logs[i]);
		}
	}

	function appendLog(item) {
		console.log(item);
		var log = document.createElement('div');
		log.className = 'log '+item.type;

		var timestamp = document.createElement('span');
		timestamp.className = 'timestamp';
		timestamp.textContent = item.timestamp;
		log.appendChild(timestamp);

		// log type
		var logType = document.createElement('div');
		logType.className = 'type';
		logType.textContent = item.type;
		log.appendChild(logType);

		// cardid and avatar
		var card = cardCache[item.cardid];
		if(card) {
			var avatar = document.createElement('div');
			avatar.className = 'avatar';
			avatar.style.backgroundImage = 'url('+ (card && card.avatar ? card.avatar : 'img/user.png') +')';
			log.appendChild(avatar);

			log.onclick = function() {
				updateDetails(item.cardid);
			};
		}

		// log text
		var logText = document.createElement('div');
		logText.className = 'text';
		log.appendChild(logText);

		var logTextDesc = document.createElement('div');
		logTextDesc.textContent = item.desc;
		logText.appendChild(logTextDesc);

		if(card) {
			var logName = document.createElement('div');
			logName.textContent = (card ? card.name : 'UNKNOWN') + ' (' + item.cardid+' Level:'+item.level+')';
			logText.appendChild(logName);
		}

		// log level
 		if(item.level) {
			var logLevel = document.createElement('div');
			logLevel.textContent = '(Level '+item.level+')';
			logText.appendChild(logLevel);
		}

		// clear floats
		var clear = document.createElement('div');
		clear.className = 'clear';
		log.appendChild(clear);

		// append log entry
		logsDiv.insertBefore(log, logsDiv.firstChild);
	}

	function updateDetails(id, newCard) {
		var card = cardCache[id];
		currentCardId = card ? id : '';

		removeBtn.disabled = !card;

		if(newCard) {
			card = {};
		}

		cardAvatarImg.style.backgroundImage = 'url('+ (card && card.avatar ? card.avatar : 'img/user.png') +')';
		cardId.value = currentCardId;
		cardName.value = card && card.name !== undefined ? card.name : '';
		cardLevel.value = card && card.level !== undefined ? card.level : '7';
		cardAvatar.value = card && card.avatar !== undefined ? card.avatar : '';
		cardNotes.value = card && card.notes !== undefined ? card.notes : '';

		saveBtn.disabled =
		cardId.disabled =
		cardName.disabled =
		cardLevel.disabled =
		cardAvatar.disabled =
		cardNotes.disabled = card ? false : true;
	}

	cardAvatar.onchange = function() {
		cardAvatarImg.style.backgroundImage = 'url('+ (cardAvatar.value ? cardAvatar.value : 'img/user.png') +')';
	};

	saveBtn.onclick = function() {
		if(!currentCardId) {
			currentCardId = cardId.value;
		}
		var card = {
			name: cardName.value,
			id: currentCardId,
			level: cardLevel.value,
			avatar: cardAvatar.value,
			notes: cardNotes.value
		};
		// check details

		// save
		if(currentCardId) {
			console.log('Save:', currentCardId, card);
			socket.emit('card', currentCardId, card);
		}
	};

	removeBtn.onclick = function() {
		if(currentCardId && confirm('Are you sure you want to remove this card?')) {
			console.log('Remove:', currentCardId);
			socket.emit('card', currentCardId);
		}
	};

	addBtn.onclick = function() {
		console.log('Add button');
		updateDetails(null, true);
	};

	openBtn.onclick = function() {
		if(confirm('Are you sure you want to open the door?')) {
			console.log('Open');
			socket.emit('open');
		}
	};

	currentLevel.onchange = function() {
		var newLevel = currentLevel.value;
		console.log('Change level:', newLevel);
		socket.emit('level',newLevel);
	};

	reset();
};

