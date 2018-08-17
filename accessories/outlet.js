const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;

function outlet(server, type, uuid, name) {

    let that = this;

// here's a fake hardware device that we'll expose to HomeKit
    var OutletController = {

        power : false,
        manufacturer : 'sentinel',
        model : 'sentinel',
        serialNumber : uuid,

        setPowerOn: function (on) {
            this.power = on;
            return server.call(`/switch/${uuid}/${on?'on':'off'}`);
        },

        identify: function () {
            return name;
        },

        status: function () {
            return new Promise((fulfill, reject) => {
                server.call(`/device/${uuid}/status`)
                    .then((data) => {
                        OutletController.power = data[0].on;
                        fulfill(OutletController.power);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        }
    };

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake light.
    let outletAccessory = exports.accessory = new Accessory(name, uuid);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
    outletAccessory.username = OutletController.username;
    outletAccessory.pincode = OutletController.pincode;

// set some basic properties (these values are arbitrary and setting them is optional)
    outletAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, OutletController.manufacturer)
        .setCharacteristic(Characteristic.Model, OutletController.model)
        .setCharacteristic(Characteristic.SerialNumber, OutletController.serialNumber);

// listen for the "identify" event for this Accessory
    outletAccessory.on('identify', function (paired, callback) {
        OutletController.identify();
        callback(); // success
    });

// Add the actual outlet Service and listen for change events from iOS.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    outletAccessory
        .addService(Service.Outlet, name) // services exposed to the user should have "names" like "Fake Light" for us
        .getCharacteristic(Characteristic.On)
        .on('set', function (value, callback) {
            OutletController.setPowerOn(value);
            callback(); // Our fake Outlet is synchronous - this value has been successfully set
        });

// We want to intercept requests for our current power state so we can query the hardware itself instead of
// allowing HAP-NodeJS to return the cached Characteristic.value.
    outletAccessory
        .getService(Service.Outlet)
        .getCharacteristic(Characteristic.On)
        .on('get', function (callback) {

            // this event is emitted when you ask Siri directly whether your light is on or not. you might query
            // the light hardware itself to find this out, then call the callback. But if you take longer than a
            // few seconds to respond, Siri will give up.

            OutletController.status()
            .then( (value) =>{
                    callback(null, value);
                })
            .catch( (err) =>{
                log.error( err );
                callback(err, null);
            });

        });

    server.subscribe( uuid, function(status){

        OutletController.power = status.on;

        outletAccessory
            .getService(Service.Outlet)
            .getCharacteristic(Characteristic.On)
            .updateValue(OutletController.power);
    });

    return outletAccessory;

}

module.exports = outlet;