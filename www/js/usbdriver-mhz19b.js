
function mhz19b(serial, variablename)
{
  var self = this;
  this.serial = serial;
  this.variablename = variablename;

  console.log("mhz19b initialized")

  // this.node_read = function()
  // {
  //   outputData = new Uint8Array([0xff,0x01,0x86,0x00,0x00,0x00,0x00,0x00,0x79]);
  //   serial.write(outputData);
  //   const parser = serial.pipe(new ByteLength({length: 9}));
  //   parser.on('data', function(inputData) 
  //   {
  //     if ((inputData.length >= 9) && (inputData[0] == 0xff) && (inputData[1] == 0x86))
  //     {
  //       global[variablename] =  {
  //                                 'co2': inputData[2]*256 + inputData[3],
  //                                 'temperature': inputData[4] - 40,
  //                                 'TT': inputData[4],
  //                                 'SS': inputData[5],
  //                                 'UhUl': inputData[6]*256 + inputData[7]
  //                               };
  //     }
  //   });
  // }

  this.cordova_read = function()
  {
    console.log("mhz19b cordova_read");

    outputData = 'ff0186000000000079';
    serial.writeHex(outputData);

    serial.registerReadCallback(
        function success(rawdata){
            var data = new Uint8Array(rawdata);

            processSerialPort(data);

        },
        function error(){
            new Error("Failed to register read callback");
        });
  }

  function concatTypedArrays(a, b) { // a, b TypedArray of same type
      var c = new (a.constructor)(a.length + b.length);
      c.set(a, 0);
      c.set(b, a.length);
      return c;
  }

  function processSerialPort(data)
  {
      if (data.length == 0) return;

      serialPort = concatTypedArrays(serialPort, data);

      // Get most accurate timestamp - recorded as soon as data comes in

      var currenttimestamp = Date.now();

      while (serialPort.length >= 9)
      {
          // showStatus("processSerialPort");

          outputData = 'ff0186000000000079';
          serial.writeHex(outputData);

          var foundheader = false;
          var offset = 0;

          for(offset = 0; offset <= serialPort.length - 9; offset++)
          {
              if (offset != 0) showStatus("No header found at " + offset.toString());

              if ((parseInt(serialPort[offset]) == 0xff) && (parseInt(serialPort[offset + 1]) == 0x86)) 
              {
                  foundheader = true;
                  break;
              }
          }        

          if (!foundheader) 
          {
              showStatus("Couldn't find header anywhere in data");
              break;
          }

          // Get 9 bytes of serialPort

          var data = new Uint8Array(9);

          for(var i = 0; i < 9; i++) data[i] = serialPort[i + offset];

          // Remove 9 bytes from serialPort buffer

          serialPort_new = new Uint8Array(serialPort.length - 9 - offset);
          for(var i = 0; i < (serialPort.length - 9 - offset); i++)
          {
              serialPort_new[i] = serialPort[i + 9 + offset];
          }

          serialPort = serialPort_new;

          // Process 9 bytes taken from serial port

          var co2 = data[2]*256 + data[3];
          window[variablename] =  {
                                      'device': 'mh-z19b',
                                      'timestamp': currenttimestamp,
                                      'co2': co2,
                                      'temperature': data[4] - 40,
                                      'TT': data[4],
                                      'SS': data[5],
                                      'UhUl': data[6]*256 + data[7]
                                  };

          // console.log(window[variablename]);
          document.getElementById('data-co2').innerHTML = co2.toString();          
      }
  }

  this.abc_on = function()
  {
    outputData = new Uint8Array([0xff,0x01,0x79,0xa0,0x00,0x00,0x00,0x00,0xe6]);
    serial.write(outputData);
  }

  this.abc_off = function()
  {
    outputData = new Uint8Array([0xff,0x01,0x79,0x00,0x00,0x00,0x00,0x00,0x86]);
    serial.write(outputData);
  }

  this.span_point_calibration = function(span)
  {
    b3 = parseInt(span / 256);   
    b4 = span % 256; 
    c = checksum([0x01, 0x88, b3, b4])
    outputData = new Uint8Array([0xff,0x01,0x88,b3,b4,0x00,0x00,0x00,c]);
    serial.write(outputData);
  }

  this.zero_point_calibration = function()
  {
    outputData = new Uint8Array([0xff,0x01,0x87,0x00,0x00,0x00,0x00,0x00,0x78]);
    serial.write(outputData);
  }

  this.detection_range_5000 = function()
  {
    outputData = new Uint8Array([0xff,0x01,0x99,0x00,0x00,0x00,0x13,0x88,0xcb]);
    serial.write(outputData);
  }

  this.detection_range_2000 = function()
  {
    outputData = new Uint8Array([0xff,0x01,0x99,0x00,0x00,0x00,0x07,0xd0,0x8F]);
    serial.write(outputData);
  }

  function checksum(array)
  {
    var arrSum = array => arr.reduce((a,b) => a + b, 0)
    return 1 + 0xff - arrSum
  }
}


  