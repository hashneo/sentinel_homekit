const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

function Switch(server, type, uuid, name) {

    let that = this;

// here's a fake hardware device that we'll expose to HomeKit
    var SwitchController = {

        power : false,
        manufacturer : 'sentinel',
        model : 'sentinel',
        serialNumber : uuid,

        setPowerOn: function (value) {

            return new Promise( (fulfill, reject) => {
                if ( this.power === value )
                    return fulfill();

                server.call(`/switch/${uuid}/${value?'on':'off'}`)
                    .then(()=>{
                        this.power = value;
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
                        SwitchController.power = data[0].switch.on;
                        fulfill(SwitchController.power);
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
    switchAccessory.username = SwitchController.username;
    switchAccessory.pincode = SwitchController.pincode;

// set some basic properties (these values are arbitrary and setting them is optional)
    switchAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, SwitchController.manufacturer)
        .setCharacteristic(Characteristic.Model, SwitchController.model)
        .setCharacteristic(Characteristic.SerialNumber, SwitchController.serialNumber);

// listen for the "identify" event for this Accessory
    switchAccessory.on('identify', function (paired, callback) {
        SwitchController.identify();
        callback(); // success
    });

// Add the actual switch Service and listen for change events from iOS.
// We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    switchAccessory
        .addService(Service.Switch, name) // services exposed to the user should have "names" like "Fake Light" for us
        .getCharacteristic(Characteristic.On)
        .on('set', function (value, callback) {
            SwitchController.setPowerOn(value);
            callback(); // Our fake Switch is synchronous - this value has been successfully set
        });

// We want to intercept requests for our current power state so we can query the hardware itself instead of
// allowing HAP-NodeJS to return the cached Characteristic.value.
    switchAccessory
        .getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .on('get', function (callback) {

            // this event is emitted when you ask Siri directly whether your light is on or not. you might query
            // the light hardware itself to find this out, then call the callback. But if you take longer than a
            // few seconds to respond, Siri will give up.

            SwitchController.status()
                .then( (value) =>{
                    callback(null, value);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    server.subscribe( uuid, function(status){

        SwitchController.power = status.switch.on;

        switchAccessory
            .getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .updateValue(SwitchController.power);
    });

    return switchAccessory;

}

module.exports = Switch;