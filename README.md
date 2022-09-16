# Node.JS Android Bridge wrapper

A Node.JS module to connect Android devices using ADB. Example:

## Installation

````bash
npm install nodejs-adb-wrapper --save  # use the library
````

## Example

Check and run [test.js](./test.js) for complete examples

## Options

* **ip** - The device IP (mandatory)
* *config*: JSON object, contains:
  * *path* - Path for adb binary (eq: '/usr/bin/' ), default: ''
  * *interval* - Requests interval in milliseconds, default: 1000
  * *timeout* - Request timeout in milliseconds, default: 1000
  * *playbackDelayOff* - Playback delay before it considered there's no media playing, default: 10000
  * *retryPowerOn* - How many retry before power on request considered failure, default: 10

## Methods

### sleep(ms)

Async helper for waiting in ms  miliseconds

### checkTail()

Check if Android device have `tail` command.

**return**
*boolean*

### adbShell(params)

Wrapper to run ADB command

**parameters**

* **params**: string - the adb command, eg: `dumpsys`

**return**
{ result, message }

* **result**: *boolean* - return true if the command succeded
* **message**: *string* - contain stdout/stderr output

### osShell(params, [id])

Wrapper to run shell command

**parameters**

* **params**: string - the shell command, eg: `dumpsys`
* *id*: string - process id

**return**
{ result, message }

* **result**: *boolean* - return true if the command succeded
* **message**: *string* - contain stdout/stderr output
