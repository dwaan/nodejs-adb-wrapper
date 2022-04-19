var adb = require('../nodejs-adb-wrapper');

let shield = new adb(`192.168.1.108`, {
    path: "/usr/local/bin/"
});

// Not connected yet will throw error
shield.state().then(({ result, message }) => {
    console.log(result, message);
}).catch(message => {
    console.log(message);
});

// Connected and looped
shield.update().then(() => {
    shield.powerOn().catch(message => {
        console.log(message);
    });

    // shield.launchApp(`shell adb version`).then(({ result, message }) => {
    //     console.log(result, message)
    // });
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
shield.on("playback", function (app, status) {
    console.log("Playback:", app, status);
});