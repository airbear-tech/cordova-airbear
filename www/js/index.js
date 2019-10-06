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
var sessiontoken = 789014;

var mqttClient;
var mqttAddress = 'ws://analytics.camemergency.org:9001';
var outgoingDb = localforage.createInstance({ name: 'outgoingPackets' });
var outgoingStore = new MQTTLocalForageStore(outgoingDb);

var currentposition = 'undefined';
var lastposition = 'undefined';

// mqttAddress = 'mqtt://test.mosquitto.org:8080';

window.onerror = function(msg, url, line)
{
    outputDebug(JSON.stringify({'type': 'Generic JS error', 'msg': msg, 'url': url, 'line': line}));
};

function showStatus(status)
{
    var d = new Date();    
    document.getElementById('status').innerHTML = d.toLocaleString('en-GB') + ": " + status;
    console.log(status);
}

var app = {
    // Application Constructor
    initialize: function() {

        // Set up overarching mqtt connection

        mqttClient = mqtt.connect(mqttAddress, {outgoingStore: outgoingStore}); 

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

        // Serial access for PMS7003

        // serial.requestPermission(
        //     function(successMessage) {
        //         showStatus("Permission allowed to use serial");
        //         serial.open(
        //             {baudRate: 9600, sleepOnPause: false},
        //             function(successMessage) {

        //                 showStatus("Serial connection open");

        //                 serial.registerReadCallback(
        //                     function success(rawdata){

        //                         var data = new Uint8Array(rawdata);

        //                         processSerialPort(data);

        //                     },
        //                     errorCallback
        //                 );
        //             },
        //             errorCallback
        //         );
        //     },
        //     errorCallback
        // );

        // // Serial access for MH-Z19B

        // serial.requestPermission(
        //     function(successMessage) {
        //         showStatus("Permission allowed to use serial");
        //         serial.open(
        //             {baudRate: 9600, sleepOnPause: false},
        //             function(successMessage) {

        //                 showStatus("Serial connection open");

        //                 var co2device = new mhz19b(serial, "sensorValue");
        //                 co2device.cordova_read();
        //             },
        //             errorCallback
        //         );
        //     },
        //     errorCallback
        // );

        // Serial access for SCD30

        serial.requestPermission(
            function(successMessage) {
                showStatus("Permission allowed to use serial");
                serial.open(
                    {baudRate: 19200, sleepOnPause: false},
                    function(successMessage) {

                        showStatus("Serial connection open");

                        var co2device = new scd30(serial, "sensorValue");
                        co2device.cordova_read();
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
            showStatus("BKGNDGEO: onLocation")
            outputDebug('[location] ' + JSON.stringify(location));
            console.log(location);
            currentposition = {'latitude': location.coords.latitude, 'longitude': location.coords.longitude};
            if (lastposition == 'undefined') lastposition = {'latitude': currentposition.latitude, 'longitude': currentposition.longitude};
            showCurrentPosition('bkgndgeo_onlocation');
        });

        bgGeo.onMotionChange(function(event) {
            showStatus("BKGNDGEO: onMotionChange")
            outputDebug('[motionchange] ' + JSON.stringify(event));
            currentposition = {'latitude': event.location.coords.latitude, 'longitude': event.location.coords.longitude};
            if (lastposition == 'undefined') lastposition = {'latitude': currentposition.latitude, 'longitude': currentposition.longitude};
            showCurrentPosition('bkgndgeo_onmotionchange');
        });

        bgGeo.onHttp(function(response) {
            showCurrentPosition('bkgndgeo_onhttp');
            outputDebug('[http]');
        });

        bgGeo.onProviderChange(function(event) {
            showCurrentPosition('bkgndgeo_onproviderchange');
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
                showCurrentPosition('bkgndgeo_onready');
                outputDebug('- BackgroundGeolocation tracking started');
              });
            }
        });

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

var bSamplingRegular = false;
var bSamplingNode = false;
var nSamplingRegularTimer = 0;
var nSamplingNodeTimer = 0;
var nSamplingNodeSampleCurrentTimer = 0;

function setSamplingRegular(samplingregular_value)
{
    console.log("toggleSamplingRegular", samplingregular_value);

    $('#sampling_node_active').hide();

    if (samplingregular_value)
    {
        $('#sampling_regular').attr('value', 'Stop regular sampling');
        $('#sampling_node').attr('disabled', true);
        $('.sampling_parameters').attr('disabled', true);
        $('.sampling_parameters').css('background-color', 'lightgrey');

        if (nSamplingRegularTimer == 0) nSamplingRegularTimer = setInterval(timerSamplingRegular, 1000);
    }
    else
    {
        $('#sampling_regular').attr('value', 'Start regular sampling');
        $('#sampling_node').attr('disabled', false);
        $('.sampling_parameters').attr('disabled', false);
        $('.sampling_parameters').css('background-color', 'white');

        if (nSamplingRegularTimer != 0)
        {
            clearInterval(nSamplingRegularTimer);
            nSamplingRegularTimer = 0;
        } 
    }

    bSamplingRegular = samplingregular_value;
}

function setSamplingNode(samplingnode_value)
{
    console.log("toggleSamplingNode", samplingnode_value);

    $('#sampling_node_active').hide();

    if (samplingnode_value)
    {
        $('#sampling_node').attr('value', 'Stop spaced node sampling');
        $('#sampling_regular').attr('disabled', true);
        $('.sampling_parameters').attr('disabled', true);
        $('.sampling_parameters').css('background-color', 'lightgrey');

        samplingNodeStart();
    }
    else
    {
        $('#sampling_node').attr('value', 'Start spaced node sampling');
        $('#sampling_regular').attr('disabled', false);
        $('.sampling_parameters').attr('disabled', false);
        $('.sampling_parameters').css('background-color', 'white');

        if (nSamplingNodeTimer != 0)
        {
            clearInterval(nSamplingNodeTimer);
            nSamplingNodeTimer = 0;
        } 

    }

    bSamplingNode = samplingnode_value;

}

$(document).ready(function()
{
    $('#sampling_regular').on('click', function(){setSamplingRegular(!bSamplingRegular);});
    $('#sampling_node').on('click', function(){setSamplingNode(!bSamplingNode);});
    $('#sampling_node_sample').on('click', function(){timerSampleNodeSampleCurrentTimerStart();});

    $('#sampling_node_active').hide();

});



app.initialize();

function showCurrentPosition(source)
{
    var d = new Date();    
    var prefix = d.toLocaleString('en-GB') + ": " + source + ": ";

    if (currentposition !== 'undefined')
    {
        document.getElementById('location').innerHTML = prefix + currentposition.latitude.toString() + ", " + currentposition.longitude.toString();
    }
    else
    {
        document.getElementById('location').innerHTML = prefix + 'undefined';
    }
}

function timerSamplingRegular()
{
    console.log('timerSamplingRegular');
    // outputDebug(JSON.stringify({'type': 'timer', 'message': 'Calling timerLog'}));            

    localforage.length().then(function(numberOfKeys) {
        document.getElementById('datastore-size').innerHTML = numberOfKeys.toString();
        // console.log("Datastore size: " + numberOfKeys.toString());

    }).catch(function(err) {
        outputDebug(JSON.stringify(err));
    });

    // showCurrentPosition('timerLog');

    if ((currentposition !== 'undefined') && (sensorValue !== 'undefined'))
    {
        sensorValue.latitude = currentposition.latitude;
        sensorValue.longitude = currentposition.longitude;

        publishGeoData(sensorValue);
    }

    // navigator.geolocation.getCurrentPosition(onGeolocationSuccess, onGeoError, { enableHighAccuracy: true });
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) 
{
    console.log(lat1, lon1, lat2, lon2);
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d;
}
  
function deg2rad(deg) 
{
    return deg * (Math.PI/180)
}

currentposition = {'latitude': 0, 'longitude': 0};
lastposition = {'latitude': currentposition.latitude, 'longitude': currentposition.longitude};

nFakeDistanceTimer = 0;
nFakeValueIncrease = 0;

function fakeDistanceTimerStart()
{
    return;

    nFakeDistanceTimer = setInterval(function() {
        currentposition.latitude += 0.0004;
    }, 2000);
    
}

function fakeDistanceTimerStop()
{
    return;
    
    if (nFakeDistanceTimer != 0) clearInterval(nFakeDistanceTimer);
    nFakeDistanceTimer = 0;
}

fakeDistanceTimerStart();

function samplingNodeStart()
{
    console.log("Starting or sufficient distance travelled - get new node data");
    $('#message_alert').html("STOP MOVING! SAMPLE CURRENT POSITION");
    $('#sampling_node_active').show();

    if (nSamplingNodeTimer != 0)
    {
        clearInterval(nSamplingNodeTimer);
        nSamplingNodeTimer = 0;
    } 

    fakeDistanceTimerStop();
}

function timerSamplingNode()
{
    console.log('timerSamplingNode');

    if (currentposition !== 'undefined')
    {
        if (lastposition !== 'undefined')
        {
            var distancefromlast = 1000 * getDistanceFromLatLonInKm(currentposition.latitude, currentposition.longitude, lastposition.latitude, lastposition.longitude);
            var distanceminimum = $('#sampling_node_distance').val();
            
            console.log("Distance from last position", distancefromlast);

            if (distancefromlast >= distanceminimum)
            {
                samplingNodeStart();
            }
            else
            {
                $('#sampling_node_active').hide();
                $('#message_alert').html("");
            }
        }
    }

}

var timerSampleNodeSampleCurrentCountdown = 0;

function timerSampleNodeSampleCurrentTimerStart()
{
    if (nSamplingNodeSampleCurrentTimer == 0) 
    {
        timerSampleNodeSampleCurrentCountdown = $('#sampling_node_duration').val();       
        nSamplingNodeSampleCurrentTimer = setInterval(function(){timerSampleNodeSampleCurrent();}, 1000);
        $('#sampling_node_sample').attr('disabled', true);
    }
}

function timerSampleNodeSampleCurrentTimerStop()
{
    if (nSamplingNodeSampleCurrentTimer != 0)
    {
        clearInterval(nSamplingNodeSampleCurrentTimer);
        nSamplingNodeSampleCurrentTimer = 0;
    }
}

var dataSamples = [];

function getAverageArray(values)
{
    if (values.length)
    {
        sum = values.reduce(function(a, b) { return a + b; });
        return (sum / values.length);
    }
    else
    {
        return 0;
    }
}

function timerSampleNodeSampleFinished()
{
    timerSampleNodeSampleCurrentTimerStop();
    $('#sampling_node_timer').html('');        
    $('#sampling_node_sample').attr('disabled', false);
    $('#sampling_node_active').hide();
    lastposition = {'latitude': currentposition.latitude, 'longitude': currentposition.longitude};

    var timestamps = [];
    var longitudes = [];
    var latitudes = [];
    var values = [];
    var temperatures = [];
    var humidities = [];

    for(var i = 0; i < dataSamples.length; i++)
    {
        timestamps.push(dataSamples[i].timestamp);
        longitudes.push(dataSamples[i].longitude);
        latitudes.push(dataSamples[i].latitude);
        values.push(dataSamples[i].co2);
        temperatures.push(dataSamples[i].temperature);
        humidities.push(dataSamples[i].humidity);
    }

    sensorValue =  {
        'device': 'scd30-average',
        'timestamp': getAverageArray(timestamps),
        'co2': getAverageArray(values),
        'temperature': getAverageArray(temperatures),
        'humidity': getAverageArray(humidities),
        'latitude': getAverageArray(latitudes),
        'longitude': getAverageArray(longitudes),
    };

    console.log("Averaging data samples", dataSamples, sensorValue);

    publishGeoData(sensorValue);

    dataSamples = [];

    if (nSamplingNodeTimer == 0) nSamplingNodeTimer = setInterval(timerSamplingNode, 1000);

    fakeDistanceTimerStart();
    nFakeValueIncrease += 1;

}

function timerSampleNodeSampleCurrent()
{
    console.log("timeSampleNodeSampleCurrent");

    timerSampleNodeSampleCurrentCountdown -= 1;

    if (timerSampleNodeSampleCurrentCountdown < 0)
    {
        timerSampleNodeSampleFinished();
    }
    else
    {
        // Log data anyway

        // sensorValue =  {
        //     'device': 'scd30',
        //     'timestamp': Date.now(),
        //     'co2': (10 * nFakeValueIncrease) + 400 + timerSampleNodeSampleCurrentCountdown,
        //     'temperature': 27,
        //     'humidity': 13,
        // };

        if (sensorValue !== 'undefined')
        {
            sensorValue.latitude = currentposition.latitude;
            sensorValue.longitude = currentposition.longitude;

            publishGeoData(sensorValue);

            dataSamples.push(sensorValue);
        }
    
        $('#sampling_node_timer').html(timerSampleNodeSampleCurrentCountdown.toString() + ' second(s)');        
    } 
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
        'device':           'pms7003',
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
        'timestamp':        currenttimestamp,
        'latitude':         0,
        'longitude':        0
    };
}

var onGeolocationSuccess = function(location) {

    currentposition = {'latitude': location.coords.latitude, 'longitude': location.coords.longitude};
    if (lastposition == 'undefined') lastposition = {'latitude': currentposition.latitude, 'longitude': currentposition.longitude};

    showCurrentPosition('builtingeo');

}

var publishGeoData = function(sensorValue) {

    // successArray = {'type': 'geolocation', 'message': 'success', 'latitude': sensorValue.latitude, 'longitude': sensorValue.longitude};
    // outputDebug(JSON.stringify(successArray));

    if (sensorValue === 'undefined') return;

    if (typeof sensorValue.co2 !== 'undefined')
    {
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device': sensorValue.device, 
            'sensor':'CO2',
            'value':sensorValue.co2, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.temperature !== 'undefined')
    {    
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device': sensorValue.device, 
            'sensor':'Temperature',
            'value':sensorValue.temperature, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.humidity !== 'undefined')
    {    
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device': sensorValue.device, 
            'sensor':'Humidity',
            'value':sensorValue.humidity, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));                    
    }

    if (typeof sensorValue.concPM1_0_CF1 !== 'undefined')
    {
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device': sensorValue.device, 
            'sensor': 'concPM1_0_CF1',
            'value':sensorValue.concPM1_0_CF1, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.concPM2_5_CF1 !== 'undefined')
    {
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device':'pms7003', 
            'sensor':'concPM2_5_CF1',
            'value':sensorValue.concPM2_5_CF1, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.concPM10_0_CF1 !== 'undefined')
    {
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device':'pms7003', 
            'sensor':'concPM10_0_CF1',
            'value':sensorValue.concPM10_0_CF1, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.concPM1_0_ATM !== 'undefined')
    {
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device':'pms7003', 
            'sensor':'concPM1_0_ATM',
            'value':sensorValue.concPM1_0_ATM, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.concPM2_5_ATM !== 'undefined')
    {
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device':'pms7003', 
            'sensor':'concPM2_5_ATM',
            'value':sensorValue.concPM2_5_ATM, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.concPM10_0_ATM !== 'undefined')
    {
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device':'pms7003', 
            'sensor':'concPM10_0_ATM',
            'value':sensorValue.concPM10_0_ATM, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.rawGt0_3um !== 'undefined')
    {
        showStatus("Sensor value: " + sensorValue.rawGt0_3um.toString());

        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device':'pms7003', 
            'sensor':'rawGt0_3um',
            'value':sensorValue.rawGt0_3um, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.rawGt0_5um !== 'undefined')
    {
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device':'pms7003', 
            'sensor':'rawGt0_5um',
            'value':sensorValue.rawGt0_5um, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.rawGt1_0um !== 'undefined')
    {
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device':'pms7003', 
            'sensor':'rawGt1_0um',
            'value':sensorValue.rawGt1_0um, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.rawGt2_5um !== 'undefined')
    {
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device':'pms7003', 
            'sensor':'rawGt2_5um',
            'value':sensorValue.rawGt2_5um, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

    if (typeof sensorValue.rawGt10_0um !== 'undefined')
    {
        mqttClient.publish("sensor", JSON.stringify(
        {
            'token': sessiontoken,
            'device':'pms7003', 
            'sensor':'rawGt10_0um',
            'value':sensorValue.rawGt10_0um, 
            'epoch':sensorValue.timestamp, 
            'latitude':sensorValue.latitude, 
            'longitude':sensorValue.longitude
        }));
    }

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

    // console.log(logtext);
    // return;

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
            'token': sessiontoken,
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

