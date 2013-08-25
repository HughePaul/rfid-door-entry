var config = require('./config');

var GCM = require('node-gcm');
var gcm = new GCM.Sender(config.push.key);

var sendPush = function(payload){
	var pushTokens = [];
	for (var name in config.users) {
		if(config.users[name].pushToken) {
			pushTokens.push( config.users[name].pushToken );
		}
	}
	if(!pushTokens.length) { return; }

	var message = new GCM.Message({
		collapseKey: ''+Date.now(),
	    delayWhileIdle: false,
	    timeToLive: config.push.expiry || 86400,
		data: payload
	});

	console.error('Push:', JSON.stringify(message), JSON.stringify(pushTokens));
	gcm.sendNoRetry(message, pushTokens, function (err, result) {
		if(err){ console.error('Push error:',err); }
		console.log('Push result:',result);
	});
};


sendPush({msg:'test push message'});

