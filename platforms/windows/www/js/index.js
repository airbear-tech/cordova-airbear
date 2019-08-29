/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

var serialPort = new Uint8Array();
var sensorValue = 'undefined';

var mqttClient;
var mqttAddress = 'ws://analytics.camemergency.org:9001';
var outgoingDb = localforage.createInstance({ name: 'outgoingPackets' });
var outgoingStore = new MQTTLocalForageStore(outgoingDb);

var currentposition = 'undefined';

// mqttAddress = 'mqtt://test.mosquitto.org:8080';

window.onerror = function(msg, url, line)
{
    outputDebug(JSON.stringify({'type': 'Generic JS error', 'msg': msg, 'url': url, 'line': line}));
};

function showStatus(status)
{
    document.getElementById('status').innerHTML = status;
    console.log(status);
}

var app = {
    // Application Constructor
    initialize: function() {

        // Set up overarching mqtt connection

        mqttClient = mqtt.connect(mqttAddress, {outgoingStore: outgoingStore}); 
        mqttClient.subscribe("sensor");

        // mqttClient.on("message", function (topic, payload) {
        //     console.log("MQTT: " + [topic, payload].join(": "))
        //     // mqttClient.end()
        // });

        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    onDeviceReady: function() {
        this.receivedEvent('deviceready');

        // Enable cordova plugin 'backgroundMode' so app stays active recording 
        // from sensor even when it's not active
        // In future, make app check whether sensor is plugged 
        // in and not do GPS if so (suspect that's default behaviour anyway)

        cordova.plugins.backgroundMode.on('activate', function() {
           cordova.plugins.backgroundMode.disableWebViewOptimizations(); 
        });

        cordova.plugins.backgroundMode.enable();

        var errorCallback = function(message) {
            outputDebug(JSON.stringify({'type': 'Serial port error', 'message': message}));            
        };

        // Start serial port monitoring and register callback
        // making sure serial port doesn't 'sleepOnPause', ie. background

        serial.requestPermission(
            function(successMessage) {
                showStatus("Permission allowed to use serial");
                serial.open(
                    {baudRate: 9600, sleepOnPause: false},
                    function(successMessage) {

                        showStatus("Serial connection open");

                        serial.registerReadCallback(
                            function success(rawdata){

                                var data = new Uint8Array(rawdata);

                                processSerialPort(data);

                            },
                            errorCallback
                        );
                    },
                    errorCallback
                );
            },
            errorCallback
        );

        // Call geolocation anyway just to get at least one opening position

        navigator.geolocation.getCurrentPosition(onGeolocationSuccess, onGeoError, { enableHighAccuracy: true });

        // 1.  Listen to events
        var bgGeo = window.BackgroundGeolocation;

        bgGeo.onLocation(function(location) {
            outputDebug('[location] ' + JSON.stringify(location));
            console.log(location);
            currentposition = {'latitude': location.coords.latitude, 'longitude': location.coords.longitude};
        });

        bgGeo.onMotionChange(function(event) {
            outputDebug('[motionchange] ' + JSON.stringify(event));
            currentposition = {'latitude': event.location.coords.latitude, 'longitude': event.location.coords.longitude};
        });

        bgGeo.onHttp(function(response) {
            outputDebug('[http]');
        });

        bgGeo.onProviderChange(function(event) {
            outputDebug('[providerchange]');
        });

        // 2. Execute #ready method:
        bgGeo.ready({
            reset: true,
            debug: true,
            logLevel: bgGeo.LOG_LEVEL_VERBOSE,
            desiredAccuracy: bgGeo.DESIRED_ACCURACY_HIGH,
            distanceFilter: 5,
            // url: 'http://my.server.com/locations',
            autoSync: true,
            stopOnTerminate: true,
            startOnBoot: false
        }, function(state) {    // <-- Current state provided to #configure callback
            // 3.  Start tracking
            outputDebug('BackgroundGeolocation is configured and ready to use');
            if (!state.enabled) {
              bgGeo.start().then(function() {
                outputDebug('- BackgroundGeolocation tracking started');
              });
            }
        });

        setInterval(timerLog, 5000);

    },

    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    }
};

app.initialize();


function timerLog()
{
    console.log('timerLog');
    outputDebug(JSON.stringify({'type': 'timer', 'message': 'Calling timerLog'}));            

    localforage.length().then(function(numberOfKeys) {
        document.getElementById('datastore-size').innerHTML = numberOfKeys.toString();
        console.log("Datastore size: " + numberOfKeys.toString());

    }).catch(function(err) {
        outputDebug(JSON.stringify(err));
    });

    if (currentposition !== 'undefined')
    {
        publishGeoData(currentposition);
    }

    // navigator.geolocation.getCurrentPosition(onGeolocationSuccess, onGeoError, { enableHighAccuracy: true });
}


function concatTypedArrays(a, b) { // a, b TypedArray of same type
    var c = new (a.constructor)(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
}

function processSerialPort(data)
{
    serialPort = concatTypedArrays(serialPort, data);

    showStatus("processSerialPort");

    // Get most accurate timestamp - recorded as soon as data comes in

    var currenttimestamp = Date.now();

    while (serialPort.length >= 32)
    {
        showStatus("Serial port has enough data");

        var noprocessing = true;

        var offset;

        for(offset = 0; offset < serialPort.length - 32; offset++)
        {
            if (offset != 0) showStatus("No header found at " + offset.toString());

            if ((serialPort[offset] == 0x42) && (serialPort[offset + 1] == 0x4d)) break;
        }        

        if ((serialPort[offset] == 0x42) && (serialPort[offset + 1] == 0x4d))
        {
            showStatus("Found correct header in serial port");

            // Code converted from https://github.com/MarkJB/python-pms7003

            // Get 30 bytes of serialPort

            var data = new Uint8Array(30);

            for(var i = 0; i < 30; i++) data[i] = serialPort[i + 2 + offset];

            // Remove 30 bytes from serialPort buffer

            serialPort_new = new Uint8Array(serialPort.length - 32 - offset);
            for(var i = 0; i < (serialPort.length - 32 - offset); i++)
            {
                serialPort_new[i] = serialPort[i + 32 + offset];
            }

            serialPort = serialPort_new;

            // Process 30 bytes taken from serial port

            processPayload(currenttimestamp, data);

            noprocessing = false;
        }

        // If no processing has been possible, break out loop
        // Otherwise let loop re-run in attempt to process 
        // as much of serial buffer as possible

        if (noprocessing) break;
    }
}

function processPayload(currenttimestamp, data)
{
    showStatus("Processing payload");

    // Code converted from https://github.com/MarkJB/python-pms7003

    // Extract the byte data by summing the bit shifted high byte with the low byte
    // Use ordinals in python to get the byte value rather than the char value
    var frameLength = data[1] + (data[0] << 8);
    // Standard particulate values in ug/m3
    var concPM1_0_CF1 = data[3] + (data[2] << 8);
    var concPM2_5_CF1 = data[5] + (data[4] << 8);
    var concPM10_0_CF1 = data[7] + (data[6] << 8);
    // Atmospheric particulate values in ug/m3
    var concPM1_0_ATM = data[9] + (data[8] << 8);
    var concPM2_5_ATM = data[11] + (data[10] << 8);
    var concPM10_0_ATM = data[13] + (data[12] << 8);
    // Raw counts per 0.1l
    var rawGt0_3um = data[15] + (data[14] << 8);
    var rawGt0_5um = data[17] + (data[16] << 8);
    var rawGt1_0um = data[19] + (data[18] << 8);
    var rawGt2_5um = data[21] + (data[20] << 8);
    var rawGt5_0um = data[23] + (data[22] << 8);
    var rawGt10_0um = data[25] + (data[24] << 8);
    // Misc data
    var version = data[26];
    var errorCode = data[27];
    var payloadChecksum = data[29] + (data[28] << 8);

    console.log("PMS7003 Sensor Data:");
    console.log("PM1.0 = " + concPM1_0_CF1.toString() + " ug/m3");
    console.log("PM2.5 = " + concPM2_5_CF1.toString() + " ug/m3");
    console.log("PM10 = " + concPM10_0_CF1.toString() + " ug/m3");
    console.log("PM1 Atmospheric concentration = " + concPM1_0_ATM.toString() + " ug/m3");
    console.log("PM2.5 Atmospheric concentration = " + concPM2_5_ATM.toString() + " ug/m3");
    console.log("PM10 Atmospheric concentration = " + concPM10_0_ATM.toString() + " ug/m3");
    console.log("Count: 0.3um = " + rawGt0_3um.toString() + " per 0.1l");
    console.log("Count: 0.5um = " + rawGt0_5um.toString() + " per 0.1l");
    console.log("Count: 1.0um = " + rawGt1_0um.toString() + " per 0.1l");
    console.log("Count: 2.5um = " + rawGt2_5um.toString() + " per 0.1l");
    console.log("Count: 5.0um = " + rawGt5_0um.toString() + " per 0.1l");
    console.log("Count: 10um = " + rawGt10_0um.toString() + " per 0.1l");
    console.log("Version = " + version.toString());
    console.log("Error Code = " + errorCode.toString());
    console.log("Frame length = " + frameLength.toString());

    document.getElementById('data-pm1').innerHTML = concPM1_0_CF1.toString();
    document.getElementById('data-pm2').innerHTML = concPM2_5_CF1.toString();
    document.getElementById('data-pm10').innerHTML = concPM10_0_CF1.toString();
    document.getElementById('data-conc-pm1').innerHTML = concPM1_0_ATM.toString();
    document.getElementById('data-conc-pm2').innerHTML = concPM2_5_ATM.toString();
    document.getElementById('data-conc-pm10').innerHTML = concPM10_0_ATM.toString();
    document.getElementById('data-count-003').innerHTML = rawGt0_3um.toString();
    document.getElementById('data-count-005').innerHTML = rawGt0_5um.toString();
    document.getElementById('data-count-010').innerHTML = rawGt1_0um.toString();
    document.getElementById('data-count-025').innerHTML = rawGt2_5um.toString();
    document.getElementById('data-count-050').innerHTML = rawGt5_0um.toString();
    document.getElementById('data-count-100').innerHTML = rawGt10_0um.toString();

    sensorValue = 
    {
        'concPM1_0_CF1':    concPM1_0_CF1,
        'concPM2_5_CF1':    concPM2_5_CF1,
        'concPM10_0_CF1':   concPM10_0_CF1,
        'concPM1_0_ATM':    concPM1_0_ATM,
        'concPM2_5_ATM':    concPM2_5_ATM,
        'concPM10_0_ATM':   concPM10_0_ATM,
        'rawGt0_3um':       rawGt0_3um,
        'rawGt0_5um':       rawGt0_5um,
        'rawGt1_0um':       rawGt1_0um,
        'rawGt2_5um':       rawGt2_5um,
        'rawGt10_0um':      rawGt10_0um,
        'timestamp':        currenttimestamp
    };
}

var onGeolocationSuccess = function(location) {

    currentposition = {'latitude': location.coords.latitude, 'longitude': location.coords.longitude};

    // publishGeoData(currentposition);
}

var publishGeoData = function(latlon) {

    successArray = {'type': 'geolocation', 'message': 'success', 'latitude': latlon.latitude, 'longitude': latlon.longitude};
    outputDebug(JSON.stringify(successArray));

    if (sensorValue === 'undefined') return;

    mqttClient.publish("sensor", JSON.stringify({
        'token': 789014,
        'device':'mobile', 
        'sensor':'pms7003-concPM1_0_CF1',
        'value':sensorValue.concPM1_0_CF1, 
        'epoch':sensorValue.timestamp, 
        'latitude':latlon.latitude, 
        'longitude':latlon.longitude}));

    mqttClient.publish("sensor", JSON.stringify({
        'token': 789014,
        'device':'mobile', 
        'sensor':'pms7003-concPM2_5_CF1',
        'value':sensorValue.concPM2_5_CF1, 
        'epoch':sensorValue.timestamp, 
        'latitude':latlon.latitude, 
        'longitude':latlon.longitude}));

    mqttClient.publish("sensor", JSON.stringify({
        'token': 789014,
        'device':'mobile', 
        'sensor':'pms7003-concPM10_0_CF1',
        'value':sensorValue.concPM10_0_CF1, 
        'epoch':sensorValue.timestamp, 
        'latitude':latlon.latitude, 
        'longitude':latlon.longitude}));

    mqttClient.publish("sensor", JSON.stringify({
        'token': 789014,
        'device':'mobile', 
        'sensor':'pms7003-concPM1_0_ATM',
        'value':sensorValue.concPM1_0_ATM, 
        'epoch':sensorValue.timestamp, 
        'latitude':latlon.latitude, 
        'longitude':latlon.longitude}));

    mqttClient.publish("sensor", JSON.stringify({
        'token': 789014,
        'device':'mobile', 
        'sensor':'pms7003-concPM2_5_ATM',
        'value':sensorValue.concPM2_5_ATM, 
        'epoch':sensorValue.timestamp, 
        'latitude':latlon.latitude, 
        'longitude':latlon.longitude}));

    mqttClient.publish("sensor", JSON.stringify({
        'token': 789014,
        'device':'mobile', 
        'sensor':'pms7003-concPM10_0_ATM',
        'value':sensorValue.concPM10_0_ATM, 
        'epoch':sensorValue.timestamp, 
        'latitude':latlon.latitude, 
        'longitude':latlon.longitude}));

    mqttClient.publish("sensor", JSON.stringify({
        'token': 789014,
        'device':'mobile', 
        'sensor':'pms7003-rawGt0_3um',
        'value':sensorValue.rawGt0_3um, 
        'epoch':sensorValue.timestamp, 
        'latitude':latlon.latitude, 
        'longitude':latlon.longitude}));

    mqttClient.publish("sensor", JSON.stringify({
        'token': 789014,
        'device':'mobile', 
        'sensor':'pms7003-rawGt0_5um',
        'value':sensorValue.rawGt0_5um, 
        'epoch':sensorValue.timestamp, 
        'latitude':latlon.latitude, 
        'longitude':latlon.longitude}));

    mqttClient.publish("sensor", JSON.stringify({
        'token': 789014,
        'device':'mobile', 
        'sensor':'pms7003-rawGt1_0um',
        'value':sensorValue.rawGt1_0um, 
        'epoch':sensorValue.timestamp, 
        'latitude':latlon.latitude, 
        'longitude':latlon.longitude}));

    mqttClient.publish("sensor", JSON.stringify({
        'token': 789014,
        'device':'mobile', 
        'sensor':'pms7003-rawGt2_5um',
        'value':sensorValue.rawGt2_5um, 
        'epoch':sensorValue.timestamp, 
        'latitude':latlon.latitude, 
        'longitude':latlon.longitude}));

    mqttClient.publish("sensor", JSON.stringify({
        'token': 789014,
        'device':'mobile', 
        'sensor':'pms7003-rawGt10_0um',
        'value':sensorValue.rawGt10_0um, 
        'epoch':sensorValue.timestamp, 
        'latitude':latlon.latitude, 
        'longitude':latlon.longitude}));

    showStatus("Sensor value: " + sensorValue.rawGt0_3um.toString());

    sensorValue = 'undefined';
};

function onGeoError(error) 
{
    errortext = 'GeolocationError: code: ' + error.code + '|' + 'message: ' + error.message;
    errorArray = {'type': 'geolocationerror', 'code': error.code, 'message': error.message};
    console.log(errortext);
    outputDebug(JSON.stringify(errorArray));
}

// Debug commands

function clearDebug()
{
    localStorage.setItem('debug', null);
}

function showDebug()
{
    return localStorage.getItem('debug');
}

function outputDebug(logtext)
{
    // Add timestamp to text

    var d = new Date();

    timelogtext = 'DEBUG: ' + d.toLocaleString('en-GB') + ': ' + logtext;

    debugcurrent = localStorage.getItem('debug');

    if ((debugcurrent === 'null') || (debugcurrent === undefined)) debugcurrent = '';
    else debugcurrent += '\n';

    debugcurrent += timelogtext;

    localStorage.setItem('debug', debugcurrent);

    
    var baseurl = "http://analytics.camemergency.org/remotelog.php";

    $.ajax(
    {
        url: baseurl,
        type: "GET",                
        data: 
        {
            'token': 789014,
            'logtext':logtext
        },
        success: function (msg)
        {
        },
        error: function (XMLHttpRequest, textStatus, errorThrown)
        {
            console.log(JSON.stringify(XMLHttpRequest));
            console.log(JSON.stringify(textStatus));
            console.log(JSON.stringify(errorThrown));
        }
    });
}

