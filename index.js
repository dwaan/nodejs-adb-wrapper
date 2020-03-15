'use strict';

let
	util = require('util'),
	exec = require('child_process').exec,
	EventEmitter = require('events')
;

const
	sleep_command = `dumpsys power | grep mHoldingDisplay | cut -d = -f 2`,
	adb_commands =
		// Screen status, return true is screen is on (awake)
		`${sleep_command} && ` +
		// Current active app, return app name
		`dumpsys window windows | grep -E mFocusedApp | cut -d / -f 1 | cut -d ' ' -f 7l && ` +
		// Current active media app, return app name
		`dumpsys media_session | grep packages | cut -d = -f 3 | head -n 1`
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

// Emit event: 'ready'
nvidiaShieldAdb.prototype.connect = function(nosubscribe = true) {
	exec('adb connect ' + this.ip, (err, stdout, stderr) => {
		if (err && this.debug) {
			console.log("NS: Error while connecting", stderr);
		} else {
			if(nosubscribe) this.subscribe();

			if(this.debug) console.log("NS: Ready");
			this.emit("ready");
		}
	});
}

// Emit event: 'awake', 'sleep', 'currentappchange', 'currentmediaappchange'
nvidiaShieldAdb.prototype.subscribe = function() {
	// Main loop to check Shield status
	this.run_command = () => {
		var command = (this.is_sleep == true)? sleep_command: adb_commands;

		// Send command in one batch to reduce execution
		exec(`adb shell "${command}"`, (err, stdout, stderr) => {
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
				if(output[1] != undefined && (!this.prev_current_app || this.prev_current_app != output[1])) {
					this.prev_current_app = output[1];
					if(this.debug) console.log("NS: Current APP changed ->", this.prev_current_app);
					this.emit("currentappchange", this.prev_current_app);
				}

				// Emit current media app status
				if(output[2] != undefined && (!this.prev_media_current_app || this.prev_media_current_app != output[2])) {
					this.prev_media_current_app = output[2];
					if(this.debug) console.log("NS: Current Media APP changed ->", this.prev_media_current_app);
					this.emit("currentmediaappchange", this.prev_media_current_app);
				}
			}
		});
	}
	this.run_command();
	clearInterval(this.main_loop);
	this.main_loop = setInterval(this.run_command, this.interval);
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

nvidiaShieldAdb.prototype.status = function(callback) {
	exec(`adb shell "${sleep_command}"`, (err, stdout, stderr) => {
		var output = stdout.trim();

		if (output == 'true') this.is_sleep = false;
		else this.is_sleep = true;

		if(callback) callback(!this.is_sleep);
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