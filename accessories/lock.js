const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;

// here's a fake hardware device that we'll expose to HomeKit
function lock(server, uuid, name) {

    let that = this;

    let LockController = {
        locked:false,
        manufacturer : 'sentinel',
        model : 'sentinel',
        serialNumber : uuid,

        lock: function () {
            LockController.locked = true;
            return server.call(`/lock/${uuid}/closed`);
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
                server.call(`/device/${uuid}/status`)
                    .then ( (data) => {
                        LockController.locked = data[0].locked;
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

        LockController.locked = status.locked;

        lockAccessory
            .getService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockTargetState)
            .updateValue(LockController.locked ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED);


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

            if (value == Characteristic.LockTargetState.UNSECURED) {
                LockController.unlock();
                callback(); // Our fake Lock is synchronous - this value has been successfully set
            }
            else if (value == Characteristic.LockTargetState.SECURED) {
                LockController.lock();
                callback(); // Our fake Lock is synchronous - this value has been successfully set
            }
        });

// We want to intercept requests for our current state so we can query the hardware itself instead of
// allowing HAP-NodeJS to return the cached Characteristic.value.
    lockAccessory
        .getService(Service.LockMechanism)
        .getCharacteristic(Characteristic.LockCurrentState)
        .on('get', function (callback) {

            LockController.status()
                .then( (value) =>{
                    callback(null, value ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED);
                })
                .catch( (err) =>{
                    log.error( err );
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
                    log.error( err );
                    callback(err, null);
                });
        });

    return lockAccessory;
}

module.exports = lock;