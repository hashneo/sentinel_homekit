const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

function lock(server, uuid, name) {

    let that = this;

    let LockController = {
        locked:false,
        manufacturer : 'sentinel',
        model : 'sentinel',
        serialNumber : uuid,

        lock: function () {
            LockController.locked = true;
            return server.call(`/hvac/fan/${uuid}/closed`);
        },
        unlock: function () {
            LockController.locked = false;
            return server.call(`/lock/${uuid}/open`);
        },
        identify: function () {
            return name;
        },
        status: function () {
            return new Promise( (fulfill, reject) =>{
                server.getDeviceStatus(uuid)
                    .then ( (data) => {
                        LockController.locked = data[0].lock.locked;
                        fulfill( LockController.locked );
                    })
                    .catch( (err) => {
                        reject(err);
                    });
            });
        }
    };

    // This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
    let lockAccessory = exports.accessory = new Accessory(name, uuid);

    // Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
    lockAccessory.username = LockController.username;
    lockAccessory.pincode = LockController.pincode;

    // set some basic properties (these values are arbitrary and setting them is optional)
    lockAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, LockController.manufacturer)
        .setCharacteristic(Characteristic.Model, LockController.model)
        .setCharacteristic(Characteristic.SerialNumber, LockController.serialNumber);


    // listen for the "identify" event for this Accessory
    lockAccessory.on('identify', function (paired, callback) {
        LockController.identify();
        callback(); // success
    });

    server.subscribe( uuid, function(status){

        LockController.locked = status.lock.locked;

        lockAccessory
            .getService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockCurrentState)
            .updateValue(LockController.locked ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED);
    });

    // Add the actual Door Lock Service and listen for change events from iOS.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    lockAccessory
        .addService(Service.LockMechanism, name) // services exposed to the user should have "names" like "Fake Light" for us
        .getCharacteristic(Characteristic.LockTargetState)
        .on('set', function (value, callback) {

            if (value === Characteristic.LockTargetState.UNSECURED) {
                LockController.unlock()
                    .then( (value) => {
                        callback(null, value);
                    })
                    .catch( (err) =>{
                        callback(err, null);
                    });
            }
            else if (value === Characteristic.LockTargetState.SECURED) {
                LockController.lock()
                    .then( (value) => {
                        callback(null, value);
                    })
                    .catch( (err) =>{
                        callback(err, null);
                    });
            }
        });

    lockAccessory
        .getService(Service.LockMechanism)
        .getCharacteristic(Characteristic.LockCurrentState)
        .on('get', function (callback) {

            LockController.status()
                .then( (value) =>{
                    callback(null, value ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });
        });

    lockAccessory
        .getService(Service.LockMechanism)
        .getCharacteristic(Characteristic.LockTargetState)
        .on('get', function (callback) {

            LockController.status()
                .then( (value) =>{
                    callback(null, value ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });
        });

    return lockAccessory;
}

module.exports = lock;