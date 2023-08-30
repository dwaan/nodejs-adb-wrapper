`use strict`;

const { exec, spawn } = require(`child_process`);
const fs = require('fs');
const crypto = require('crypto');
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
    TIMEOUT = 5;
    FAILED = 6;
    CONNECTED = 7;
    NO_ADB = 8;

    // Lang
    LANG = [
        `Device is not connected.`,
        `Device is authorizing.`,
        `Device is not authorized.`,
        `Connection refused.`,
        `Connection Reset.`,
        `Timeout.`,
        `Failed.`,
        `Connected.`,
        `Can't fine ADB executable file.`
    ];

    constructor(ip, config = {}) {
        if (!ip) return;

        super();

        // Device
        const _ip = ip;
        const _path = config.path || `adb`;

        // Configuration
        const _interval = config.interval < 1000 ? 1000 : config.interval || 1500;
        const _timeout = config.timeout < 500 ? 500 : config.timeout || 500;
        const _playbackDelayOff = config.playbackDelayOff || 10000;
        const _retryPowerOn = config.retryPowerOn || 5;
        const _debug = config.debug || false;

        // Keycode
        const _keycodePowerOn = config.keycodePowerOn || 'KEYCODE_POWER';
        const _keycodePowerOff = config.keycodePowerOff || 'KEYCODE_POWER';

        // Device state
        let _currentAppID = false;
        let _isAwake = false;
        let _isPlayback = false;
        let _isOnPowerCycle = false;
        let _firstRun = true;
        let _canUseTail = false;

        // Var for checking current input
        let _inputUseWindows = true;
        let _inputUseActivities = true;
        let _inputError = false;

        // Timestamp
        let _playbackTimestamp = Date.now();

        // Current class
        const _this = this;

        // Spawn variables
        let _mainProcess = undefined;
        let _osShellProcess = [];
        let _updateIsAlreadyRunning = false;

        //
        // All public and private functions
        //

        // Info, log, error replacement to show only when debug is true
        this.info = (...args) => {
            if (_debug) console.info('🤖 -\x1b[90m', ...args, '\x1b[0m');
        }
        this.log = (...args) => {
            if (_debug) console.log('🤖 -\x1b[37m', ...args, '\x1b[0m');
        }
        this.error = (...args) => {
            if (_debug) console.error('🤖 -\x1b[31m', ...args, '\x1b[0m');
        }

        const _resetChildProcess = _ => {
            _mainProcess = undefined;
            _osShellProcess = [];
        }

        // Async spawn helper with timeout
        const _spawn = command => {
            return new Promise(resolve => {
                const _spawn = spawn(command, {
                    stdio: ['inherit', 'pipe', 'pipe'],
                    encoding: 'utf-8',
                    shell: true
                });
                let timeout = setTimeout(() => {
                    _spawn.kill();
                    resolve('Process killed due to timeout');
                }, _timeout);

                let stdoutData = '';
                let stderrData = '';

                _spawn.stdout.on('data', data => {
                    stdoutData += data.toString();
                });

                _spawn.stderr.on('data', data => {
                    stderrData += data.toString();
                });

                _spawn.on('close', code => {
                    _spawn.kill();
                    clearTimeout(timeout);

                    if (code !== 0) {
                        resolve(`Process exited with code ${code}\n${stderrData}`);
                    } else {
                        resolve(stdoutData.trim());
                    }
                });
            });
        };

        let _checkDevice = null;
        this.checkDevice = async _ => {
            let output = { result: true, message: `Connected to: ${_ip}` };
            let result = await _spawn(`${_path} connect ${_ip}`);

            if (
                result.includes(`Process killed due to timeout`) ||
                result.includes(`Host is down`) ||
                result.includes(`Connection refused`)
            ) {
                _checkDevice = false;
                output.result = false;
                output.message = `Can't connect to: ${_ip}`;
            } else {
                _checkDevice = true;
            }

            return output;
        }
        this.deviceExist = async _ => {
            if (_checkDevice === null) await this.checkDevice();
            return _checkDevice;
        }

        this.closeAdb = () => {
            if (!_mainProcess) {
                this.log('Process not started.');
                return
            }

            this.log('Process close.');
            _mainProcess.stdin.end();
            _resetChildProcess();
        }

        /**
        * Connect to device
        */
        const _connect = async _ => {
            if (!await this.deviceExist()) return { result: false, message: this.LANG[this.DISCONNECTED] };
            if (this.isConnected()) return { result: true, message: '' };

            return new Promise(async resolve => {
                // One time listeners to chech if everything is ok
                const errorListener = error => {
                    this.error('Error starting process:', error.message);

                    removeListeners(`Error message: ${error.message}`);
                    resolve({ result: false, message: `Error message: ${error.message}` });
                }
                const permanentCloseListener = async code => {
                    let message = `Child process exited with code ${code}`;

                    if (code === -2) message = `Can't find ADB executable code ${code}`;
                    else if (code === 0) message = `ADB disconnected code ${code}`;
                    this.error(message);

                    removeListeners(message);
                    _resetChildProcess();

                    if (code !== -2) {
                        _emitUpdate(`connecting`);
                        this.log(`Reconnecting..`);

                        await _sleep(1000);
                        await this.checkDevice();
                        await _connect();
                    }
                }
                const outputListener = data => {
                    const message = data.toString().trim();

                    _emitUpdate(`connected`, message);

                    resolve({ result: true, message: message });
                }
                // Remove all Listener
                const removeListeners = message => {
                    if (_mainProcess) {
                        _mainProcess.off('error', errorListener);

                        if (_mainProcess.stdout) _mainProcess.stdout.off('data', outputListener);
                        if (_mainProcess.stderr) _mainProcess.stderr.off('data', outputListener);

                        _emitUpdate(`disconnected`, message);
                    }
                }

                this.log('Running process:', _path);
                _mainProcess = spawn(_path, [`-s`, `${_ip}`, `shell`]); // Start adb shell

                // Test command to exit from async, exit with true
                _mainProcess.stdin.write(`echo "$(getprop ro.product.model) | $(getprop ro.product.manufacturer) | $(getprop ro.serialno)"\n`);

                _mainProcess.stdout.once('data', outputListener);
                _mainProcess.stderr.once('data', outputListener);

                // Something wrong, exit with false
                _mainProcess.once('error', errorListener);

                // Output when spawn is close
                _mainProcess.on('close', permanentCloseListener);
            });
        }
        this.connect = _connect;
        /**
        * Get the status of device
        */
        this.isConnected = () => _mainProcess === undefined ? false : true;

        let _writeToFile = false;
        const writeToFile = message => {
            const filePath = 'adb.log';

            if (!_writeToFile) {
                // Write data to the file
                fs.writeFile(filePath, message, (err) => {
                    if (err) {
                        console.error('Error writing to the file:', err);
                    }
                    _writeToFile = true;
                });
            } else {
                fs.appendFile(filePath, message, (err) => {
                    if (err) {
                        console.error('Error appending to the file:', err);
                    }
                });
            }
        }
        function generateUniqueId(str) {
            const hash = crypto.createHash('sha256'); // You can choose a different hash algorithm if needed
            hash.update(str);
            return hash.digest('hex');
        }
        /**
        * Run adb shell or shell command
        */
        const _adb = command => {
            if (!this.isConnected()) return { result: false, message: this.LANG[this.DISCONNECTED] };
            // const id = generateUniqueId(command);

            return new Promise(resolve => {
                // Create spawn process if not exist yet
                const process = spawn(_path, [`-s`, `${_ip}`, `shell`]); // Start adb shell

                // Set a timeout for the command processing
                const timeout = setTimeout(_ => output({ result: false, message: _this.LANG[_this.TIMEOUT] }), _timeout);

                // Catch the output
                const output = output => {
                    process.stdin.end();
                    clearTimeout(timeout);
                    resolve(output);
                }
                process.stdout.on('data', data => output({ result: true, message: data.toString().trim() }));
                process.stderr.on('data', data => output({ result: false, message: data.toString().trim() }));
                process.stdin.write(`${command}\n`);
            });
        }
        /**
         * Run OS Shell command(s)
         * @param {string} params - the shell command(s).
         * @param {number} id - executable identifier for autkill process.
         */
        this.osShell = params => {
            const id = generateUniqueId(params);

            return new Promise(async resolve => {
                _osShellProcess[id] = exec(params, (error, stdout, stderr) => {
                    let message = stdout.trim() || stderr.trim();
                    let result = error ? false : true;

                    resolve({ result, message: message == `` ? this.LANG[this.TIMEOUT] : message });
                });

                // Auto kill if process is too long
                if (_osShellProcess[id].timeout) clearTimeout(_osShellProcess[id].timeout);
                _osShellProcess[id].timeout = setTimeout(() => _osShellProcess[id].kill(), _timeout);
            });
        }
        /**
         * Run `adb shell` command(s)
         * @param params - pass one or more `adb shell` commands.
         */
        this.adbShell = async function () {
            let params = "";
            for (let i = 0; i < arguments.length; i++) params += (arguments[i] + (i == arguments.length - 1 ? `` : ` && `));

            // writeToFile(`Run:\n${params}\n\n`);
            const output = await _adb(params);
            // writeToFile(`Result '${params}'':\n${output.result}\n\n`);
            // writeToFile(`Message '${params}':\n${output.message}\n\n---\n\n`);

            return arguments ? output : { result: false, message: '' };
        }

        /**
         * Sleep of x miliseconds
         * @param {number} ms - number in miliseconds to sleep
         */
        const _sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        /**
         * Check if device support tail command
         */
        const _checkTail = async () => {
            const { result } = await this.adbShell(`tail --help`);
            _canUseTail = result;
            return _canUseTail;
        }

        /**
         * Turn on device
         * @param {string} keycode - (optional) ADB keycode for power on/wake up or power off/sleep
         * @param {boolean} isPowerOn - (optional) Set false to check for off condition
         */
        const _power = async (keycode = `KEYCODE_POWER`, isPowerOn = true) => {
            if (!this.isConnected()) return { result: false, message: this.LANG[this.DISCONNECTED] };

            let output = { result: false, message: '' };
            let retry = _retryPowerOn;

            if (!keycode || _isOnPowerCycle) return output;

            _isOnPowerCycle = true;
            this.log(await _state());
            this.log(`Power`, isPowerOn, _isAwake);

            _emitUpdate(`power${isPowerOn ? `On` : `Off`}`);
            if ((isPowerOn && !_isAwake) || (!isPowerOn && _isAwake)) {
                do {
                    await this.sendKeycode(keycode);
                    await _sleep(1000 / 60);
                    await _state(true);

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
            else return await _power(keycode || _keycodePowerOn);
        }
        /**
         * Turn off device
         * @param {string} keycode - (optional) ADB keycode for power off/sleep
         */
        this.powerOff = async keycode => {
            if (!_isAwake) return { result: true, message: `Device already sleep` };
            return await _power(keycode || _keycodePowerOff, false);
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
        const _state = async (forceEmit = false) => {
            const { result, message } = await this.adbShell(`dumpsys power | grep mHoldingDisplay`);
            let output = { result: false, message: `` };

            output = result ? message.split(`=`) : [];
            if (!result || output.length <= 0) return { result: false, message: this.LANG[this.TIMEOUT] };

            const state = output[1] === `true` ? true : false;
            if (forceEmit || state !== _isAwake || _firstRun) {
                const oldIsAwake = _isAwake;
                _isAwake = state;
                if ((_isAwake !== oldIsAwake && (forceEmit || !_isOnPowerCycle)) || _firstRun)
                    _emitUpdate(_isAwake ? `awake` : `sleep`);
            }

            return { result: _isAwake, message: _isAwake ? 'Device is awake' : `Device is sleep` };
        }
        /**
         * Statuses helper
         * @param {boolean} forceEmit - set `true` to force emit the events
        */
        this.state = async forceEmit => {
            if (!this.isConnected()) return { result: false, message: this.LANG[this.DISCONNECTED] };
            if (!_isAwake) return { result: false, message: `Device is sleep` };

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
            let output = { result: false, message: `Current app is undetermined while device is sleep` };
            if (!_isAwake && !_firstRun) return output;

            output.message == ``;

            if (_inputUseWindows && !_inputError) {
                output = await this.adbShell(`dumpsys window windows | grep -E mFocusedApp`);
                if (output.message !== this.LANG[this.TIMEOUT]) _inputUseActivities = false;
            }

            if (_inputUseActivities && !_inputError) {
                output = await this.adbShell(`dumpsys activity activities | grep ResumedActivity`);
                if (output.message !== this.LANG[this.TIMEOUT]) _inputUseWindows = false;
            }

            if (_inputUseWindows && _inputUseActivities) _inputError = true;
            else if (!_inputUseWindows && !_inputUseActivities) _inputUseWindows = _inputUseActivities = true;
            else if (output.message === this.LANG[this.TIMEOUT]) output.message = this.HOME_APP_ID;
            else if (output.message) {
                let messages = output.message.trim().split(`/`);
                let temp = messages[0].split(` `);

                messages[0] = temp[temp.length - 1] || this.HOME_APP_ID;
                messages[1] = messages[1] || ``;

                temp = messages[0].toLowerCase();
                if (temp.includes(`launcher`) || temp.includes(`mainactivity`) || temp.includes(`recentstvactivity`)) output.message = this.HOME_APP_ID;
                else output.message = messages[0];
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
        this.sendKeycode = async (keycode = ``) => {
            const keycodes = keycode.split(` `);
            let finalKeycodes = ``;

            if (keycodes[0].toLowerCase() == `shell`) {
                // It's a shell command becuase it have 'shell' indenfier in the front
                isShell = true;
                for (let i = 1; i < keycodes.length; i++) finalKeycodes += `${keycodes[i]} `;
                return await this.osShell(finalKeycodes);
            } else {
                this.log(`Keycode(s): ${keycodes}`);
                // It's a keycode or combination of keycodes
                for (let i = 0; i < keycodes.length; i++) {
                    finalKeycodes += `input keyevent ${keycodes[i]}`;
                    if (i < keycodes.length - 1) finalKeycodes += ` && `;
                }
                finalKeycodes = `${finalKeycodes}`;
                await this.adbShell(finalKeycodes); // input keyevent doesn't output anything
                return { result: true, message: keycode };
            }
        }

        /**
         * Launch app based on their id or run adb shell command or run OS shell command
         * @param {string} param - app id, or adb shell command, or os shell command(s) with `shell` identifier at the beginning.
         */
        this.launchApp = async param => {
            let output = { result: false, message: `` };

            // Check if the device is awake, if not wake it
            if (!_isAwake && !param.startsWith(`shell`)) {
                output = await this.powerOn();

                // If device can't be turned on, exit
                if (!output.result) {
                    output.message = `Unable the lunch: ${param}. ${output.message}`
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
                output = await this.osShell(params.join(` `));
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
        const _getCurrentPlayback = () => {
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

                    let message = `1. Alexa Media: ${values[0].message}\n2. Media: ${values[1].message}\n3. Playback State: ${values[2].message}\n4. Audio State: ${values[3].message}`;
                    let result = ((_currentAppID == this.HOME_APP_ID || values[1].message.includes(_currentAppID) || values[0].message.includes(`AlexaMediaPlayerRuntime`)) && values[2].message.includes(`state=3`)) ? true : values[3].message.includes("state:started") ? true : false;

                    resolve({ result, message });
                });
            });
        }
        const _currentPlayback = async () => {
            let output = { result: false, message: `` };

            if (!_isAwake) output.message = `Playback is off while device is sleep`;
            else output = await _getCurrentPlayback();

            if (output.result) _playbackTimestamp = Date.now();
            if (_isPlayback != output.result || _firstRun) {
                if (Date.now() - _playbackTimestamp >= _playbackDelayOff || !_isPlayback || _firstRun) {
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
            return await this.adbShell(`echo "$(getprop ro.product.model) | $(getprop ro.product.manufacturer) | $(getprop ro.serialno)"`);
        }

        /**
         * Run the main loop
         * @param {function} callback - Callback function.
         */
        this.update = async callback => {
            let output = { result: false, message: `` };

            // Only need to run once
            if (_updateIsAlreadyRunning) {
                if (callback) callback(output);
                return output;
            } else _updateIsAlreadyRunning = true;

            this.log(`connect`, await _connect());
            this.log(`checktail`, await _checkTail()); // Only need to run once
            this.log(`state`, await _state());
            this.log(`currentapp`, await _currentApp());
            this.log(`currentplayback`, await _currentPlayback());
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
    }
}

module.exports = adb;