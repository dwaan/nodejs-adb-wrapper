# ADB Code


**Screen status**

`adb shell dumpsys power | grep 'mHoldingDisplaySuspendBlocker'`


**Current App**

`adb shell dumpsys window windows | grep -E 'mFocusedApp'| cut -d / -f 1 | cut -d " " -f 7`


## Key events list


**Sleep**

`adb shell input keyevent KEYCODE_SLEEP`


**Wake up**

`adb shell input keyevent KEYCODE_WAKEUP`


**Volume up**

`adb shell input keyevent KEYCODE_VOLUME_UP`


**Volume down**

`adb shell input keyevent KEYCODE_VOLUME_DOWN`


**Enter**

`adb shell input keyevent KEYCODE_ENTER`


**Escape**

`adb shell input keyevent KEYCODE_ESCAPE`


**Back**

`adb shell input keyevent KEYCODE_BACK`


**Home**

`adb shell input keyevent KEYCODE_HOME`


**Next**

`adb shell input keyevent KEYCODE_MEDIA_NEXT`


**Prev**

`adb shell input keyevent KEYCODE_MEDIA_PREV`


**Play/Pause**

`adb shell input keyevent KEYCODE_MEDIA_PLAY_PAUSE`