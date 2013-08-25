var fs = require('fs');
var path = require('path');

module.exports = {
	load: function() {
		return JSON.parse(
			fs.readFileSync(
				path.resolve(__dirname, '..', 'config.json'),
				'utf8'
			)
		);
	},
	save: function(config){
		fs.writeFileSync(
			path.resolve(__dirname, 'config.json'),
			'utf8',
			JSON.stringify(config,null,'    ')
		);
	}
};