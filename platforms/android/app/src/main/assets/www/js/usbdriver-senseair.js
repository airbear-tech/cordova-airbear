
function senseair(serial, variablename)
{
  var self = this;
  this.serial = serial;
  this.variablename = variablename;

  console.log("senseair initialized")

  this.cordova_read = function()
  {
    console.log("senseair cordova_read");

    serial.registerReadCallback(
        function success(rawdata){
            var data = new Uint8Array(rawdata);

            processSerialPort(data);

        },
        function error(){
            new Error("Failed to register read callback");
        });

    outputData = 'FE0400030001D5C5';

    serial.writeHex(outputData);    
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

      while (serialPort.length >= 7)
      {
          showStatus("processSerialPort");

          setTimeout(function(){
            outputData = 'FE0400030001D5C5';
            serial.writeHex(outputData);
          }, 1000);
      
          var foundheader = false;
          var offset = 0;

          for(offset = 0; offset <= serialPort.length - 7; offset++)
          {
              if (offset != 0) showStatus("No header found at " + offset.toString());

            //   if ((parseInt(serialPort[offset]) == 0x61) && (parseInt(serialPort[offset + 1]) == 0x03)) 
            //   {
                  foundheader = true;
                  break;
            //   }
          }        

          if (!foundheader) 
          {
              showStatus("Couldn't find header anywhere in data");
              break;
          }

          // Get 7 bytes of serialPort

          var data = new Uint8Array(7);

          for(var i = 0; i < 7; i++) data[i] = serialPort[i + offset];

          // Remove 7 bytes from serialPort buffer

          serialPort_new = new Uint8Array(serialPort.length - 7 - offset);
          for(var i = 0; i < (serialPort.length - 7 - offset); i++)
          {
              serialPort_new[i] = serialPort[i + 7 + offset];
          }

          serialPort = serialPort_new;

          // Process 7 bytes taken from serial port

          var co2 = data[3]*256 + data[4];
      
          window[variablename] =  {
                                      'device': 'senseair',
                                      'timestamp': currenttimestamp,
                                      'co2': co2,
                                      'latitude': 0,
                                      'longitude': 0
                                  };

          // console.log(window[variablename]);
          document.getElementById('data-co2').innerHTML = co2.toString();          
      }
  }

  function hexToFloat(hex) {
    var s = hex >> 31 ? -1 : 1;
    var e = (hex >> 23) & 0xFF;
    return s * (hex & 0x7fffff | 0x800000) * 1.0 / Math.pow(2, 23) * Math.pow(2, (e - 127))
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


  