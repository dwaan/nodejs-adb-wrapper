var nvidiaShieldAdb = require('../nvidia-shield-adb');

var shield = new nvidiaShieldAdb('192.168.1.106');
shield.on('ready', function() {
	this.getCurrentApp();
});