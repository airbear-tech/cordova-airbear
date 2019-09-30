
const struct = require('python-struct');
const SerialPort = require('serialport');

const serial = new SerialPort('/dev/serial0', {baudRate: 9600, function (err) {
  if (err) {
    return console.log('Error: ', err.message)
  }
}
})


console.log(serial.read());

function read()
{
  outputData = Uint8Array([0xff,0x01,0x86,0x00,0x00,0x00,0x00,0x00,0x79]);

  while(true)
  {
    serial.write(outputData);
    const parser = serial.pipe(new ByteLength({length: 9}));
    parser.on('data', inputData); 

    if (inputData.length >= 9) && (s[0] == 0xff) && (s[1] == 0x86)
    {
      return {'co2': s[2]*256 + s[3],
                  'temperature': s[4] - 40,
                  'TT': s[4],
                  'SS': s[5],
                  'UhUl': s[6]*256 + s[7]
                  }
    }
  }
}

function abc_on()
{
  outputData = Uint8Array([0xff,0x01,0x79,0xa0,0x00,0x00,0x00,0x00,0xe6]);
  serial.write(outputData);
}

function abc_off()
{
  outputData = Uint8Array([0xff,0x01,0x79,0x00,0x00,0x00,0x00,0x00,0x86]);
  serial.write(outputData);
}

function span_point_calibration(span)
{
  b3 = parseInt(span / 256);   
  b4 = span % 256; 
  c = checksum([0x01, 0x88, b3, b4])
  outputData = Uint8Array([0xff,0x01,0x88,b3,b4,0x00,0x00,0x00,c]);
  serial.write(outputData);
}

function zero_point_calibration()
{
  outputData = Uint8Array([0xff,0x01,0x87,0x00,0x00,0x00,0x00,0x00,0x78]);
  serial.write(outputData);
}

function detection_range_5000()
{
  outputData = Uint8Array([0xff,0x01,0x99,0x00,0x00,0x00,0x13,0x88,0xcb]);
  serial.write(outputData);
}

function detection_range_2000()
{
  outputData = Uint8Array([0xff,0x01,0x99,0x00,0x00,0x00,0x07,0xd0,0x8F]);
  serial.write(outputData);
}

function checksum(array)
{
  var arrSum = array => arr.reduce((a,b) => a + b, 0)
  return 1 + 0xff - arrSum
}
