var nvidiaShieldAdb = require('../nvidia-shield-adb');

var shield = new nvidiaShieldAdb('192.168.1.106');
shield.on('ready', function() {
	this.getCurrentApp();
});

shield.on('currentappchange', function(current_app) {
	console.log("TS: Current app -> " + current_app);
	// this.stopGetCurrentApp();
});