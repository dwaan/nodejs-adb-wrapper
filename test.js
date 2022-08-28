var adb = require('../nodejs-adb-wrapper');

let ip = `192.168.1.108`;
let shield = new adb(ip, {
    path: "/usr/local/bin/adb",
    interval: 2000
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

    shield.powerOn().then(({ result, message }) => {
        if (result) console.log("Power on - success:", message);
        else console.log("Power on - failed:", message);

    });
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
    console.log("Device Connected");
});
shield.on("disconnected", function () {
    console.log("Device Disconnected");
});
shield.on("unauthorized", function () {
    console.log("Device Unauthorized");
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
shield.on("playback", function (app, status, ouput) {
    console.log("Playback:", status, app, ouput);
});
var count = 0
shield.on("update", function () {
    if (count++ == 0) console.log(Date());
    if (count >= 10) count = 0;
});