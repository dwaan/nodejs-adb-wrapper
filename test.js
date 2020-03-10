var nvidiaShieldAdb = require('../nvidia-shield-adb');

var shield = new nvidiaShieldAdb('192.168.1.106');

shield.connect();

shield.on('ready', function() {
	this.sleep();
});

shield.on('awake', function(current_app) {
	console.log("TS: Shield awake");
});

shield.on('currentappchange', function(current_app) {
	console.log("TS: Current app -> " + current_app);
	this.stopGetCurrentApp();
});