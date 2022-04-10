# Node.JS Android Bridge wrapper

A Node.JS module to connect Android devices using ADB. Example:

## Installation

````bash
npm install nodejs-adb-wrapper --save  # use the library
````

## Example

To wake a machine with a given mac address do:

```javascript
var adb = require('nodejs-adb-wrapper');

let shield = new adb(`192.168.1.108`);
shield.update().then(() => {
    shield.powerOn();
    shield.launchApp(`shell adb version`).then(({ result, message }) => {
        console.log(result, message);
    });
}).catch(message => {
    console.log(message);
});

shield.on("powerOn", function () {
    console.log("Starting Power On");
});
shield.on("powerOnSuccess", function () {
    console.log("Power On Success");
});
shield.on("powerOnFailed", function () {
    console.log("Power On Failed");
});

shield.on("connected", function () {
    console.log("Connected");
});
shield.on("disconnected", function () {
    console.log("Disconnected");
});

shield.on("awake", function () {
    console.log("Awake");
});
shield.on("sleep", function () {
    console.log("Sleep");
});

shield.on("appChange", function () {
    console.log("App change to:", this.currentAppID);
});
shield.on("playback", function () {
    console.log("Playback:", this.isPlayback);
});
```

## Options

* **ip** - The device IP (mandatory)
* *config*: JSON object, contains:
  * *path* - Path for adb binary (eq: '/usr/bin/' ), default: ''
  * *interval* - Requests interval in milliseconds, default: 1000
  * *timeout* - Request timeout in milliseconds, default: 1000
  * *playbackDelayOff* - Playback delay before it considered there's no media playing, default: 10000
  * *retryPowerOn* - How many retry before power on request considered failure, default: 10

## Methods

### sleep(ms)

Async helper for waiting in ms  miliseconds

### checkTail()

Check if Android device have `tail` command.

**return**
*boolean*

### adbShell(params)

Wrapper to run ADB command

**parameters**

* **params**: string - the adb command, eg: `dumpsys`

**return**
{ result, message }

* **result**: *boolean* - return true if the command succeded
* **message**: *string* - contain stdout/stderr output

### osShell(params, [id])

Wrapper to run shell command

**parameters**

* **params**: string - the shell command, eg: `dumpsys`
* *id*: string - process id

**return**
{ result, message }

* **result**: *boolean* - return true if the command succeded
* **message**: *string* - contain stdout/stderr output
