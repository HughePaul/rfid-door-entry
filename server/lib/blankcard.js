var Reader = require('./Reader');

var reader = new Reader();

reader.open('/dev/tty.PL2303-000012FD');

var toRemove = [];
function removeOne() {
	var id = toRemove.shift();
	if(id) {
		console.log('remove', id);
		reader.remove(id);
		setTimeout(removeOne, 10000);
	}
}

reader.on('cards', function(cards) {
	console.log('cards', cards);
	for(var id in cards) {
		toRemove.push(id);
	}
	removeOne();
});

reader.on('remove', function(id, level) {
	console.log('removed', id, level);
});

reader.on('error', function(err) {
	console.log('error', err);
});

reader.on('notfound', function() {
	console.log('notfound');
});

reader.on('dataout', function(data) {
	console.log('>',data.toString());
});
