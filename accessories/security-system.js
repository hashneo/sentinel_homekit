const Accessory = require('hap-nodejs').Accessory;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;

function securitySystem(server, uuid, name) {

    let that = this;

    let Controller = {

        manufacturer : 'sentinel',
        model : 'sentinel',
        serialNumber : uuid,
        alarming : false,
        armed: false,
        mode : null,
        targetMode : null,

        setTargetMode: function( mode ){
            this.targetMode = mode;

            let url = null;

            switch(mode) {
                case Characteristic.SecuritySystemTargetState.STAY_ARM:
                    url = `/alarm/${uuid}/arm/stay`;
                    break;
                case Characteristic.SecuritySystemTargetState.AWAY_ARM:
                    url = `/alarm/${uuid}/arm/away`;
                    break;
                case Characteristic.SecuritySystemTargetState.NIGHT_ARM:
                    url = `/alarm/${uuid}/arm/night`;
                    break;
                case Characteristic.SecuritySystemTargetState.DISARM:
                    url = `/alarm/${uuid}/disarm`;
                    break;
            }

            if (url)
                return server.call(`${url}?pin=${global.config.alarm.pin}`);
        },

        identify: function () {
            return name;
        },
        status: function () {
            return new Promise( (fulfill, reject) =>{
                server.call(`/device/${uuid}/status`)
                    .then ( (data) => {

                        this.alarming = data[0].alarming;
                        this.armed = data[0].armed;
                        this.mode = data[0].mode;

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

    function getTargetState(value) {

        if ( Controller.targetMode === null )
            return getCurrentState(value);

        return Controller.targetMode;

    }

    function getCurrentState(value){

        if ( value.mode === 'armed' || value.mode === 'force' || value.mode === 'vacation' )
            value = Characteristic.SecuritySystemCurrentState.AWAY_ARM;

        if ( value.mode === 'stay' || value.mode === 'stay-instant' )
            value = Characteristic.SecuritySystemCurrentState.STAY_ARM;

        if ( value.mode === 'night' || value.mode === 'night-instant' )
            value = Characteristic.SecuritySystemCurrentState.NIGHT_ARM;

        if (value.mode === 'exit-delay' || value.mode === 'entry-delay' ){
            value = Controller.targetMode;
        }

        if ( value.mode === 'not-ready'
            || value.mode === 'failed'
            || value.mode === 'disarmed'
            || value.mode === 'ready' )
            value = Characteristic.SecuritySystemCurrentState.DISARMED;

        if (value.alarming)
            value = Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;

        return value;
    }

    server.subscribe( uuid, function(status){
        this.alarming = status.alarming;
        this.armed = status.armed;
        this.mode = status.mode;

        securitySystemAccessory
            .getService(Service.SecuritySystem)
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .updateValue( getTargetState(status) );

        securitySystemAccessory
            .getService(Service.SecuritySystem)
            .getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .updateValue( getCurrentState(status) );
    });

    securitySystemAccessory
        .addService(Service.SecuritySystem);

    securitySystemAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .on('get', function (callback) {

            Controller.status()
                .then( (value) =>{
                    callback(null, getCurrentState(value) );
                })
                .catch( (err) =>{
                    log.error( err );
                    callback(err, null);
                });

        });

    securitySystemAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemTargetState)
        .on('set', function(value, callback) {

            Controller.setTargetMode(value);

            callback();
        })
        .on('get', function (callback) {

            Controller.status()
                .then( (value) =>{
                    callback(null, getTargetState(value) );
                })
                .catch( (err) =>{
                    log.error( err );
                    callback(err, null);
                });

            //callback(null, Controller.targetMode );
        });

    securitySystemAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.StatusFault)
        .on('get', function (callback) {

            Controller.status()
                .then( (value) =>{
                    callback(null, value.mode === 'not-ready' ? 1 : 0 );
                })
                .catch( (err) =>{
                    log.error( err );
                    callback(err, null);
                });

            //callback(null, Controller.targetMode );
        });

    return securitySystemAccessory;
}

module.exports = securitySystem;