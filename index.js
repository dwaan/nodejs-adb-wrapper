`use strict`;

const { exec, execFile } = require(`child_process`);
const EventEmitter = require(`events`);

class adb extends EventEmitter {
    // App ids
    OTHER_APP_ID = `other`;
    HOME_APP_ID = `home`;

    // Connection values
    DISCONNECTED = 0;
    DEVICE_AUTHORIZING = 1;
    DEVICE_UNAUTHORIZED = 2;
    CONNECTION_REFUSED = 3;
    CONNECTION_RESET = 4;
    TIME_OUT = 5;
    FAILED = 6;
    CONNECTED = 7;

    constructor(ip, config = {}) {
        if (!ip) return;

        super();

        this.ip = ip;
        this.path = config.path || ``;
        this.interval = config.interval || 1000;
        if (this.interval < 1000) this.interval = 1000;
        this.timeout = config.timeout || 1000;
        if (this.timeout < 500) this.timeout = 500;
        this.playbackDelayOff = config.playbackDelayOff || 10000;
        this.retryPowerOn = config.retryPowerOn || 10;

        // Child process
        this.child = [];

        // Var for checking current input
        this.inputUseWindows = true;
        this.inputUseActivities = true;
        this.inputError = false;

        // Device state
        this.connected = this.DISCONNECTED;
        this.isInitilized = false;
        this.isAwake = false;
        this.isPlayback = false;
        this.currentAppID = false;
        this.canUseTail = false;
        this.isOnPowerCycle = false;

        // Timestamp
        this.playbackTimestamp = Date.now();

        // Loop process
        this.loop = false;
    }

    // Helper
    sleep = function (ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
    checkTail = async function () {
        let { result } = await this.adbShell(`tail --help`);
        this.canUseTail = result;
        return this.canUseTail;
    }

    // Adb exec helper
    adb = function (params, id) {
        return new Promise(async (resolve) => {
            this.child[id] = execFile(`${this.path}adb`, params, (error, stdout, stderr) => {
                let message = error ? stderr.trim() : stdout.trim();
                let result = error ? false : true;

                resolve({ result, message: message == `` ? `Timeout` : message});
            }, {
                windowsHide: true
            });

            this.autoKill(id);
        });
    }
    osShell = async function (params, id) {
        return new Promise(async (resolve) => {
            this.child[id] = exec(params, (error, stdout, stderr) => {
                let message = stdout.trim() || stderr.trim();
                let result = error ? false : true;

                resolve({ result, message: message == `` ? `Timeout` : message});
            });

            this.autoKill(id);
        });
    }
    adbShell = async function (params) {
        return await this.adb([`-s`, `${this.ip}`, `shell`, params], params);
    }

    // Connection helper
    check = async function () {
        return await this.adb([`start-server`]);
    }
    connect = async function () {
        if (this.isAwake) return { result: true, message: `` };

        let { result, message } = await this.adb([`connect`, `${this.ip}`]);

        if (result) {
            message = message.toLowerCase();
            if (message.includes(`device still authorizing`)) result = this.DEVICE_AUTHORIZING;
            else if (message.includes(`device unauthorized`)) result = this.DEVICE_UNAUTHORIZED;
            else if (message.includes(`connection refused`)) result = this.CONNECTION_REFUSED;
            else if (message.includes(`connection reset by peer`)) result = this.CONNECTION_RESET;
            else if (message.includes(`operation timed out`)) result = this.TIME_OUT;
            else if (message.includes(`failed to connect`)) result = this.FAILED;
            else if (!message.includes(`already connected`)) result = this.DISCONNECTED;
            else result = this.CONNECTED;
        } else result = this.DISCONNECTED;

        if (this.connected != result || !this.isInitilized) {
            this.connected = result;
            this.emit(this.connected == this.CONNECTED ? `connected` : `disconnected`);
        }

        return { result, message };
    }
    disconnect = function () {
        if (this.loop) clearInterval(this.loop);
        this.kill();
    }
    update = async function (callback) {
        let { result, message } = await this.check();

        if (!result) throw `Can't find ADB executable file`;

        await this.connect();
        await this.state();
        await this.currentApp();
        await this.currentPlayback();
        await this.checkTail();
        this.isInitilized = true;

        this.loop = setInterval(() => {
            Promise.all([
                this.connect(),
                this.state(),
                this.currentApp(),
                this.currentPlayback()
            ]).then(output => {
                if (callback) callback(output);
            });
        }, this.interval);

        return { result, message };
    }

    // Statuses helper
    state = async function () {
        if (!this.connected) return { result: false, message: `Device is not connected` };

        let { result, message } = await this.adbShell(`dumpsys power | grep mHoldingDisplay`);

        message = result ? message.split(`=`) : [];
        result = message.length <= 0 ? false : message[1] === `true` ? true : false;

        if (result != this.isAwake || !this.isInitilized) {
            this.isAwake = result;

            if (!this.isOnPowerCycle) this.emit(this.isAwake ? `awake` : `sleep`);
        }

        return { result, message: message.join(`=`) };
    }
    model = async function () {
        return await this.adbShell(`getprop ro.product.model && getprop ro.product.manufacturer && getprop ro.serialno`);
    }
    currentApp = async function () {
        if (!this.isAwake) return { result: false, message: `Can't determined current app while device is sleeping` };

        let result = false;
        let message = ``;

        if (this.inputUseWindows && !this.inputError) {
            let output = await this.adbShell(`dumpsys window windows | grep -E mFocusedApp`);

            if (output.result) {
                this.inputUseActivities = false;
                this.inputError = false;
            }

            result = output.result;
            message = output.message;
        }


        if (this.inputUseActivities && !this.inputError) {
            let output = await this.adbShell(`dumpsys activity activities | grep ResumedActivity`);

            if (output.result) {
                this.inputUseWindows = false;
                this.inputError = false;
            }

            result = output.result;
            message = output.message;
        }

        if (this.inputUseWindows && this.inputUseActivities) this.inputError = true;
        else if (message == ``) message = this.HOME_APP_ID;
        else if (message) {
            message = message.trim().split(`/`);
            message[0] = message[0].split(` `);
            message[0] = message[0][message[0].length - 1];

            if (message[0] == undefined) message[0] = this.HOME_APP_ID;
            if (message[1] == undefined) message[1] = ``;

            if (
                message[0].toLowerCase().includes(`launcher`) ||
                message[0].toLowerCase().includes(`mainactivity`) ||
                message[0].toLowerCase().includes(`recentstvactivity`)
            ) message = this.HOME_APP_ID;
            else message = message[0];
        }

        if (result || !this.isInitilized) {
            if (this.currentAppID != message) {
                this.currentAppID = message;
                this.emit(`appChange`, this.currentAppID);
            }
        }

        return { result, message: this.currentAppID };
    }
    launchApp = async function (param = ``) {
        let params = param.split(` `);

        if (params[0].toLowerCase() == `shell`) {
            params.splice(0, 1);
            return await this.osShell(params.join(` `), params.join(``));
        } else if (params.length == 1 && param.includes(`.`)) {
            return await this.adbShell(`monkey -p ${param} 1`)
        } else {
            return await this.adbShell(param);
        }
    }
    sendKeycode = async function (keycode = ``) {
        let finalKeycods = ``;
        let keycodes = keycode.split(` `);
        let isShell = false;

        if (keycodes[0].toLowerCase() == `shell`) {
            isShell = true;
            for (let i = 1; i < keycodes.length; i++) finalKeycods += `${keycodes[i]} `;
        } else {
            for (let i = 0; i < keycodes.length; i++) {
                finalKeycods += `input keyevent ${keycodes[i]}`;
                if (i < keycodes.length - 1) finalKeycods += ` && `;
            }
            finalKeycods = `${finalKeycods}`;
        }

        if (isShell) return this.osShell(finalKeycods);
        else return this.adbShell(finalKeycods);
    }
    // TODO: Test on more device
    currentPlayback = async function () {
        if (!this.isAwake) {
            this.isPlayback = false;
            return { result: this.isPlayback, message: `Playback is always off when device is sleeping` };
        }

        let { result, message } = await this.adbShell(`dumpsys media_session | grep -e 'Media button session is' -e 'AlexaMediaPlayerRuntime'`);
        if (this.currentAppID == this.HOME_APP_ID || message.includes(this.currentAppID) || message.includes(`AlexaMediaPlayerRuntime`)) {
            let output = await this.adbShell(`dumpsys media_session | grep 'state=resultState'`);
            if (output.message == ``) output = await this.adbShell(`dumpsys media_session | grep 'state=PlaybackState'`);

            result = output.message == `` ? false : (output.message.includes(`state=3`) ? true : false);
        } else {
            let { message } = await this.adbShell(`dumpsys audio | grep 'player piid:' | grep ' state:'${this.canUseTail ? ` | tail -1` : ``}`);

            if (message === true) result = false;
            else {
                message = message.split(`\n`);
                message = message[message.length - 1].trim();
                result = message.includes(`state:started`) ? true : false;
            }
        }

        if (result) this.playbackTimestamp = Date.now();
        if (this.isPlayback != result || !this.isInitilized) {
            if (Date.now() - this.playbackTimestamp >= this.playbackDelayOff || !this.isPlayback) {
                this.playbackTimestamp = Date.now();
                this.isPlayback = result;
                this.emit(`playback`, this.currentAppID, this.isPlayback);
            }
        }

        return { result, message };
    }

    // Power helper
    power = async function (keycode, isPowerOn = true) {
        let retry = this.retryPowerOn;

        this.isOnPowerCycle = true;

        this.emit(`power${isPowerOn ? `On` : `Off`}`);
        if ((isPowerOn && !this.isAwake) || (!isPowerOn && this.isAwake)) {
            do {
                await this.sendKeycode(keycode || `KEYCODE_POWER`);
                await this.sleep(500);
                await this.state();

                if (isPowerOn) {
                    if (this.isAwake) break;
                    else retry--;
                } else {
                    if (this.isAwake) retry--;
                    else break;
                }
            } while (retry > 0);
        } else {
            retry = 10;
        }

        let result = retry > 0 ? true : false;
        let message = result ? `Success` : `Failed`;
        this.emit(`power${isPowerOn ? `On` : `Off`}${message}`);
        this.emit(`${isPowerOn ? `awake` : `sleep`}`);

        // Emit events
        await this.state();

        if (result) return { result, message };
        else throw message;
    }
    powerOn = async function (keycode) {
        return await this.power(keycode || `KEYCODE_POWER`);
    }
    powerOff = async function (keycode) {
        return await this.power(keycode || `KEYCODE_POWER`, false);
    }

    // Clean up
    autoKill = function (id) {
        if (this.child[id].loop) clearTimeout(this.child[id].loop);
        this.child[id].loop = setTimeout(() => {
            this.child[id].kill();
        }, this.timeout);
    }
    kill = function () {
        this.child.forEach(child => {
            child.kill();
        });
    }
}

module.exports = adb;