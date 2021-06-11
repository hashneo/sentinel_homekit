const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const logger = require('sentinel-common').logger;

function securitySystem(server, uuid, name) {

    let that = this;

    let Controller = {

        manufacturer : 'sentinel',
        model : 'sentinel',
        serialNumber : uuid,
        flags : null,
        currentMode : Characteristic.SecuritySystemCurrentState.DISARM,
        targetMode : Characteristic.SecuritySystemTargetState.DISARM,
        nightMode: false,

        setTargetMode: function( mode ){

            return new Promise( (fulfill, reject) => {

                if ( this.targetMode === mode )
                    return fulfill();

                let url = null;

                switch(mode) {
                    case Characteristic.SecuritySystemTargetState.STAY_ARM:
                        url = `/alarm/${uuid}/mode/arm/stay`;
                        break;
                    case Characteristic.SecuritySystemTargetState.AWAY_ARM:
                        url = `/alarm/${uuid}/mode/arm/away`;
                        break;
                    case Characteristic.SecuritySystemTargetState.NIGHT_ARM:
                        url = `/alarm/${uuid}/mode/arm/stay`;
                        break;
                    case Characteristic.SecuritySystemTargetState.DISARM:
                        url = `/alarm/${uuid}/mode/disarm`;
                        break;
                }

                if (url) {
                    server.call(`${url}`)
                        .then( () => {
                            this.nightMode = ( mode === Characteristic.SecuritySystemTargetState.NIGHT_ARM );
                            this.targetMode = mode;
                            fulfill();
                        })
                        .catch( (err) => {
                            reject(err);
                        });
                }else{
                    logger.error( `${mode} is not mapped to a url` );
                    reject('unknown mode');
                }

            });
        },

        identify: function () {
            return name;
        },
        status: function () {
            return new Promise( (fulfill, reject) =>{
                server.getDeviceStatus(uuid)
                    .then ( (data) => {
                        this.flags = data[0].flags;
                        fulfill( this );
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

    function mapCurrentState(value){

        if ( !value )
            return null;

        let flags = value.flags;

        if ( flags === undefined )
            return null;

        if ( flags.armed_away )
            value = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
        else if ( flags.armed_stay ) {
            value = ( Controller.nightMode ? Characteristic.SecuritySystemCurrentState.NIGHT_ARM : Characteristic.SecuritySystemCurrentState.STAY_ARM);
        } else if ( flags.disarmed )
            value = Characteristic.SecuritySystemCurrentState.DISARMED;

        if ( flags.alarm )
            value = Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;

        return value;
    }

    server.subscribe( uuid, function(status){
        Controller.flags = status.flags;

        let currentState = mapCurrentState(status);
        let targetMode = Controller.targetMode;

        if ( Controller.flags.arming ) {
            // If system was armed at the panel we see a different state to the target one so
            // update the target state and inform homekit.
            if (Controller.targetMode !== currentState){
                targetMode = currentState;
            }

            currentState = Controller.lastState;
        }
        else{

            // If we disarm from the panel we need to reflect that in the target and current states
            if ( currentState === Characteristic.SecuritySystemCurrentState.DISARMED ){
                targetMode = currentState;
            }

            Controller.lastState = currentState;

        }

        // If we have changed the target state, inform homekit
        if ( Controller.targetMode !== targetMode ){

            Controller.targetMode = targetMode;

            securitySystemAccessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .updateValue( Controller.targetMode );
        }

        // reflect the current state to homekit
        securitySystemAccessory
            .getService(Service.SecuritySystem)
            .getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .updateValue( currentState );
    });

    securitySystemAccessory
        .addService(Service.SecuritySystem);

    securitySystemAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .on('get', function (callback) {

            Controller.status()
                .then( (value) =>{
                    callback(null, mapCurrentState(value) );
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    securitySystemAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemTargetState)
        .on('set', function(value, callback) {

            Controller.setTargetMode(value)
            .then( (value) =>{
                callback(null);
            })
            .catch( (err) =>{
                callback(err);
            });
        })
        .on('get', function (callback) {
            callback(null, Controller.targetMode );
        });

    securitySystemAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.StatusFault)
        .on('get', function (callback) {

            Controller.status()
                .then( (value) =>{
                    callback(null, value.flags.ready );
                })
                .catch( (err) =>{
                    logger.error( err );
                    callback(err, null);
                });

        });

    return securitySystemAccessory;
}

module.exports = securitySystem;