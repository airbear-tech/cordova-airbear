cordova.define('cordova/plugin_list', function(require, exports, module) {
  module.exports = [
    {
      "id": "cordova-plugin-background-fetch.BackgroundFetch",
      "file": "plugins/cordova-plugin-background-fetch/www/BackgroundFetch.js",
      "pluginId": "cordova-plugin-background-fetch",
      "clobbers": [
        "window.BackgroundFetch"
      ]
    },
    {
      "id": "cordova-background-geolocation-lt.BackgroundGeolocation",
      "file": "plugins/cordova-background-geolocation-lt/www/BackgroundGeolocation.js",
      "pluginId": "cordova-background-geolocation-lt",
      "clobbers": [
        "window.BackgroundGeolocation"
      ]
    },
    {
      "id": "cordova-background-geolocation-lt.API",
      "file": "plugins/cordova-background-geolocation-lt/www/API.js",
      "pluginId": "cordova-background-geolocation-lt"
    },
    {
      "id": "cordova-background-geolocation-lt.DeviceSettings",
      "file": "plugins/cordova-background-geolocation-lt/www/DeviceSettings.js",
      "pluginId": "cordova-background-geolocation-lt"
    },
    {
      "id": "cordova-background-timer.BackgroundTimer",
      "file": "plugins/cordova-background-timer/www/BackgroundTimer.js",
      "pluginId": "cordova-background-timer",
      "clobbers": [
        "window.BackgroundTimer"
      ]
    },
    {
      "id": "cordova-plugin-device.device",
      "file": "plugins/cordova-plugin-device/www/device.js",
      "pluginId": "cordova-plugin-device",
      "clobbers": [
        "device"
      ]
    },
    {
      "id": "cordova-plugin-device.DeviceProxy",
      "file": "plugins/cordova-plugin-device/src/windows/DeviceProxy.js",
      "pluginId": "cordova-plugin-device",
      "runs": true
    },
    {
      "id": "cordova-plugin-background-mode.BackgroundMode",
      "file": "plugins/cordova-plugin-background-mode/www/background-mode.js",
      "pluginId": "cordova-plugin-background-mode",
      "clobbers": [
        "cordova.plugins.backgroundMode",
        "plugin.backgroundMode"
      ]
    },
    {
      "id": "cordova-plugin-geolocation.GeolocationProxy",
      "file": "plugins/cordova-plugin-geolocation/src/windows/GeolocationProxy.js",
      "pluginId": "cordova-plugin-geolocation",
      "runs": true
    },
    {
      "id": "cordova-plugin-geolocation.Coordinates",
      "file": "plugins/cordova-plugin-geolocation/www/Coordinates.js",
      "pluginId": "cordova-plugin-geolocation",
      "clobbers": [
        "Coordinates"
      ]
    },
    {
      "id": "cordova-plugin-geolocation.PositionError",
      "file": "plugins/cordova-plugin-geolocation/www/PositionError.js",
      "pluginId": "cordova-plugin-geolocation",
      "clobbers": [
        "PositionError"
      ]
    },
    {
      "id": "cordova-plugin-geolocation.Position",
      "file": "plugins/cordova-plugin-geolocation/www/Position.js",
      "pluginId": "cordova-plugin-geolocation",
      "clobbers": [
        "Position"
      ]
    },
    {
      "id": "cordova-plugin-geolocation.geolocation",
      "file": "plugins/cordova-plugin-geolocation/www/geolocation.js",
      "pluginId": "cordova-plugin-geolocation",
      "clobbers": [
        "navigator.geolocation"
      ]
    },
    {
      "id": "cordovarduino.Serial",
      "file": "plugins/cordovarduino/www/serial.js",
      "pluginId": "cordovarduino",
      "clobbers": [
        "window.serial"
      ]
    }
  ];
  module.exports.metadata = {
    "cordova-plugin-background-fetch": "5.5.0",
    "cordova-background-geolocation-lt": "3.2.0",
    "cordova-background-timer": "0.0.4",
    "cordova-plugin-device": "2.0.3",
    "cordova-plugin-background-mode": "0.7.3",
    "cordova-plugin-geolocation": "4.0.2",
    "cordova-plugin-whitelist": "1.3.4",
    "cordovarduino": "0.0.10",
    "in.lucasdup.bringtofront": "0.0.1"
  };
});