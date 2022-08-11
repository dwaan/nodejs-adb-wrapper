var adb = require('../nodejs-adb-wrapper');

let ip = `192.168.1.108`;
let shield = new adb(ip, {
    // path: "/usr/local/bin/adb",
    interval: 2000
});

// Not connected yet will throw error
shield.state().then(({ result, message }) => {
    console.log(result, message);
}).catch(message => {
    console.log(message);
});

// Connected and looped
shield.update().then(() => {
    shield.launchApp(`shell adb devices`).then(({ result, message }) => {
        console.log(result, message);
    });

    shield.powerOn().catch(message => {
        console.log(message);
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
    console.log("Device Connected");
});
shield.on("disconnected", function () {
    console.log("Device Disconnected");
});
shield.on("unauthorized", function () {
    console.log("Device Unauthoried");
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
shield.on("update", function () {
    // console.log(Date());
});