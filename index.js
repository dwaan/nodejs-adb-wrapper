`use strict`;

const { exec } = require(`child_process`);
const { Adb } = require(`@devicefarmer/adbkit`);
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
    NO_ADB = 8;

    // Lang
    LANG = [
        `Device is not connected`,
        `Device is authorizing`,
        `Device is not authorized`,
        `Connection refused`,
        `Connection Reset`,
        `Timeout`,
        `Failed`,
        `Connected`,
        `Can't fine ADB executable file`
    ];

    constructor(ip, config = {}) {
        if (!ip) return;

        super();

        // Device
        const _ip = ip;
        const _client = Adb.createClient({
            bin: config.path
        });
        let _devices = undefined;
        let _device = undefined;

        // Configuration
        const _interval = config.interval < 1000 ? 1000 : config.interval || 1500;
        const _timeout = config.timeout < 500 ? 500 : config.timeout || 1500;
        const _playbackDelayOff = config.playbackDelayOff || 10000;
        const _retryPowerOn = config.retryPowerOn || 5;

        // Device state
        let _connected = this.DISCONNECTED;
        let _currentAppID = false;
        let _isAwake = false;
        let _isPlayback = false;
        let _isOnPowerCycle = false;
        let _firstRun = true;
        let _canUseTail = false;

        // Child process
        let _child = [];

        // Var for checking current input
        let _inputUseWindows = true;
        let _inputUseActivities = true;
        let _inputError = false;

        // Timestamp
        let _playbackTimestamp = Date.now();

        // Current class
        const _this = this;

        const disconnectedMessage = { result: '', message: `Device is not connected` };
        const sleepMessage = { result: '', message: `Device is sleep` };


        //
        // All public and private functions
        //

        /**
        * Connect to device
        */
        const _connect = async () => {
            try {
                await _client.connect(_ip);

                _devices = await _client.listDevices();
                const current_device = _devices.filter((obj) => obj.id.includes(_ip))[0];

                _device = _client.getDevice(current_device.id);

                if (!current_device) _connected = this.DISCONNECTED;
                else _connected = this.CONNECTED;
            } catch (err) {
                _connected = this.TIME_OUT;
            }

            return _connected;
        }
        /**
        * Get the status of device
        */
        this.isConnected = () => {
            return _connected === this.CONNECTED ? true : false;
        }

        /**
        * Run adb shell or shell command
        */
        const _adb = async command => {
            let output = { result: false, message: 'Error while sending adb command(s)' };

            if (!command) return output;

            if (!this.isConnected()) {
                const result = await _connect();
                if (result !== this.CONNECTED) {
                    if (result === this.TIME_OUT) output.message = this.LANG[this.TIME_OUT];
                    else if (result === this.DISCONNECTED) output.message = this.LANG[this.DISCONNECTED];
                    return output;
                }
            }

            try {
                const message = await Adb.util.readAll(await _device.shell(command));
                output.result = true;
                output.message = message.toString().trim();
                return output;
            } catch (err) {
                output.message = err.stack;
                return output;
            }
        }
        /**
         * Run OS Shell command(s)
         * @param {string} params - the shell command(s).
         * @param {number} id - executable identifier for autkill process.
         */
        this.osShell = async (params, id) => {
            return new Promise(async (resolve) => {
                _child[id] = exec(params, (error, stdout, stderr) => {
                    let message = stdout.trim() || stderr.trim();
                    let result = error ? false : true;

                    resolve({ result, message: message == `` ? `Timeout` : message });
                });

                _autoKill(id);
            });
        }
        /**
         * Run `adb shell` command(s)
         * @param params - pass one or more `adb shell` commands.
         */
        this.adbShell = async function () {
            let output = { result: false, message: '' };
            let params = "";
            for (let i = 0; i < arguments.length; i++) params += (arguments[i] + (i == arguments.length - 1 ? `` : ` && `));
            return arguments ? await _adb(params) : output;
        }

        /**
         * Sleep of x miliseconds
         * @param {number} ms - number in miliseconds to sleep
         */
        const _sleep = ms => {
            return new Promise((resolve) => {
                setTimeout(resolve, ms);
            });
        }
        /**
         * Check if device support tail command
         */
        const _checkTail = async () => {
            let { result } = await this.adbShell(`tail --help`);
            _canUseTail = result;
            return _canUseTail;
        }

        /**
         * Turn on device
         * @param {string} keycode - (optional) ADB keycode for power on/wake up or power off/sleep
         * @param {boolean} isPowerOn - (optional) Set false to check for off condition
         */
        const _power = async (keycode, isPowerOn = true) => {
            let output = { result: false, message: '' };

            if (!this.isConnected()) {
                const result = await _connect();
                if (result !== this.CONNECTED) {
                    if (result === this.TIME_OUT) output.message = this.LANG[this.TIME_OUT];
                    else if (result === this.DISCONNECTED) output.message = this.LANG[this.DISCONNECTED];
                    return output;
                }
            }

            let retry = _retryPowerOn;

            if (!keycode || _isOnPowerCycle) return output;

            _isOnPowerCycle = true;
            await _state();

            _emitUpdate(`power${isPowerOn ? `On` : `Off`}`);
            if ((isPowerOn && !_isAwake) || (!isPowerOn && _isAwake)) {
                do {
                    await this.sendKeycode(keycode || `KEYCODE_POWER`);
                    await _sleep(100);
                    await _state();

                    _emitUpdate(`debugPower${isPowerOn ? `On` : `Off`}`, { awake: _isAwake }, retry);

                    if (isPowerOn) {
                        if (_isAwake) break;
                        else retry--;
                    } else {
                        if (_isAwake) retry--;
                        else break;
                    }
                } while (retry > 0);
            } else retry = 1;

            output.result = retry > 0 ? true : false;
            output.message = output.result ? `Success` : `Failed`;
            _emitUpdate(`power${isPowerOn ? `On` : `Off`}Status`, output.message);

            // Emit events
            _isOnPowerCycle = false;
            await _state(true);

            return output;
        }
        /**
         * Turn on device
         * @param {string} keycode - (optional) ADB keycode for power on/wake up
         */
        this.powerOn = async keycode => {
            if (_isAwake) return { result: true, message: `Device already awake` };
            return await _power(keycode || `KEYCODE_POWER`);
        }
        /**
         * Turn off device
         * @param {string} keycode - (optional) ADB keycode for power off/sleep
         */
        this.powerOff = async keycode => {
            if (!_isAwake) return { result: true, message: `Device already sleep` };
            return await _power(keycode || `KEYCODE_POWER`, false);
        }
        /**
         * Get power information
         */
        this.getPowerStatus = () => {
            return _isAwake;
        }
        /**
         * Statuses helper
         * @param {boolean} forceEmit - set `true` to force emit the events
        */
        const _state = async forceEmit => {
            let output = { result: false, message: `` };

            const { result, message } = await this.adbShell(`dumpsys power | grep mHoldingDisplay`);
            output = result ? message.split(`=`) : [];
            if (!result || output.length <= 0) return { result: false, message: this.LANG[this.TIME_OUT] };

            forceEmit = forceEmit || false;
            const state = output[1] === `true` ? true : false;
            if (forceEmit || state != _isAwake || _firstRun) {
                const oldIsAwake = _isAwake;
                _isAwake = state;
                if (_isAwake !== oldIsAwake && (forceEmit || !_isOnPowerCycle || _firstRun))
                    _emitUpdate(_isAwake ? `awake` : `sleep`);
            }

            return { result: _isAwake, message: _isAwake ? 'Device is awake' : `Device is sleep` };
        }
        /**
         * Statuses helper
         * @param {boolean} forceEmit - set `true` to force emit the events
        */
        this.state = async forceEmit => {
            if (!this.isConnected()) return disconnectedMessage;
            if (!_isAwake) return sleepMessage;

            return _state(forceEmit);
        }


        // Emiter
        const _emitUpdate = function () {
            if (!arguments[0]) return;

            const type = arguments[0];
            const message = arguments[1] || ``;
            const debugMessage = arguments[2] || ``;

            _this.emit(`update`, type, message, debugMessage);
        }

        /**
         * Get current app
         */
        const _currentApp = async () => {
            let output = { result: false, message: `Can't determined current app while device is sleeping` };
            if (!_isAwake) return output;

            output.message == ``;

            if (_inputUseWindows && !_inputError) {
                output = await this.adbShell(`dumpsys window windows | grep -E mFocusedApp`);
                if (output.message !== ``) _inputError = _inputUseActivities = false;
            }

            if (_inputUseActivities && !_inputError) {
                output = await this.adbShell(`dumpsys activity activities | grep ResumedActivity`);
                if (output.message !== ``) _inputError = _inputUseWindows = false;
            }

            if (_inputUseWindows && _inputUseActivities) _inputError = true;
            else if (output.message == ``) output.message = this.HOME_APP_ID;
            else if (output.message) {
                output.message = output.message.trim().split(`/`);
                output.message[0] = output.message[0].split(` `);
                output.message[0] = output.message[0][output.message[0].length - 1];

                if (output.message[0] == undefined) output.message[0] = this.HOME_APP_ID;
                if (output.message[1] == undefined) output.message[1] = ``;

                if (
                    output.message[0].toLowerCase().includes(`launcher`) ||
                    output.message[0].toLowerCase().includes(`mainactivity`) ||
                    output.message[0].toLowerCase().includes(`recentstvactivity`)
                ) output.message = this.HOME_APP_ID;
                else output.message = output.message[0];
            }

            if ((output.result && _currentAppID != output.message) || _firstRun) {
                _currentAppID = output.message;
                _emitUpdate(`appChange`, _currentAppID);
            }

            output.message = _currentAppID;
            return output;
        }


        /**
         * Get current app id
         */
        this.getCurrentAppId = () => {
            return _currentAppID;
        }

        /**
         * Send keycode(s) or run OS shell command
         * @param {string} keycode - one or more keycodes seperated by space, or os shell command(s) with `shell` identifier at the beginning.
         */
        this.sendKeycode = async keycode => {
            let finalKeycodes = ``;
            let isShell = false;

            keycode = keycode || ``;
            const keycodes = keycode.split(` `);

            if (keycodes[0].toLowerCase() == `shell`) {
                // It's a shell command becuase it have 'shell' indenfier in the front
                isShell = true;
                for (let i = 1; i < keycodes.length; i++) finalKeycodes += `${keycodes[i]} `;
            } else {
                // It's a keycode or combination of keycodes
                for (let i = 0; i < keycodes.length; i++) {
                    finalKeycodes += `input keyevent ${keycodes[i]}`;
                    if (i < keycodes.length - 1) finalKeycodes += ` && `;
                }
                finalKeycodes = `${finalKeycodes}`;
            }

            if (isShell) return this.osShell(finalKeycodes, finalKeycodes);
            else return this.adbShell(finalKeycodes);
        }

        /**
         * Launch app based on their id or run adb shell command or run OS shell command
         * @param {string} param - app id, or adb shell command, or os shell command(s) with `shell` identifier at the beginning.
         */
        this.launchApp = async param => {
            let output = { result: false, message: `` };

            // Check if the device is awake, if not wake it
            if (!_isAwake) {
                output = await this.powerOn();

                // If device can't be turned on, exit
                if (!output.result) {
                    output.message = `Failed to turn on the device, unable the lunch: ${param}`
                    return output;
                }
            }

            if (!_currentAppID) await _currentApp();

            // Check parameters
            param = param.trim() || ``;
            const params = param.split(` `);

            if (params[0].toLowerCase() == `shell`) {
                // Run shell command becuase it have 'shell' indenfier in the front
                params.splice(0, 1);
                output = await this.osShell(params.join(` `), params.join(``));
            } else if (params.length == 1 && param.includes(`.`)) {
                // Lunch app
                output = { result: true, message: `App already launched: ${param}` };

                if (param !== _currentAppID) {
                    // Launch app using monkey
                    output = await this.adbShell(`monkey -p ${param} 10`);

                    if (output.message.includes("monkey aborted")) {
                        output.result = false;
                        output.message = `Failed to launch app: ${param}`;
                    } else {
                        output.result = true;
                        output.message = `App launched: ${param}`;
                    }
                }
            } else {
                // Launch adb shell command(s)
                output = await this.adbShell(param);
            }

            return output;
        }

        // Get playback status
        const _getCurrentPlayback = async () => {
            return new Promise(resolve => {
                Promise.all([
                    this.adbShell(`dumpsys media_session | grep 'AlexaMediaPlayerRuntime'`),
                    this.adbShell(`dumpsys media_session | grep 'Media button session is'`),
                    this.adbShell(`dumpsys media_session | grep 'state=PlaybackState {state=3'`),
                    this.adbShell(`dumpsys audio | grep 'player piid:' | grep ' state:' ${_canUseTail ? '| tail -1' : ''}`)
                ]).then(values => {
                    // Trim audio when tail is not supported
                    values[3].message = values[3].message.trim().split("\n");
                    values[3].message = values[3].message[values[3].message.length - 1].trim();

                    let message = `\n1. Alexa Media: ` + values[0].message + `\n2. Media: ` + values[1].message + `\n3. Playback State: ` + values[2].message + `\n3. Audio State: ` + values[3].message;
                    let result = ((_currentAppID == this.HOME_APP_ID || values[1].message.includes(_currentAppID) || values[0].message.includes(`AlexaMediaPlayerRuntime`)) && values[2].message.includes(`state=3`)) ? true : values[3].message.includes("state:started") ? true : false;

                    resolve({ result, message });
                });
            });
        }
        const _currentPlayback = async () => {
            let output = { result: false, message: `` };

            if (!_isAwake) output.message = `Playback is always off when device is sleeping`;
            else output = await _getCurrentPlayback();

            if (output.result) _playbackTimestamp = Date.now();
            if (_isPlayback != output.result || _firstRun) {
                if (Date.now() - _playbackTimestamp >= _playbackDelayOff || !_isPlayback) {
                    _playbackTimestamp = Date.now();
                    _isPlayback = output.result;
                    _emitUpdate(`playback`, {
                        appId: _currentAppID,
                        playing: _isPlayback
                    }, output.message);
                }
            }

            return output;
        }
        /**
         * Get playback information
         */
        this.getPlaybackStatus = () => {
            return _isPlayback;
        }


        /**
         * Get device information
         */
        this.model = async () => {
            return await this.adbShell(`getprop ro.product.model && getprop ro.product.manufacturer && getprop ro.serialno`);
        }

        /**
         * Run the main loop
         * @param {function} callback - Callback function.
         */
        let _updateIsAlreadyRunning = false;
        this.update = async callback => {
            let output = { result: false, message: `` };

            // Only need to run once
            if (_updateIsAlreadyRunning) {
                if (callback) callback(output);
                return output;
            } else _updateIsAlreadyRunning = true;

            await _connect();
            await _state();
            await _checkTail();
            await _currentApp();
            await _currentPlayback();
            _emitUpdate('firstrun');

            _firstRun = false;

            setInterval(() => {
                Promise.all([
                    _connect(),
                    _state(),
                    _currentApp(),
                    _currentPlayback()
                ]).then(output => {
                    if (callback) callback(output);
                });
                _emitUpdate(`status`);
            }, _interval);

            return output;
        }

        // Clean up
        const _autoKill = id => {
            if (_child[id]._loop) clearTimeout(_child[id]._loop);
            _child[id]._loop = setTimeout(() => {
                _child[id].kill();
            }, _timeout);
        }

        // Run the update
        this.update();
    }
}

module.exports = adb;