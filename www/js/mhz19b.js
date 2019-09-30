
const struct = require('python-struct');
const SerialPort = require('serialport');
const ByteLength = require('@serialport/parser-byte-length')

var fs = require('fs');

// file is included here:
eval(fs.readFileSync('usbdriver-mhz19b.js')+'');

const serial = new SerialPort('/dev/ttyUSB0', {baudRate: 9600, function (err) {
  if (err) {
    return console.log('Error: ', err.message)
  }
}
})

var sensorValue = 'undefined';
device = new mhz19b(serial, "sensorValue");
device.node_read();

setTimeout(function(){
  console.log(sensorValue);
}, 20000);

  