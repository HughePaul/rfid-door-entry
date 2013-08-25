var GCM = require('node-gcm');

function Push(config) {
	var that = this;

	this.config = config;

	this.gcm = new GCM.Sender(this.config.push.key);
}

Push.prototype.send = function(payload){
	var pushTokens = [];
	for (var name in this.config.users) {
		if(this.config.users[name].pushToken) {
			pushTokens.push( this.config.users[name].pushToken );
		}
	}
	if(!pushTokens.length) { return; }

	var message = new GCM.Message({
		collapseKey: ''+Date.now(),
	    delayWhileIdle: false,
	    timeToLive: this.config.push.expiry || 86400,
		data: payload
	});

	console.log('Sending push');
	this.gcm.sendNoRetry(message, pushTokens, function (err, result) {
		if(err){ console.error('Push error:',err); }
	});
};

module.exports = Push;

