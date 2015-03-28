

var senderIds = ["293110872564"];

var formatDate = function(date) {
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var p = function(d, n) {
    n = n || 2;
    d = ''+d;
    while(d.length < n) d = '0' + d;
    return d;
  };
  if(typeof date === 'number') date = new Date(date);
  return days[date.getDay()]+' '+p(date.getHours())+':'+p(date.getMinutes()+':'+p(date.getSeconds()));
};

var playSound = function() {
  var sound = new Audio('bell.mp3');
  sound.play();
};

var registerCallback = function(registrationId) {
  if (chrome.runtime.lastError) {
    // When the registration fails, handle the error and retry the
    // registration later.
    console.log('DoorEntry Registration failed', chrome.runtime.lastError);
    return;
  }

  chrome.storage.local.set({registered: registrationId});

  console.log('DoorEntry Registration succeeded', registrationId);

  sendRegistrationId();
};

var onStartup = function() {
  sendRegistrationId();

  console.log('DoorEntry Startup');
  chrome.storage.local.get("registered", function(result) {
    // If already registered, bail out.
    if (result["registered"]) {
      return;
    }

    chrome.gcm.register(senderIds, registerCallback);
  });
};

var getImage = function(url, callback) {
  if(!url || !url.match(/^https?:\/\//)) return callback(url);
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url);
  xhr.responseType = "blob";
  xhr.onload = function(){
      var img = window.URL.createObjectURL(this.response);
      callback(img);
  };
  xhr.send(null);
}

var onGCMMessage = function(message) {

  var item = message.data.item && JSON.parse(message.data.item) || {};
  var card = message.data.card && JSON.parse(message.data.card) || {};

  console.log('DoorEntry Message received', item, card);

  var icons = {
    ACCESS: 'allow.png',
    NOACCESS: 'deny.png'
  };

  var options = {
    type: 'basic',
    iconUrl: card.avatar || icons[item.type] || 'icon.png',
    title: item.desc,
    message: item.desc,
    eventTime: item.ms,
    contextMessage: formatDate(item.ms),
    buttons: []
  };

  if(item.cardid) {
    options.contextMessage += ' Card ID: ' + item.cardid;
  }

  if(card.id) {
    options.title = card.name;
    options.contextMessage += ' Level: ' + card.level;
  }

  console.log('DoorEntry Notification generated', options);

  getImage(options.iconUrl, function(img) {
    options.iconUrl = img;
    chrome.notifications.create(message.collapseKey, options, function(){
      playSound();
      if(chrome.runtime.lastError) console.error(chrome.runtime.lastError);
    });
  });

};

var sendRegistrationId = function() {
  chrome.storage.local.get("registered", function(result) {
    var regid = result["registered"];
    console.log('DoorEntry Sending registration id', regid);
    chrome.runtime.sendMessage({ subject: 'SetRegistrationId', id: regid });
  });
};

var onMessage = function(msg) {
  console.log('DoorEntry Message', msg);
  if (msg.subject === 'GetRegistrationId') {
    sendRegistrationId();
  }
};

chrome.runtime.onStartup.addListener(onStartup);
chrome.runtime.onInstalled.addListener(onStartup);
chrome.gcm.onMessage.addListener(onGCMMessage);
chrome.runtime.onMessage.addListener(onMessage);


