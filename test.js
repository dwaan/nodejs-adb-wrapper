var nvidiaShieldAdb = require('../nvidia-shield-adb');

var shield = new nvidiaShieldAdb('192.168.1.106', "/sdcard/Scripts/", 2500);

shield.connect();

shield.on('ready', function() {
	console.log("TS: Shield ready");
	this.status((status) => {
		console.log("TS: Shield status -> " + status);
	})
	this.getCurrentApp();
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