var Reader = require('./lib/Reader');


var r = new Reader();

r.on('error', function(e) {
	console.error('Error:',e);
});

r.on('open', function() {
	console.error('Port opened!');
});

r.on('close', function() {
	console.error('Port closed!');
});

r.on('reset', function(){
	console.log('Reader reset');
});

r.on('access', function(id, level){
	console.log('Access granted for card',id,' level',level);
});

r.on('noaccess', function(id, level){
	console.log('No access for card',id,' level',level);
});

r.on('unknown', function(id){
	console.log('Unknown card',id);
});

r.on('add', function(id, level){
	console.log('Card',id,'added at level',level);
});

r.on('remove', function(id, level){
	console.log('Card',id,'removed from level',level);
});

r.on('level', function(level){
	console.log('Access level is',level);
});

r.on('cards', function(cards){
	console.log('Cards:', cards);
});

// find PL com port
var port;
var devs = require('fs').readdirSync('/dev');
devs.forEach(function(dev){
	if(dev.substr(0,11) === 'tty.PL2303-') {
		port = dev;
	}
});
if(!port) {
	throw new Error('Cannot guess port');
}

// open port
r.open('/dev/'+port);


