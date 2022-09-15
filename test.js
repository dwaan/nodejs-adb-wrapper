var adb = require('../nodejs-adb-wrapper');

let ip = `192.168.1.115`;
let shield = new adb(ip, {
    path: "/usr/local/bin/adb",
    interval: 1000
});

// Not connected yet will throw error
shield.state().then(({ result, message }) => {
    if (result) console.log("State - Success:", message);
    else console.log("State - Error:", message);
})

// Connected and looped
shield.update().then(() => {
    shield.launchApp(`shell adb devices`).then(({ result, message }) => {
        if (result) console.log("Shell - success:", message);
        else console.log("Shell - failed:", message);
    });

    console.log("Manually turn on");
    shield.powerOn(`KEYCODE_WAKEUP`).then(({ result, message }) => {
        if (result) console.log("Power on - success:", message);
        else console.log("Power on - failed:", message);
    });
});

var count = 0
shield.on(`update`, (type, message, debug) => {
    switch (type) {
        // Connection events
        case `connecting`:
            console.log("🚩 Connecting...");
            break;
        case `timeout`:
            console.log("🚩 Timeout...");
            break;
        case `status`:
            if (count++ == 0) console.info(Date());
            if (count >= 60) count = 0;
            break;
        case `connected`:
            console.log("🚩 Device is connected");
            break;
        case `disconnected`:
            console.log("🚩 Device is not connected");
            break;
        case `authorized`:
            console.info("🚩 Device is authorized");
            break;
        case `unauthorized`:
            console.error("🚩 Device is unauthorized");
            break;

        // App events
        case `appChange`:
            console.error("🚩 Current app", message);
            break;
        case `playback`:
            console.error("🚩 Playback data", message);
            break;

        // Sleep/awake events
        case `awake`:
            console.error("🚩 Device is awake");
            break;
        case `sleep`:
            console.error("🚩 Device is asleep");
            break;

        // Power events
        case `powerOn`:
            console.error("🚩 Turning power on");
            break;
        case `powerOff`:
            console.error("🚩 Turning power off");
            break;
        case `debugPowerOn`:
            console.error("🚩 Turning power on", message, debug);
            break;
        case `debugPowerOff`:
            console.error("🚩 Turning power off", message, debug);
            break;
        case `powerOnStatus`:
            console.error("🚩 Turning power on", message);
            break;
        case `powerOffStatus`:
            console.error("🚩 Turning power off", message);
            break;

        default:
            break;
    }
});