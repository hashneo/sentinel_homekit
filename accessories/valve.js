const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

function Valve(server, uuid, name) {

    let that = this;

// here's a fake hardware device that we'll expose to HomeKit
    var ValveController = {

        open : false,
        manufacturer : 'sentinel',
        model : 'sentinel',
        serialNumber : uuid,

        setValveOpen: function (value) {

            return new Promise( (fulfill, reject) => {
                if ( this.open === value )
                    return fulfill();

                server.call(`/valve/${uuid}/${value?'open':'close'}`)
                    .then(()=>{
                        this.open = value;
                        fulfill();
                    })
                    .catch( (err) =>{
                        reject(err);
                    })
            });
        },

        identify: function () {
            return name;
        },

        status: function () {
            return new Promise((fulfill, reject) => {
                server.getDeviceStatus(uuid)
                    .then((data) => {
                        ValveController.open = data[0].valve.open;
                        fulfill(ValveController.open);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        }
    };

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake light.
    let switchAccessory = exports.accessory = new Accessory(name, uuid);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
    switchAccessory.username = ValveController.username;
    switchAccessory.pincode = ValveController.pincode;

// set some basic properties (these values are arbitrary and setting them is optional)
    switchAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, ValveController.manufacturer)
        .setCharacteristic(Characteristic.Model, ValveController.model)
        .setCharacteristic(Characteristic.SerialNumber, ValveController.serialNumber);


// listen for the "identify" event for this Accessory
    switchAccessory.on('identify', function (paired, callback) {
        ValveController.identify();
        callback(); // success
    });

// Add the actual switch Service and listen for change events from iOS.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    switchAccessory
        .addService(Service.Valve, name) // services exposed to the user should have "names" like "Fake Light" for us
        .getCharacteristic(Characteristic.Active)
        .on('set', function (value, callback) {
            ValveController.setValveOpen(value === 1 );
            callback(); // Our fake Valve is synchronous - this value has been successfully set
        });

    switchAccessory
        .getService(Service.Valve)
        .getCharacteristic(Characteristic.Active)
        .on('get', function (callback) {
            ValveController.status()
                .then( (value) =>{
                    callback(null, value ? 1 : 0);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });
        });

    switchAccessory
        .getService(Service.Valve)
        .getCharacteristic(Characteristic.ValveType)
        .on('get', function (callback) {
            callback(null, 0);
        });

    switchAccessory
        .getService(Service.Valve)
        .getCharacteristic(Characteristic.InUse)
        .on('get', function (callback) {
            ValveController.status()
                .then( (value) =>{
                    callback(null, value ? 1 : 0);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    server.subscribe( uuid, function(status){

        ValveController.open = status.valve.open;

        switchAccessory
            .getService(Service.Valve)
            .getCharacteristic(Characteristic.InUse)
            .updateValue(ValveController.open ? 1 : 0);

        switchAccessory
            .getService(Service.Valve)
            .getCharacteristic(Characteristic.Active)
            .updateValue(ValveController.open ? 1 : 0);
    });

    return switchAccessory;

}

module.exports = Valve;
