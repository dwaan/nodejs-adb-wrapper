'use strict';

let
	util = require('util'),
	exec = require('child_process').exec,
	EventEmitter = require('events')
;

// Emit event: 'ready'
var nvidiaShieldAdb = module.exports = function(ip) {
	EventEmitter.call(this);

	if (!ip) {
		console.log("NS: Please provide NVIDIA Shield IP");
		process.exit();
	} else {
		this.ip = ip;
		console.log("NS: Connecting to " + this.ip);
		exec('adb connect ' + this.ip, (err, stdout, stderr) => {
			if (err) {
				console.log("NS: Error while connecting", stderr);
			} else {
				console.log("NS: " + stdout);
				this.emit("ready");
			}
		});
	}
}
util.inherits(nvidiaShieldAdb, EventEmitter);

nvidiaShieldAdb.prototype.checkConnection = function() {
	if(!this.ip) {
		console.log("NS: Please connect to NVIDA Shield first");
		process.exit();
	}
}

nvidiaShieldAdb.prototype.disconnect = function() {
	exec('adb disconnect ' + this.ip, (err, stdout, stderr) => {
		if (err) {
			console.log("NS: Error while connecting", stderr);
		} else {
			console.log("NS: " + stdout);
		}
	});
}

// Emit event: 'awake'
nvidiaShieldAdb.prototype.wake = function(callback) {
	this.checkConnection();
	exec('adb shell input keyevent KEYCODE_WAKEUP', (err, stdout, stderr) => {
		if (err) {
			console.log("NS: Error while waking up NVIDIA Shield", stderr);
		} else {
			console.log("NS: NVIDIA Shiled -> Awake");
			this.emit("awake");
		}

		if(callback) callback();
	})
}

// Emit event: 'sleep'
nvidiaShieldAdb.prototype.sleep = function(callback) {
	this.checkConnection();
	exec('adb shell input keyevent KEYCODE_SLEEP', (err, stdout, stderr) => {
		if (err) {
			console.log("NS: Error while sleeping up NVIDIA Shield", stderr);
		} else {
			console.log("NS: NVIDIA Shiled -> Sleep");
			this.emit("sleep");
		}

		if(callback) callback();
	})
}

// Emit event: 'sentkey'
nvidiaShieldAdb.prototype.sendKey = function(key, callback) {
	this.checkConnection();
	exec('adb shell input keyevent ' + key, (err, stdout, stderr) => {
		if (err) {
			console.log("NS: " + key + " -> Not Sent", stderr);
		} else {
			console.log("NS: " + key + " -> Sent");
			this.emit("keysent");
		}

		if(callback) callback();
	})
}

// Emit event: 'gotcurrentapp'
nvidiaShieldAdb.prototype.getCurrentApp = function(callback) {
	this.checkConnection();
	exec('adb shell dumpsys window windows | grep -E mFocusedApp | cut -d / -f 1 | cut -d " " -f 7', (err, stdout, stderr) => {
		if (err) {
			console.log("NS: Error while getting current app info", stderr);
		} else {
			console.log("NS: Current app is -> " + stdout);
			this.emit("gotcurrentapp");
		}

		if(callback) callback(stdout);
	})
}