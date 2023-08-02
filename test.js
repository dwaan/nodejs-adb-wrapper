var adb = require('.');

let ip = `192.168.1.108`;
let shield = new adb(ip, {
    path: "/usr/local/bin/adb",
    interval: 1000
});

// Probably not connected yet, will throw error
shield.state().then(({ result, message }) => {
    if (result) console.log("State - Success:", message);
    else console.log("State - Error:", message);
})

// Connected and looped, update is run by default
// so this only needed if you want to run something after
// device is connected
shield.update().then(() => {
    shield.launchApp(`shell adb devices`).then(({ result, message }) => {
        if (result) console.log("Shell - success:", message);
        else console.log("Shell - failed:", message);
    });

    console.log("Manually turn on");
    shield.powerOn().then(({ result, message }) => {
        if (result) console.log("Power on - success:", message);
        else console.log("Power on - failed:", message);

        console.log("Launching existing apps");
        shield.launchApp("com.google.android.youtube.tv").then(({result, message}) => {
            console.log(result, message);

            console.log("Launching non existing apps");
            shield.launchApp("com.apple.atve.androidtv.appletv").then(({result, message}) => {
                console.log(result, message);
            });

        });
    });
});

// Do something when receiving emit
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
            console.info("🚩 Current app", message);
            break;
        case `playback`:
            console.info("🚩 Playback data", message);
            break;

        // Sleep/awake events
        case `awake`:
            console.info("🚩 Device is awake");
            break;
        case `sleep`:
            console.info("🚩 Device is asleep");
            break;

        // Power events
        case `powerOn`:
            console.info("🚩 Turning power on");
            break;
        case `powerOff`:
            console.info("🚩 Turning power off");
            break;
        case `debugPowerOn`:
            console.info("🚩 Turning power on", message, debug);
            break;
        case `debugPowerOff`:
            console.info("🚩 Turning power off", message, debug);
            break;
        case `powerOnStatus`:
            console.info("🚩 Turning power on", message);
            break;
        case `powerOffStatus`:
            console.info("🚩 Turning power off", message);
            break;

        default:
            break;
    }
});