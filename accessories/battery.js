const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

function Battery(server, uuid, name) {

    let that = this;

// here's a fake hardware device that we'll expose to HomeKit
    var BatteryController = {

        manufacturer : 'sentinel',
        model : 'sentinel',
        serialNumber : uuid,
        
        identify: function () {
            return name;
        },

        status: function () {
            return new Promise((fulfill, reject) => {
                server.getDeviceStatus(uuid)
                    .then((data) => {
                        fulfill(data[0]);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        }
    };

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake light.
    let batteryAccessory = exports.accessory = new Accessory(name, uuid);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
    batteryAccessory.username = BatteryController.username;
    batteryAccessory.pincode = BatteryController.pincode;

// set some basic properties (these values are arbitrary and setting them is optional)
    batteryAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, BatteryController.manufacturer)
        .setCharacteristic(Characteristic.Model, BatteryController.model)
        .setCharacteristic(Characteristic.SerialNumber, BatteryController.serialNumber);

// listen for the "identify" event for this Accessory
    batteryAccessory.on('identify', function (paired, callback) {
        BatteryController.identify();
        callback(); // success
    });

    batteryAccessory
        .addService(Service.BatteryService)
        .getCharacteristic(Characteristic.BatteryLevel)
        .on('get', function (callback) {
            BatteryController.status()
                .then( (value) =>{
                    callback(null, value.battery.level);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });
        });

    batteryAccessory
        .getService(Service.BatteryService)
        .getCharacteristic(Characteristic.ChargingState)
        .on('get', function (callback) {

            BatteryController.status()
                .then( (value) =>{
                    callback(null, value.battery.current < -10 ? 1 : 0);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    batteryAccessory
        .getService(Service.BatteryService)
        .getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', function (callback) {

            BatteryController.status()
                .then( (value) =>{
                    callback(null, value.battery.level <= 10 ? 1 : 0 );
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    server.subscribe( uuid, function(status) {

        if (status.battery !== undefined && status.battery.level !== undefined) {
            batteryAccessory
                .getService(Service.BatteryService)
                .getCharacteristic(Characteristic.BatteryLevel)
                .updateValue(status.battery.level);

        }

    });

    return batteryAccessory;

}

module.exports = Battery;