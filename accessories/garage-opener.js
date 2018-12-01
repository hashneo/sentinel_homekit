const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

function lock(server, uuid, name) {

    let that = this;

    let GarageController = {

        state : Characteristic.CurrentDoorState.CLOSED,
        manufacturer : 'sentinel',
        model : 'sentinel',
        serialNumber : uuid,

        open: function () {
            //add your code here which allows the garage to open
            this.state = Characteristic.CurrentDoorState.OPENING;
            return server.call(`/door/${uuid}/open`);
        },
        close: function () {
            //add your code here which allows the garage to close
            this.state = Characteristic.CurrentDoorState.CLOSING;
            return server.call(`/door/${uuid}/close`);
        },
        identify: function () {
            return name;
        },
        status: function () {

            return new Promise( (fulfill, reject) =>{
                server.call(`/device/${uuid}/status`)
                    .then ( (data) => {
                        let states = processStatus( data[0].state );
                        GarageController.state = states.current;
                        fulfill( GarageController.state );
                    })
                    .catch( (err) => {
                        reject(err);
                    });
            });

        }
    };

    let garageAccessory = exports.accessory = new Accessory(name, uuid);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
    garageAccessory.username = GarageController.username;
    garageAccessory.pincode = GarageController.pincode;

    garageAccessory
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, GarageController.manufacturer)
        .setCharacteristic(Characteristic.Model, GarageController.model)
        .setCharacteristic(Characteristic.SerialNumber, GarageController.serialNumber);

    garageAccessory.on('identify', function (paired, callback) {
        GarageController.identify();
        callback();
    });

    function processStatus( status ){

        let states = { current: null, target: null };

        if (status.state === 'opening') {
            states.current = Characteristic.CurrentDoorState.OPENING;
            states.target = Characteristic.TargetDoorState.OPEN;
        } else if (status.state === 'open') {
            states.current= Characteristic.CurrentDoorState.OPEN;
            states.target = Characteristic.TargetDoorState.OPEN;
        } else if (status.state === 'closing'){
            states.current = Characteristic.CurrentDoorState.CLOSING;
            states.target = Characteristic.TargetDoorState.CLOSED;
        } else if ( status.state ===  'closed' ) {
            states.current = Characteristic.CurrentDoorState.CLOSED;
            states.target = Characteristic.TargetDoorState.CLOSED;
        }

        return states;
    }

    server.subscribe( uuid, function(status) {

        let states = processStatus( status );

        GarageController.state = states.current;

        garageAccessory
            .getService(Service.GarageDoorOpener)
            .getCharacteristic(Characteristic.TargetDoorState)
            .updateValue( states.target );

        garageAccessory
            .getService(Service.GarageDoorOpener)
            .getCharacteristic(Characteristic.CurrentDoorState)
            .updateValue( states.current );
    });

    garageAccessory
        .addService(Service.GarageDoorOpener, name)
        .setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED) // force initial state to CLOSED
        .getCharacteristic(Characteristic.TargetDoorState)
        .on('set', function (value, callback) {
            if (value == Characteristic.TargetDoorState.CLOSED) {
                GarageController.close()
                    .then ( () =>{
                        callback();
                    })
                    .catch((err) =>{
                        console.error(err);
                        callback(err);
                    });
            }
            else if (value == Characteristic.TargetDoorState.OPEN) {
                GarageController.open()
                    .then ( () =>{
                        callback();
                    })
                    .catch((err) =>{
                        console.error(err);
                        callback(err);
                    });
            }
        });


    garageAccessory
        .getService(Service.GarageDoorOpener)
        .getCharacteristic(Characteristic.CurrentDoorState)
        .on('get', function (callback) {

            GarageController.status()
                .then( (value) =>{
                    callback(null, value);
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    return garageAccessory;
}

module.exports = lock;