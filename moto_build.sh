adb connect 192.168.0.33:5555
cordova build
adb install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk

