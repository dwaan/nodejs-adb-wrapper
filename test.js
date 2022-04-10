var adb = require('../nodejs-adb-wrapper');

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