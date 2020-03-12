'use strict';

let
	util = require('util'),
	exec = require('child_process').exec,
	EventEmitter = require('events')
;

const adb_commands =
	// Screen status, return true is screen is on (awake)
	"dumpsys power | grep mHoldingDisplaySuspendBlocker | cut -d / -f 1 | cut -d = -f 2 && " +
	// Current active app, return app name
	"dumpsys window windows | grep -E mFocusedApp | cut -d / -f 1 | cut -d ' ' -f 7l && " +
	// Current active media app, return app name
	"dumpsys media_session | grep packages | cut -d = -f 3 | head -n 1"
;

var nvidiaShieldAdb = module.exports = function(ip, interval = 2500) {
	EventEmitter.call(this);

	this.interval = interval;

	if (!ip) {
		console.log("NS: Please provide NVIDIA Shield IP");
		process.exit();
	} else {
		this.ip = ip;
	}
}
util.inherits(nvidiaShieldAdb, EventEmitter);
nvidiaShieldAdb.debug = false;

// Emit event: 'ready', 'awake', 'sleep', 'currentappchange', 'currentmediaappchange'
nvidiaShieldAdb.prototype.connect = function() {
	exec('adb connect ' + this.ip, (err, stdout, stderr) => {
		if (err && this.debug) {
			console.log("NS: Error while connecting", stderr);
		} else {
			// Main loop to check Shield status
			var run_command = () => {
				// Send command in one batch to reduce execution
				exec(`adb shell "${adb_commands}"`, (err, stdout, stderr) => {
					if (err) {
						if(this.debug) console.log("NS: Reconnecting", stderr);
						if(stderr.trim() == "error: no devices/emulators found") this.connect();
					} else {
						// [0]: Screen status
						// [1]: Current active app
						// [2]: Current active media app
						var output = stdout.trim().split("\n");

						// Emit awake status
						if (output[0] == 'true'){
							if(this.is_sleep == undefined || this.is_sleep) {
								if(this.debug) console.log("NS: Awake");
								this.is_sleep = false;
								this.emit("awake");
							}
						} else {
							if(this.is_sleep == undefined || !this.is_sleep) {
								if(this.debug) console.log("NS: Sleep");
								this.is_sleep = true;
								this.emit("sleep");
							}
						}

						// Emit current app status
						if(!this.prev_current_app || this.prev_current_app != output[1]) {
							this.prev_current_app = output[1];
							if(this.debug) console.log("NS: Current APP changed ->", this.prev_current_app);
							this.emit("currentappchange", this.prev_current_app);
						}

						// Emit current media app status
						if(!this.prev_media_current_app || this.prev_media_current_app != output[2]) {
							this.prev_media_current_app = output[2];
							if(this.debug) console.log("NS: Current Media APP changed ->", this.prev_media_current_app);
							this.emit("currentmediaappchange", this.prev_media_current_app);
						}
					}
				});
			}
			run_command();
			clearInterval(this.main_loop);
			this.main_loop = setInterval(run_command, this.interval);

			if(this.debug) console.log("NS: Ready");
			this.emit("ready");
		}
	});
}

nvidiaShieldAdb.prototype.checkConnection = function() {
	if(!this.ip) {
		if(this.debug) console.log("NS: Please connect to NVIDIA Shield first");
		process.exit();
	}

	if(this.debug) console.log("NS: Connection ready");
}

nvidiaShieldAdb.prototype.disconnect = function() {
	exec('adb disconnect ' + this.ip, (err, stdout, stderr) => {
		if (err) {
			if(this.debug) console.log("NS: Error while disconnecting", stderr);
		} else {
			if(this.debug) console.log("NS: " + stdout);
		}
	});
}

nvidiaShieldAdb.prototype.status = function(callback = function() {}) {
	exec(`adb shell "dumpsys power | grep mHoldingDisplaySuspendBlocker | cut -d / -f 1 | cut -d = -f 2"`, (err, stdout, stderr) => {
		var output = stdout.trim();

		console.log(output);
		if (output == 'true') this.is_sleep = false;
		else this.is_sleep = true;

		callback(!this.is_sleep);
	});
}

// Emit event: 'awake' and 'sleep'
nvidiaShieldAdb.prototype.wake = function(callback) {
	this.checkConnection();
	exec('adb shell "input keyevent KEYCODE_WAKEUP"', (err, stdout, stderr) => {
		if (err) {
			if(this.debug) console.log("NS: Reconnecting");
			if (stderr.trim() == "error: no devices/emulators found") this.connect();
		} else {
			this.emit("awake");

			if(callback) callback();
		}
	})
}

// Emit event: 'sleep' and 'awake'
nvidiaShieldAdb.prototype.sleep = function(callback) {
	this.checkConnection();
	exec('adb shell "input keyevent KEYCODE_SLEEP"', (err, stdout, stderr) => {
		if (err) {
			if(this.debug) console.log("NS: Reconnecting");
			if (stderr.trim() == "error: no devices/emulators found") this.connect();
		} else {
			this.emit("sleep");

			if(callback) callback();
		}
	});
}

// Emit event: 'sentkey'
nvidiaShieldAdb.prototype.sendKey = function(key, callback) {
	this.checkConnection();
	exec('adb shell "input keyevent ' + key + '"', (err, stdout, stderr) => {
		if (err) {
			if(this.debug) console.log("NS: Reconnecting");
			if (stderr.trim() == "error: no devices/emulators found") this.connect();
		} else {
			this.emit("keysent", key);

			if(callback) callback();
		}
	})
}