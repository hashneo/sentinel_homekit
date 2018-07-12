const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;


function rgbToHsl(r, g, b, w) {
    r /= 255, g /= 255, b /= 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
    }

    return { h : h, s : s, l : l };
}

function hslToRgb(h, s, l) {
    let r, g, b;

    h *= 255, s *= 255, l *= 255;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;

        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return { r : r * 255, g : g * 255, b : b * 255, w : 0 };
}

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
            let hsl = rgbToHsl(
                parseInt(value.substring(0,2), 16),
                parseInt(value.substring(2,4), 16),
                parseInt(value.substring(4,6), 16),
                parseInt(value.substring(6,8), 16)
            );

            this.hue = hsl.h;
            this.saturation = hsl.s;
            this.brightness = hsl.l;
        },

        getRGB : function() {
            return hslToRgb(
                this.hue,
                this.saturation,
                this.brightness
            );
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

    if ( type === 'light.dimmable') {
        lightAccessory
            .getService(Service.Lightbulb)
            .addCharacteristic(Characteristic.Brightness)
            .on('set', function (value, callback) {
                if ( type === 'light.dimmable.rgbw')
                    LightController.setBrightness(parseInt(value) / 255);
                else
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
    }

    if ( type === 'light.dimmable.rgbw') {
        // also add an "optional" Characteristic for Saturation
        lightAccessory
            .getService(Service.Lightbulb)
            .addCharacteristic(Characteristic.Saturation)
            .on('set', function (value, callback) {
                LightController.setSaturation(parseInt(value) / 255);
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
                LightController.setHue(parseInt(value) / 255);
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