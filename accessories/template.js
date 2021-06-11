const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

function securitySystem(server, uuid, name) {

    let that = this;

    let Controller = {

        state: false,
        lowBattery: false,
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

    let securitySystemAccessory = exports.accessory = new Accessory(name, uuid);

    securitySystemAccessory.username = Controller.model;
    securitySystemAccessory.pincode = Controller.pincode;

    securitySystemAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, Controller.manufacturer)
        .setCharacteristic(Characteristic.Model, Controller.model)
        .setCharacteristic(Characteristic.SerialNumber, Controller.serialNumber);

    securitySystemAccessory.on('identify', function (paired, callback) {
        Controller.identify();
        callback(); // success
    });

    server.subscribe( uuid, function(status){
    });

    securitySystemAccessory
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


    return securitySystemAccessory;
}

module.exports = securitySystem;