'use strict';

let
	util = require('util'),
	exec = require('child_process').exec,
	EventEmitter = require('events')
;

var nvidiaShieldAdb = module.exports = function(ip, path = "/sdcard/Scripts/", interval = 1000) {
	EventEmitter.call(this);

	this.path = path;
	this.interval = interval;

	if (!ip) {
		console.log("NS: Please provide NVIDIA Shield IP");
		process.exit();
	} else {
		this.ip = ip;
	}
}
util.inherits(nvidiaShieldAdb, EventEmitter);

// Emit event: 'ready', "awake", "sleep"
nvidiaShieldAdb.prototype.connect = function() {
	exec('adb connect ' + this.ip, (err, stdout, stderr) => {
		if (err) {
			console.log("NS: Error while connecting", stderr);
		} else {
			this.emit("ready");
		}

		// Main loop to check Shield status
		var run_command = () => {
			exec('adb shell dumpsys power | grep mHoldingDisplaySuspendBlocker', (err, stdout, stderr) => {
				if (err) {
					console.log("NS: Error while getting shield status", stderr);
				} else {
					if (stdout.trim() == 'mHoldingDisplaySuspendBlocker=true'){
						if(this.is_sleep) {
							this.emit("awake");
							this.is_sleep = false;
						}
					} else {
						if(!this.is_sleep) {
							this.emit("sleep");
							this.is_sleep = true;
						}
					}
				}
			});
		}
		run_command();
		setInterval(run_command, this.interval);
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

nvidiaShieldAdb.prototype.status = function(callback = function() {}) {
	exec('adb shell sh ' + this.path + 'getcurrentdisplaystatus.sh', (err, stdout, stderr) => {
		if (err) {
			console.log("NS: Error while getting shield status", stderr);
		} else {
			if (stdout.trim() == 'mHoldingDisplaySuspendBlocker=true'){
				callback(true);
			} else {
				callback(false);
			}
		}
	});
}

// Emit event: 'awake' and 'sleep'
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

// Emit event: 'sleep' and 'awake'
nvidiaShieldAdb.prototype.sleep = function(callback) {
	this.checkConnection();
	exec('adb shell input keyevent KEYCODE_SLEEP', (err, stdout, stderr) => {
		if (err) {
			console.log("NS: Error while sleeping up NVIDIA Shield", stderr);
		} else {
			this.emit("sleep");

			if(callback) callback();
		}
	});
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
		exec('adb shell sh ' + this.path + 'getcurrentapp.sh', (err, stdout, stderr) => {
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
	this.current_app_loop = setInterval(run_command, this.interval);
}
nvidiaShieldAdb.prototype.stopGetCurrentApp = function() {
	this.prev_current_app = null;
	clearInterval(this.current_app_loop);
}