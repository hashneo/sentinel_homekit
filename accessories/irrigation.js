const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

function Irrigation(server, uuid, name) {

    let that = this;

// here's a fake hardware device that we'll expose to HomeKit
    var IrrigationController = {

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
    let irrigationAccessory = exports.accessory = new Accessory(name, uuid);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
    irrigationAccessory.username = IrrigationController.username;
    irrigationAccessory.pincode = IrrigationController.pincode;

// set some basic properties (these values are arbitrary and setting them is optional)
    irrigationAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, IrrigationController.manufacturer)
        .setCharacteristic(Characteristic.Model, IrrigationController.model)
        .setCharacteristic(Characteristic.SerialNumber, IrrigationController.serialNumber);

// listen for the "identify" event for this Accessory
    irrigationAccessory.on('identify', function (paired, callback) {
        IrrigationController.identify();
        callback(); // success
    });

    let irrigationSystem = irrigationAccessory.addService(Service.IrrigationSystem);


    let valve = irrigationSystem.addService( Service.Valve );

    irrigationSystem
        .getCharacteristic(Characteristic.CurrentIrrigation)
        .on('get', function (callback) {
            IrrigationController.status()
                .then( (value) =>{
                    callback(null, value.now);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });
        });

    irrigationAccessory
        .getService(Service.IrrigationSystem)
        .getCharacteristic(Characteristic.DayoftheWeek)
        .on('get', function (callback) {

            IrrigationController.status()
                .then( (value) =>{
                    callback(null, value.dayOfWeek);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    irrigationAccessory
        .getService(Service.IrrigationInformation)
        .getCharacteristic(Characteristic.IrrigationUpdate)
        .on('get', function (callback) {

            IrrigationController.status()
                .then( (value) =>{
                    callback(null, true);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    server.subscribe( uuid, function(status){

        irrigationAccessory
            .getService(Service.IrrigationInformation)
            .getCharacteristic(Characteristic.CurrentIrrigation)
            .updateValue(status.now);
    });

    return irrigationAccessory;

}

module.exports = Irrigation;