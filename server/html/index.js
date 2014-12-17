window.onload = function() {

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

	// checkbox handler
	var patternHolder = document.getElementById('cardPattern');
	var checkboxMouse = false;
	var checkboxValue = false;
	var checkboxDown = function(event) {
		if (event.target.tagName === 'INPUT') {
			checkboxValue = !this.checked;
			this.checked = checkboxValue;
		} else {
			checkboxValue = true;
		}
		checkboxMouse = true;
		event.preventDefault();
	};
	var checkboxOver = function(event) {
		if (checkboxMouse) {
			this.checked = checkboxValue;
		}
	};
	var checkboxUp = function(event) {
		checkboxMouse = false;
		event.preventDefault();
	};
	var checkboxCancel = function(event) {
		checkboxMouse = false;
	};
	var pattern = [];
	for (var i = 0; i < 48; i++) {
		pattern[i] = document.getElementById('cardPattern_' + i);
		pattern[i].addEventListener('mousedown', checkboxDown);
		pattern[i].addEventListener('mouseover', checkboxOver);
		pattern[i].addEventListener('click', checkboxUp);
	}
	patternHolder.addEventListener('mousedown', checkboxDown);
	document.body.addEventListener('mouseup', checkboxCancel);

	var updateCurrentTime = function() {
		var now = new Date();
		var hour = (now.getHours() * 2) + (now.getMinutes() >= 30 ? 1 : 0);
		for (var i = 0; i < 48; i++) {
			pattern[i].className = (i === hour) ? 'currentHour' : '';
		}
	};

	updateCurrentTime();
	setInterval(updateCurrentTime, 60000);

	saveBtn.disabled = true;
	removeBtn.disabled = true;
	addBtn.disabled = true;
	currentLevel.disabled = true;
	openBtn.disabled = true;

	// connect socket and listen to events
	var socket = io.connect(window.location.href);

	var cardCache = {};

	socket.on('connect', function() {
		var username = sessionStorage.getItem("username");
		var cookie = sessionStorage.getItem("cookie");
		socket.emit('auth', username, cookie);
	});

	socket.on('auth', function(username, cookie) {
		sessionStorage.setItem("username", username);
		sessionStorage.setItem("cookie", cookie);
		addBtn.disabled = false;
		currentLevel.disabled = false;
		openBtn.disabled = false;
		hideLogin();
	});

	socket.on('noauth', function() {
		sessionStorage.setItem("username", '');
		sessionStorage.setItem("cookie", '');
		reset();
		showLogin();
	});

	socket.on('error', function(err) {
		console.error('API error: ', err);
	});

	socket.on('cards', function(cards) {
		updateCards(cards);
	});

	socket.on('card', function(id, card) {
		updateCard(id, card);
	});

	socket.on('logs', function(items) {
		appendLogs(items);
	});

	socket.on('log', function(item) {
		appendLog(item);
	});

	socket.on('level', function(level) {
		currentLevel.value = level;
	});

	var currentCardId = '';
	var authing = false;

	function reset() {
		updateDetails();
		removeBtn.disabled = true;
		addBtn.disabled = true;
		cardsDiv.innerHTML = '';
		logsDiv.innerHTML = '';
	}

	function updateCards(cards) {
		authing = false;
		login.style.display = 'none';
		cardCache = cards;
		cardsDiv.innerHTML = '';
		for (var id in cards) {
			updateCard(id, cards[id]);
		}
		addBtn.disabled = false;
	}

	function updateCard(id, card) {
		// update cache
		if (!card) {
			delete cardCache[id];
		} else {
			cardCache[id] = card;
		}

		// update details display if currently shown
		if (id === currentCardId) {
			updateDetails(id);
		}

		// update card list
		var cardDiv = document.getElementById('card-' + id);
		// if no details then remove the item
		if (!card) {
			if (cardDiv) {
				cardDiv.parentNode.removeChild(cardDiv);
			}
			return;
		}

		// if item doesn't exist then added it, otherwise blank it
		if (!cardDiv) {
			cardDiv = document.createElement('div');
			cardDiv.id = 'card-' + id;
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
		avatar.style.backgroundImage = 'url(' + (card.avatar ? card.avatar : 'img/user.png') + ')';
		cardDiv.appendChild(avatar);
		var name = document.createElement('div');
		name.className = 'cardsName';
		name.textContent = card.name;
		cardDiv.appendChild(name);
		var detail = document.createElement('div');
		detail.className = 'cardsDetail';
		detail.textContent = id;
		cardDiv.appendChild(detail);
		detail = document.createElement('div');
		detail.className = 'cardsDetail';
		detail.textContent = 'Level ' + card.level;
		cardDiv.appendChild(detail);

		var clear = document.createElement('div');
		clear.className = 'clear';
		cardDiv.appendChild(clear);
	}

	function showLogin() {
		if (authing) {
			return;
		}
		authing = true;
		console.log('Auth required');

		username.value = sessionStorage.getItem("username");
		password.value = '';

		login.style.display = 'block';

		function doLogin() {
			socket.emit('login', username.value.toLowerCase(), password.value);
		}
		loginBtn.onclick = doLogin;
		username.onkeypress = password.onkeypress = function(e) {
			var code = (e.keyCode ? e.keyCode : e.which);
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

	function appendLogs(logs) {
		logsDiv.innerHTML = '';
		for (var i = 0; i < logs.length; i++) {
			appendLog(logs[i]);
		}
	}

	function appendLog(item) {
		var log = document.createElement('div');
		log.className = 'log ' + item.type;

		var timestamp = document.createElement('span');
		timestamp.className = 'timestamp';
		timestamp.textContent = item.timestamp;
		log.appendChild(timestamp);

		// log type
		var logType = document.createElement('div');
		logType.className = 'type';
		logType.textContent = item.type;
		log.appendChild(logType);

		// log text
		var logText = document.createElement('div');
		logText.className = 'text';

		var card = cardCache[item.cardid];

		if (item.cardid) {
			log.onclick = function() {
				updateDetails(item.cardid);
			};
		}

		if (item.type === 'ADDED' || item.type === 'UPDATED' || item.type === 'REMOVED') {
			try {
				var jsonCard = JSON.parse(item.desc);
				if (jsonCard) {
					card = jsonCard;
				}
			} catch (e) {}
		}

		if (card) {
			var logCard = document.createElement('div');
			logCard.className = 'card';
			logText.appendChild(logCard);

			var avatar = document.createElement('div');
			avatar.className = 'avatar';
			avatar.style.backgroundImage = 'url(' + (card && card.avatar ? card.avatar : 'img/user.png') + ')';
			logCard.appendChild(avatar);

			var logCardName = document.createElement('div');
			logCardName.textContent = (card ? card.name : 'UNKNOWN CARD');
			logCard.appendChild(logCardName);
			var logCardId = document.createElement('div');
			logCardId.textContent = item.cardid;
			logCard.appendChild(logCardId);
			var logCardLevel = document.createElement('div');
			logCardLevel.textContent = 'Level ' + item.level;
			logCard.appendChild(logCardLevel);

			var cardClear = document.createElement('div');
			cardClear.className = 'clear';
			logCard.appendChild(cardClear);
		} else {
			var logTextDesc = document.createElement('div');
			logTextDesc.textContent = item.desc;
			logText.appendChild(logTextDesc);

			// log level
			if (item.level) {
				var logLevel = document.createElement('div');
				logLevel.textContent = 'Level ' + item.level;
				logText.appendChild(logLevel);
			}

		}

		log.appendChild(logText);

		// clear floats
		var clear = document.createElement('div');
		clear.className = 'clear';
		log.appendChild(clear);

		// append log entry
		logsDiv.insertBefore(log, logsDiv.firstChild);
	}

	function updateDetails(id) {

		var disable = id === undefined;

		currentCardId = id || '';

		var card = cardCache[id];
		removeBtn.disabled = !card;

		if (!card && !disable) {
			card = {};
		}

		cardAvatarImg.style.backgroundImage = 'url(' + (card && card.avatar ? card.avatar : 'img/user.png') + ')';
		cardId.value = currentCardId;
		cardName.value = card && card.name !== undefined ? card.name : '';
		cardLevel.value = card && card.level !== undefined ? card.level : currentLevel.value;
		cardAvatar.value = card && card.avatar !== undefined ? card.avatar : '';
		cardNotes.value = card && card.notes !== undefined ? card.notes : '';

		for (var i = 0; i < 48; i++) {
			pattern[i].disabled = disable;
			pattern[i].checked = (!card || card.pattern.substr(i, 1) === '#');
		}

		saveBtn.disabled =
			cardId.disabled =
			cardName.disabled =
			cardLevel.disabled =
			cardAvatar.disabled =
			cardNotes.disabled = disable;
	}

	cardAvatar.onchange = function() {
		cardAvatarImg.style.backgroundImage = 'url(' + (cardAvatar.value ? cardAvatar.value : 'img/user.png') + ')';
	};

	saveBtn.onclick = function() {
		if (!currentCardId) {
			currentCardId = cardId.value;
		}

		var timePattern = '';
		for (var i = 0; i < 48; i++) {
			timePattern += (pattern[i].checked) ? '#' : '-';
		}

		var card = {
			name: cardName.value,
			id: currentCardId,
			level: cardLevel.value,
			avatar: cardAvatar.value,
			notes: cardNotes.value,
			pattern: timePattern
		};
		// check details

		// save
		if (currentCardId) {
			console.log('Save:', currentCardId, card);
			socket.emit('card', currentCardId, card);
		}
	};

	removeBtn.onclick = function() {
		if (currentCardId && confirm('Are you sure you want to remove this card?')) {
			console.log('Remove:', currentCardId);
			socket.emit('card', currentCardId);
		}
	};

	addBtn.onclick = function() {
		console.log('Add button');
		updateDetails(null);
	};

	openBtn.onclick = function() {
		if (confirm('Are you sure you want to open the door?')) {
			console.log('Open');
			socket.emit('open');
		}
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