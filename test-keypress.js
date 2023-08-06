const keypress = require('keypress');
const adb = require('adbkit');

const client = adb.createClient();

// Enable keyboard input
keypress(process.stdin);

let deviceId = undefined;

// Function to execute ADB shell commands
async function executeADBShellCommand(command) {
    if (!deviceId) {
        const device = await client.listDevices();
        if (!device || device.length === 0) {
            console.error('No connected Android device found.');
            return;
        }

        deviceId = device[0].id;
    }

    client.shell(deviceId, command);
}

// Function to send key events to ADB
let firstrun = true
async function sendKeyEvent(keyCode) {
    const command = `input keyevent ${keyCode}`;
    if (firstrun) {
        await executeADBShellCommand(command);
        firstrun = false
    } else executeADBShellCommand(command);
}

// Function to process keyboard input
function processKeyboardInput(ch, key) {
    if (key) {
        switch (key.name) {
            case 'up':
                sendKeyEvent('KEYCODE_DPAD_UP');
                break;
            case 'down':
                sendKeyEvent('KEYCODE_DPAD_DOWN');
                break;
            case 'left':
                sendKeyEvent('KEYCODE_DPAD_LEFT');
                break;
            case 'right':
                sendKeyEvent('KEYCODE_DPAD_RIGHT');
                break;
            case 'return':
                sendKeyEvent('KEYCODE_ENTER');
                break;
            case 'backspace':
                sendKeyEvent('KEYCODE_BACK');
                break;
            case 'space':
                sendKeyEvent('KEYCODE_HOME');
                break;
            case 'escape':
                process.stdin.pause();
                break;
            default:
                console.log('Invalid input! Use arrow keys, press "Enter" to send Enter key, "Backspace" for Android Back, "Space" for Android Home, or press "Escape" to quit.');
                break;
        }
    }
}

// Start listening to keyboard input
console.log('Use arrow keys for Up and Down, Left and Right, press "Enter" to send Enter key, "Backspace" for Android Back, "Space" for Android Home, or press "Escape" to quit.');
process.stdin.on('keypress', processKeyboardInput);
process.stdin.setRawMode(true);
process.stdin.resume();
