var adb = require('.');

let shield = new adb(`192.168.1.115`, {
    path: "/usr/local/bin/adb",
    interval: 1000,
    keycodePowerOn: `KEYCODE_WAKEUP`,
    keycodePowerOff: `KEYCODE_SLEEP`,
    debug: true
});

// State will fail since device is not connected yet
shield.state().then(output => {
    console.log(`🔴 -`, "State:", output.message);
});

// Running app will fail since device is not connected yet
shield.launchApp("com.google.android.youtube.tv").then(output => {
    console.log(`🔴 -`, output.message);
});

// Function will be run after connected, see on update events
const runAfterConnected = async _ => {
    await shield.powerOn();
    console.log(`💻 - 1`, await shield.launchApp(`shell echo "Hi"`));
    console.log(`💻 - 2`, await shield.launchApp(`shell echo "How are you?"`));
    await shield.sleep(1000);
    console.log(`📱 - 1`, await shield.launchApp(`echo "Hi"`));
    console.log(`📱 - 2`, await shield.launchApp(`echo "How are you?"`));
    console.log(`📱 - 3`, await shield.launchApp("com.google.android.youtube"));
    console.log(`📱 - 4`, await shield.launchApp("ls /sdcard/"));
    await shield.sleep(1000);
    console.log(`⌨️ - 1`, await shield.sendKeycode(`KEYCODE_DPAD_DOWN KEYCODE_DPAD_DOWN KEYCODE_DPAD_DOWN`));
    console.log(`⌨️ - 2`, await shield.sendKeycode(`shell ls`));
    console.log(`⌨️ - 3`, await shield.sendKeycode(`shell echo "Hi"`));
    console.log(`⌨️ - 4`, await shield.sendKeycode(`KEYCODE_HOME`));
    await shield.sleep(1000);
    // await shield.powerOff();
}

// Connecting to device
shield.update();

// Do something when receiving emit
var count = 0;
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
            console.log("🚩 - Device is connected.", message);
            break;
        case `disconnected`:
            console.log("🚩 - Device is not connected.", message);
            break;
        case `authorized`:
            console.info("🚩 - Device is authorized.");
            break;
        case `unauthorized`:
            console.error("🚩 - Device is unauthorized.");
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

        // Power events when triggered using library
        // At the beginning sending power command
        case `powerOn`:
            console.info("🚩 - Power on");
            break;
        case `powerOff`:
            console.info("🚩 - Power off");
            break;
        // While powr command are executed
        case `debugPowerOn`:
            console.info("🚩 - Debug: Power on -", message, debug);
            break;
        case `debugPowerOff`:
            console.info("🚩 - Debug: Power off -", message, debug);
            break;
        // When power command ended
        case `powerOnStatus`:
            console.info("🚩 - Power on:", message);
            break;
        case `powerOffStatus`:
            console.info("🚩 - Power off:", message);
            break;

        default:
            break;
    }
});
