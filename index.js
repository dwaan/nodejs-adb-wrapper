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
	}
}
util.inherits(nvidiaShieldAdb, EventEmitter);

nvidiaShieldAdb.prototype.connect = function() {
	exec('adb connect ' + this.ip, (err, stdout, stderr) => {
		if (err) {
			console.log("NS: Error while connecting", stderr);
		} else {
			this.emit("ready");
		}
	});
}

nvidiaShieldAdb.prototype.checkConnection = function() {
	if(!this.ip) {
		console.log("NS: Please connect to NVIDIA Shield first");
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
			this.emit("awake");

			if(callback) callback();
		}
	})
}

// Emit event: 'sleep'
nvidiaShieldAdb.prototype.sleep = function(callback) {
	this.checkConnection();
	exec('adb shell input keyevent KEYCODE_SLEEP', (err, stdout, stderr) => {
		if (err) {
			console.log("NS: Error while sleeping up NVIDIA Shield", stderr);
		} else {
			this.emit("sleep");

			if(callback) callback();
		}
	})
}

// Emit event: 'sentkey'
nvidiaShieldAdb.prototype.sendKey = function(key, callback) {
	this.checkConnection();
	exec('adb shell input keyevent ' + key, (err, stdout, stderr) => {
		if (err) {
			console.log("NS: " + key + " -> Not Sent", stderr);
		} else {
			this.emit("keysent", key);

			if(callback) callback();
		}
	})
}

// Emit event: 'currentappchange'
nvidiaShieldAdb.prototype.getCurrentApp = function(callback) {
	var run_command = () => {
		exec('adb shell dumpsys window windows | grep -E mFocusedApp | cut -d / -f 1 | cut -d " " -f 7', (err, stdout, stderr) => {
			if (err) {
				console.log("NS: Error while getting current app info", stderr);
			} else if(this.prev_current_app == null || this.prev_current_app != stdout.trim()) {
				this.prev_current_app = stdout.trim();
				this.emit("currentappchange", this.prev_current_app);

				if(callback) callback(this.prev_current_app);
			}
		});
	}

	this.checkConnection();

	// so it will run first
	run_command();
	this.current_app_loop = setInterval(run_command, 5000);
}
nvidiaShieldAdb.prototype.stopGetCurrentApp = function() {
	this.prev_current_app = null;
	clearInterval(this.current_app_loop);
}