const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

function Time(server, uuid, name) {

    let that = this;

// here's a fake hardware device that we'll expose to HomeKit
    var TimeController = {

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
    let timeAccessory = exports.accessory = new Accessory(name, uuid);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
    timeAccessory.username = TimeController.username;
    timeAccessory.pincode = TimeController.pincode;

// set some basic properties (these values are arbitrary and setting them is optional)
    timeAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, TimeController.manufacturer)
        .setCharacteristic(Characteristic.Model, TimeController.model)
        .setCharacteristic(Characteristic.SerialNumber, TimeController.serialNumber);

// listen for the "identify" event for this Accessory
    timeAccessory.on('identify', function (paired, callback) {
        TimeController.identify();
        callback(); // success
    });

    timeAccessory
        .addService(Service.TimeInformation)
        .getCharacteristic(Characteristic.CurrentTime)
        .on('get', function (callback) {
            TimeController.status()
                .then( (value) =>{
                    callback(null, value.now);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });
        });

    timeAccessory
        .getService(Service.TimeInformation)
        .getCharacteristic(Characteristic.DayoftheWeek)
        .on('get', function (callback) {

            TimeController.status()
                .then( (value) =>{
                    callback(null, value.dayOfWeek);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    timeAccessory
        .getService(Service.TimeInformation)
        .getCharacteristic(Characteristic.TimeUpdate)
        .on('get', function (callback) {

            TimeController.status()
                .then( (value) =>{
                    callback(null, true);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    server.subscribe( uuid, function(status){

        timeAccessory
            .getService(Service.TimeInformation)
            .getCharacteristic(Characteristic.CurrentTime)
            .updateValue(status.now);
    });

    return timeAccessory;

}

module.exports = Time;