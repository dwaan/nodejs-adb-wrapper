var nvidiaShieldAdb = require('../nvidia-shield-adb');

var shield = new nvidiaShieldAdb('192.168.1.106', 2500);

shield.connect();
shield.debug = true;

shield.on('ready', function() {
	console.log("TS: Shield ready");
	this.status((status) => {
		console.log("TS: Shield status -> " + status);
	})

	setTimeout(() => {
		console.log("Put to sleep");
		this.sleep();

		setTimeout(() => {
			console.log("Put to wake up");
			this.wake();
		}, 5000);
	}, 5000);
});

shield.on('awake', function(current_app) {
	console.log("TS: Shield awake");
});

shield.on('sleep', function(current_app) {
	console.log("TS: Shield sleep");
});

shield.on('currentappchange', function(current_app) {
	console.log("TS: Current app -> " + current_app);
});

shield.on('currentmediaappchange', function(current_app) {
	console.log("TS: Current media app -> " + current_app);
});

