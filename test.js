var adb = require('.');

let ip = `192.168.1.108`;
let shield = new adb(ip, {
    path: "/usr/local/bin/adb",
    interval: 1000
});

// Probably not connected yet, will output error
shield.state().then(output => {
    console.log(`🔴 -`, "State:", output.message);
});
console.log(`🚀 -`, "1. Launching existing apps");
shield.launchApp("com.google.android.youtube.tv").then(output => {
    console.log(`🔴 -`, output.message);
});

// Function will be run after connected
const runAfterConnected = async () => {
    shield.launchApp(`shell adb devices`).then(output => {
        console.log(`💻 -`, "Shell", output.message);

        console.log(`🚀 -`, "2. Launching existing apps");
        shield.launchApp("com.google.android.youtube.tv").then(output => {
            console.log(`🔴 -`, output.message);

            console.log(`🚀 -`, "Launching non existing apps");
            shield.launchApp("com.nonexisting.app").then(output => {
                console.log(`🔴 -`, output.message);
            });
        });
    });

    console.log("Manually turn on");
    shield.powerOn().then(output => {
        console.log(`📺 -`, "Power:", output.message);
    });
}

// Do something when receiving emit
var count = 0
shield.on(`update`, async (type, message, debug) => {
    switch (type) {
        // Connection events
        case `firstrun`:
            console.log("🚩 - First time device is connected");

            runAfterConnected();

            break;
        case `connecting`:
            console.log("🚩 - Connecting...");
            break;
        case `timeout`:
            console.log("🚩 - Timeout...");
            break;
        case `status`:
            if (count++ == 0) console.info('⚪️ -', Date());
            if (count >= 60) count = 0;
            break;
        case `connected`:
            console.log("🚩 - Device is connected");
            break;
        case `disconnected`:
            console.log("🚩 - Device is not connected");
            break;
        case `authorized`:
            console.info("🚩 - Device is authorized");
            break;
        case `unauthorized`:
            console.error("🚩 - Device is unauthorized");
            break;

        // App events
        case `appChange`:
            console.info("🚩 - Current app", message);
            break;
        case `playback`:
            console.info("🚩 - Playback data", message);
            break;

        // Sleep/awake events
        case `awake`:
            console.info("🚩 - Device is awake");
            break;
        case `sleep`:
            console.info("🚩 - Device is asleep");
            break;

        // Power events
        case `powerOn`:
            console.info("🚩 - Turning power on");
            break;
        case `powerOff`:
            console.info("🚩 - Turning power off");
            break;
        case `debugPowerOn`:
            console.info("🚩 - Turning power on", message, debug);
            break;
        case `debugPowerOff`:
            console.info("🚩 - Turning power off", message, debug);
            break;
        case `powerOnStatus`:
            console.info("🚩 - Turning power on", message);
            break;
        case `powerOffStatus`:
            console.info("🚩 - Turning power off", message);
            break;

        default:
            break;
    }
});