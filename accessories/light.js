const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

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
            let v = Convert.hex.hsl( parseInt(`0x${value.red}`), parseInt(`0x${value.green}`), parseInt(`0x${value.blue}`) );

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
            return new Promise( (fulfill, reject) => {
                if ( this.power === value )
                    return fulfill();

                server.call(`/light/${uuid}/${value?'on':'off'}`)
                    .then(()=>{
                        this.power = value;
                        fulfill();
                    })
                    .catch( (err) =>{
                        reject(err);
                    })
            })

        },

        getPower: function() { //get power of accessory
            return new Promise( (fulfill, reject) => {
                LightController.status()
                    .then( () => {
                        fulfill( this.power );
                    })
                    .catch( (err) =>{
                        reject(err);
                    });
            })
        },

        setBrightness: function(value) { //set brightness
            return new Promise( (fulfill, reject) => {
                server.call(`/light/${uuid}/level/${value}`)
                    .then(() => {
                        this.brightness = value;
                        fulfill();
                    })
                    .catch((err) => {
                        reject(err);
                    })
            });
        },

        getBrightness: function() { //get brightness
            return new Promise( (fulfill, reject) => {
                LightController.status()
                    .then( () => {
                        fulfill( this.brightness );
                    })
                    .catch( (err) =>{
                        reject(err);
                    });
            });
        },

        setSaturation: function(value) {

            return new Promise( (fulfill, reject) =>{

                let v = Convert.hsl.rgb( this.hue,
                    value,
                    this.brightness );

                let rgb = {
                    r: v[0],
                    g: v[1],
                    b: v[2]
                };

                server.call(`/light/${uuid}/rgb/color?r=${rgb.r}&g=${rgb.g}&b=${rgb.b}&w=0`)
                    .then(()=>{
                        this.saturation = value;
                        fulfill();
                    })
                    .catch( (err) =>{
                        reject(err);
                    })
            });

        },

        getSaturation: function() {
            return new Promise( (fulfill, reject) => {
                LightController.status()
                    .then( () => {
                        fulfill( this.saturation );
                    })
                    .catch( (err) =>{
                        reject(err);
                    });
            });
        },

        setHue: function(value) { //set brightness

            return new Promise( (fulfill, reject) =>{

                let v = Convert.hsl.rgb( value,
                    this.saturation,
                    this.brightness );

                let rgb = {
                    r: v[0],
                    g: v[1],
                    b: v[2]
                };

                server.call(`/light/${uuid}/rgb/color?r=${rgb.r}&g=${rgb.g}&b=${rgb.b}&w=0`)
                    .then(()=>{
                        this.hue = value;
                        fulfill();
                    })
                    .catch( (err) =>{
                        reject(err);
                    })
            });
        },

        getHue: function() { //get hue
            return new Promise( (fulfill, reject) => {
                LightController.status()
                    .then( () => {
                        fulfill( this.hue );
                    })
                    .catch( (err) =>{
                        reject(err);
                    });
            });
        },

        identify: function() { //identify the accessory
            return name;
        },

        status: function () {
            return new Promise( (fulfill, reject) =>{
                server.getDeviceStatus(uuid)
                    .then ( (data) => {
                        data = data[0];

                        if ( data.switch ) {

                            if (data.switch.level !== undefined)
                                this.brightness = parseInt( data.switch.level );

                            if (data.switch.on !== undefined )
                                this.power = data.switch.on;
                        }

                        if ( data.color !== undefined )
                            this.setRGB( data.color );

                        fulfill( data );
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
            LightController.setPower(value)
                .then(() =>{
                    callback(null);
                })
                .catch((err)=>{
                    callback(err);
                });
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

    // also add an "optional" Characteristic for Brightness
    if ( type.startsWith( 'light.dimmable' ) ) {
        lightAccessory
            .getService(Service.Lightbulb)
            .addCharacteristic(Characteristic.Brightness)
            .on('set', function (value, callback) {
                //LightController.lastBrightness = value;
                LightController.setBrightness(value)
                    .then(() =>{
                        callback(null);
                    })
                    .catch((err)=>{
                        callback(err);
                    });

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
                LightController.setSaturation(value)
                    .then(() =>{
                        callback(null);
                    })
                    .catch((err)=>{
                        callback(err);
                    });
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
                LightController.setHue(value)
                    .then(() =>{
                        callback(null);
                    })
                    .catch((err)=>{
                        callback(err);
                    });
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


    // To inform HomeKit about changes occurred outside of HomeKit (like user physically turn on the light)
    // Please use Characteristic.updateValue
    //
    server.subscribe( uuid, function(status){

        if ( status.switch ) {

            LightController.power = status.switch.on;

            lightAccessory
                .getService(Service.Lightbulb)
                .getCharacteristic(Characteristic.On)
                .updateValue(LightController.power);

            if (status.switch.level !== undefined){

                LightController.brightness = parseInt( status.switch.level );

                lightAccessory
                    .getService(Service.Lightbulb)
                    .getCharacteristic(Characteristic.Brightness)
                    .updateValue(LightController.brightness);
            }
        }

        if ( status.color !== undefined ) {
            LightController.setRGB(status.color);

            lightAccessory
                .getService(Service.Lightbulb)
                .getCharacteristic(Characteristic.Saturation)
                .updateValue(LightController.saturation);
            lightAccessory
                .getService(Service.Lightbulb)
                .getCharacteristic(Characteristic.Hue)
                .updateValue(LightController.hue);
        }

    });

    return lightAccessory;
}

module.exports = light;