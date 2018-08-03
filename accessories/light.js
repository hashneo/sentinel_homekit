const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;

const Convert = require('color-convert');

function light(server, type, uuid, name) {

    let that = this;

    let LightController = {

        power : false,
        brightness : 0,
        saturation : 0,
        hue : 0,
        manufacturer : 'sentinel',
        model : 'sentinel',
        serialNumber : uuid,

        setRGB : function(value) {

            let v = Convert.hex.hsl( value.substring(0,6) );

            this.hue = v[0];
            this.saturation = v[1];
            this.brightness = v[2];
        },

        getRGB : function() {

            let v = Convert.hsl.rgb( this.hue,
                this.saturation,
                this.brightness );

            return {
                r: v[0],
                g: v[1],
                b: v[2]
            };
        },

        setPower: function(value) { //set power of accessory
            this.power = value;
            return server.call(`/light/${uuid}/${value?'on':'off'}`);
        },

        getPower: function() { //get power of accessory
            return new Promise( (fulfill, reject) => {
                fulfill( this.power );
            })
        },

        setBrightness: function(value) { //set brightness
            this.brightness = value;
            let rgb = this.getRGB();
            console.log(rgb);

            if ( type === 'light.dimmable.rgbw')
                return server.call(`/light/${uuid}/rgb/color?r=${rgb.r}&g=${rgb.g}&b=${rgb.b}&w=0`);
            else
                return server.call(`/light/${uuid}/level/${value}`);
        },

        getBrightness: function() { //get brightness
            return new Promise( (fulfill, reject) => {
                fulfill( this.brightness );
            });
        },

        setSaturation: function(value) {
            this.saturation = value;
            let rgb = this.getRGB();
            console.log(rgb);
            return server.call(`/light/${uuid}/rgb/color?r=${rgb.r}&g=${rgb.g}&b=${rgb.b}&w=0`);
        },

        getSaturation: function() {
            return new Promise( (fulfill, reject) => {
                fulfill( this.saturation );
            });
        },

        setHue: function(value) { //set brightness
            this.hue = value;
            let rgb = this.getRGB();
            console.log(rgb);
            return server.call(`/light/${uuid}/rgb/color?r=${rgb.r}&g=${rgb.g}&b=${rgb.b}&w=0`);
        },

        getHue: function() { //get hue
            return new Promise( (fulfill, reject) => {
                fulfill( this.hue );
            });
        },

        identify: function() { //identify the accessory
            return name;
        },

        status: function () {
            return new Promise( (fulfill, reject) =>{
                server.call(`/device/${uuid}/status`)
                    .then ( (data) => {
                        fulfill( data[0] );
                    })
                    .catch( (err) => {
                        reject(err);
                    });
            });
        }
    };

    // This is the Accessory that we'll return to HAP-NodeJS that represents our light.
    let lightAccessory = exports.accessory = new Accessory(name, uuid);

    // Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
    lightAccessory.username = LightController.username;
    lightAccessory.pincode = LightController.pincode;

    // set some basic properties (these values are arbitrary and setting them is optional)
    lightAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, LightController.manufacturer)
        .setCharacteristic(Characteristic.Model, LightController.model)
        .setCharacteristic(Characteristic.SerialNumber, LightController.serialNumber);

    // listen for the "identify" event for this Accessory
    lightAccessory.on('identify', function(paired, callback) {
        LightController.identify();
        callback();
    });

    // Add the actual Lightbulb Service and listen for change events from iOS.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    lightAccessory
        .addService(Service.Lightbulb, name) // services exposed to the user should have "names" like "Light" for this case
        .getCharacteristic(Characteristic.On)
        .on('set', function(value, callback) {
            LightController.setPower(value);

            // Our light is synchronous - this value has been successfully set
            // Invoke the callback when you finished processing the request
            // If it's going to take more than 1s to finish the request, try to invoke the callback
            // after getting the request instead of after finishing it. This avoids blocking other
            // requests from HomeKit.
            callback();
        })
        // We want to intercept requests for our current power state so we can query the hardware itself instead of
        // allowing HAP-NodeJS to return the cached Characteristic.value.
        .on('get', function(callback) {
            LightController.getPower()
                .then( (value) => {
                    callback(null, value);
                })
                .catch( (err) =>{
                    callback(err, null);
                });
        });

    // To inform HomeKit about changes occurred outside of HomeKit (like user physically turn on the light)
    // Please use Characteristic.updateValue
    //
    server.subscribe( uuid, function(status){

        LightController.power = status.on;

        lightAccessory
            .getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .updateValue(LightController.power);

        if ( type === 'light.dimmable.rgbw') {

            LightController.setRGB(status.color);

            lightAccessory
                .getService(Service.Lightbulb)
                .getCharacteristic(Characteristic.Brightness)
                .updateValue(LightController.getBrightness());
            lightAccessory
                .getService(Service.Lightbulb)
                .getCharacteristic(Characteristic.Saturation)
                .updateValue(LightController.getSaturation());
            lightAccessory
                .getService(Service.Lightbulb)
                .getCharacteristic(Characteristic.Hue)
                .updateValue(LightController.getHue());

        } else if ( type === 'light.dimmable') {

            LightController.brightness = status.level;
            lightAccessory
                .getService(Service.Lightbulb)
                .getCharacteristic(Characteristic.Brightness)
                .updateValue(LightController.getBrightness());
        }
    });


    // also add an "optional" Characteristic for Brightness
    lightAccessory
        .getService(Service.Lightbulb)
        .addCharacteristic(Characteristic.Brightness)
        .on('set', function (value, callback) {
            LightController.setBrightness(value);
            callback();
        })
        .on('get', function (callback) {
            LightController.getBrightness()
                .then((value) => {
                    callback(null, value);
                })
                .catch((err) => {
                    callback(err, null);
                });
        });

    if ( type === 'light.dimmable.rgbw') {
        // also add an "optional" Characteristic for Saturation
        lightAccessory
            .getService(Service.Lightbulb)
            .addCharacteristic(Characteristic.Saturation)
            .on('set', function (value, callback) {
                LightController.setSaturation(value);
                callback();
            })
            .on('get', function (callback) {
                LightController.getSaturation()
                    .then((value) => {
                        callback(null, value);
                    })
                    .catch((err) => {
                        callback(err, null);
                    });
            });

        // also add an "optional" Characteristic for Hue
        lightAccessory
            .getService(Service.Lightbulb)
            .addCharacteristic(Characteristic.Hue)
            .on('set', function (value, callback) {
                LightController.setHue(value);
                callback();
            })
            .on('get', function (callback) {
                LightController.getHue()
                    .then((value) => {
                        callback(null, value);
                    })
                    .catch((err) => {
                        callback(err, null);
                    });
            });
    }

    return lightAccessory;
}

module.exports = light;