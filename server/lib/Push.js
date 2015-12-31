'use strict';

var GCM = require('node-gcm');

class Push {
	constructor(config) {
		this.config = config;

		this.gcm = new GCM.Sender(this.config.push.key);
	}

	send(payload, tokens) {

		var message = new GCM.Message({
			collapseKey: '' + Date.now(),
			delayWhileIdle: false,
			timeToLive: this.config.push.expiry || 86400,
			data: payload
		});

		console.log('Sending push');
		this.gcm.sendNoRetry(message, tokens, (err /*, result */) => {
			if (err) {
				console.error('Push error:', err);
			}
		});
	}
}

module.exports = Push;