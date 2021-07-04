const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

function hvac(server, uuid, name) {

    let that = this;

    let Controller = {

        fanPowerOn: false,
        rSpeed: 100,
        CurrentHeatingCoolingState: 1,
        TargetHeatingCoolingState: 1,
        CurrentTemperature: 33,
        TargetTemperature: 32,
        TemperatureDisplayUnits: 1,

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
                        fulfill( this.state );
                    })
                    .catch( (err) => {
                        reject(err);
                    });
            });
        }
    };

    let hvacAccessory = exports.accessory = new Accessory(name, uuid);

    hvacAccessory.username = Controller.model;
    hvacAccessory.pincode = Controller.pincode;

    hvacAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, Controller.manufacturer)
        .setCharacteristic(Characteristic.Model, Controller.model)
        .setCharacteristic(Characteristic.SerialNumber, Controller.serialNumber);

    hvacAccessory.on('identify', function (paired, callback) {
        Controller.identify();
        callback(); // success
    });

    server.subscribe( uuid, function(status){
    });
/*
    hvacAccessory
        .addService(Service.)
        .getCharacteristic(Characteristic.)
        .on('set', function(value, callback) {
            callback();
        })
        .on('get', function (callback) {

            Controller.status()
                .then( (value) =>{
                    callback(null, value );
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });
*/

    return hvacAccessory;
}

module.exports = hvac;
