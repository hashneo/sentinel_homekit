const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

function sensor(server, uuid, name) {

    let that = this;

    let fahrenheitToCelcius = function (f) {
        return Math.round( (f - 32.0) * (5.0/9.0) );
    };

    let SensorController = {

        current: 0,
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
                        this.current = fahrenheitToCelcius( data[0].temperature.current );

                        if ( data[0].battery ) {
                            this.lowBattery = parseInt(data[0].battery.level) < 25;
                        }

                        fulfill( this.current );
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
        SensorController.current = fahrenheitToCelcius( status.temperature.current );

        if ( status.battery ) {
            SensorController.lowBattery = parseInt(status.battery.level) < 25;

            sensorAccessory
                .getService(Service.TemperatureSensor)
                .getCharacteristic(Characteristic.StatusLowBattery)
                .updateValue(SensorController.lowBattery ? 1 : 0);
        }

        sensorAccessory
            .getService(Service.TemperatureSensor)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(SensorController.current);
    });

    sensorAccessory
        .addService(Service.TemperatureSensor)
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', function (callback) {

            SensorController.status()
                .then( () =>{
                    callback(null, SensorController.current);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });


    sensorAccessory
        .getService(Service.TemperatureSensor)
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
