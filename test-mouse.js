const readline = require('readline');
const adb = require('adbkit');

const client = adb.createClient();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to execute ADB shell commands
async function executeADBShellCommand(command) {
    const device = await client.listDevices();
    if (!device || device.length === 0) {
        console.error('No connected Android device found.');
        return;
    }

    const deviceId = device[0].id;
    client.shell(deviceId, command);
}

// Function to perform mouse movement
async function performMouseMovement(dx, dy) {
    const command = `input touchscreen swipe 0 0 ${dx} ${dy}`;
    await executeADBShellCommand(command);
}

// Function to perform primary click (tap) event
async function performPrimaryClick() {
    const command = 'input tap';
    await executeADBShellCommand(command);
}

// Function to process keyboard input
function processKeyboardInput(input) {
    switch (input) {
        case 'up':
            performMouseMovement(0, -100); // Move mouse up
            break;
        case 'down':
            performMouseMovement(0, 100); // Move mouse down
            break;
        case 'left':
            performMouseMovement(-100, 0); // Move mouse left
            break;
        case 'right':
            performMouseMovement(100, 0); // Move mouse right
            break;
        case 'enter':
            performPrimaryClick(); // Perform primary click (tap)
            break;
        case 'exit':
            rl.close();
            break;
        default:
            console.log('Invalid input! Use arrow keys for mouse movement, press "Enter" to perform primary click, or press "Exit" to quit.');
            break;
    }
}

// Start listening to keyboard input
console.log('Use arrow keys for mouse movement, press "Enter" to perform primary click, or press "Exit" to quit.');
rl.input.on('keypress', (_, key) => {
    if (key) {
        if (key.name === 'up' || key.name === 'down' || key.name === 'left' || key.name === 'right') {
            processKeyboardInput(key.name);
        } else if (key.name === 'return') {
            processKeyboardInput('enter');
        } else if (key.name === 'escape') {
            processKeyboardInput('exit');
        }
    }
});
rl.input.setRawMode(true);
rl.input.resume();
