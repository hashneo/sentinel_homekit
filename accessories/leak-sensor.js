const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;

function sensor(server, uuid, name) {

    let that = this;

    let SensorController = {

        state: false,
        lowBattery: false,
        manufacturer : 'sentinel',
        model : 'sentinel',
        serialNumber : uuid,

        identify: function () {
            return name;
        },
        status: function () {
            return new Promise( (fulfill, reject) =>{
                server.getDeviceStatus(uuid)
                    .then ( (data) => {
                        this.state = data[0].moisture.tripped.current;

                        if ( data[0].battery ) {
                            this.lowBattery = parseInt(data[0].battery.level) < 25;
                        }

                        fulfill( this.state );
                    })
                    .catch( (err) => {
                        reject(err);
                    });
            });
        }
    };

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake motionSensor.
    let sensorAccessory = exports.accessory = new Accessory(name, uuid);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
    sensorAccessory.username = SensorController.model;
    sensorAccessory.pincode = SensorController.pincode;

// set some basic properties (these values are arbitrary and setting them is optional)
    sensorAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, SensorController.manufacturer)
        .setCharacteristic(Characteristic.Model, SensorController.model)
        .setCharacteristic(Characteristic.SerialNumber, SensorController.serialNumber);

// listen for the "identify" event for this Accessory
    sensorAccessory.on('identify', function (paired, callback) {
        SensorController.identify();
        callback(); // success
    });

    server.subscribe( uuid, function(status){
        SensorController.state = status.moisture.tripped.current;

        if ( status.battery ) {
            SensorController.lowBattery = parseInt(status.battery.level) < 25;

            sensorAccessory
                .getService(Service.LeakSensor)
                .getCharacteristic(Characteristic.StatusLowBattery)
                .updateValue(SensorController.lowBattery ? 1 : 0);
        }

        sensorAccessory
            .getService(Service.LeakSensor)
            .getCharacteristic(Characteristic.LeakDetected)
            .updateValue(SensorController.state ? 1 : 0);
    });

    sensorAccessory
        .addService(Service.LeakSensor)
        .getCharacteristic(Characteristic.LeakDetected)
        .on('get', function (callback) {

            SensorController.status()
                .then( () =>{
                    callback(null, SensorController.state ? 1 : 0 );
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });


    sensorAccessory
        .getService(Service.LeakSensor)
        .getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', function (callback) {

            SensorController.status()
                .then( () =>{
                    callback(null, SensorController.lowBattery ? 1 : 0);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    return sensorAccessory;
}

module.exports = sensor;