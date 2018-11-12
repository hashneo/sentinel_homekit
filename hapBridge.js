'use strict';

function hapBridge(config, server) {

    if ( !(this instanceof hapBridge) ){
        return new hapBridge(config, server);
    }

    const Bridge = require('hap-nodejs').Bridge;
    const Service = require('hap-nodejs').Service;
    const Characteristic = require('hap-nodejs').Characteristic;
    const Accessory = require('hap-nodejs').Accessory;
    const accessoryStorage = require('node-persist');
    const uuidv4 = require( 'uuid/v4' );
/*
    const chalk = require('chalk');
    const qrcode = require('qrcode-terminal');
*/
    const User = require('./user').User;

    const Logger = require('sentinel-common').logger;

    let log = new Logger();

    let that = this;

    accessoryStorage.initSync({ dir: User.cachedAccessoryPath() });

    let bridge = new Bridge(config.name || 'Sentinel Bridge', uuidv4());

    function toTitleCase(str) {
        return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }

    function generate(n) {
        var add = 1, max = 12 - add;   // 12 is the min safe number Math.random() can generate without it starting to pad the end with zeros.

        if ( n > max ) {
            return generate(max) + generate(n - max);
        }

        max        = Math.pow(10, n+add);
        var min    = max/10; // Math.pow(10, n) basically
        var number = Math.floor( Math.random() * (max - min + 1) ) + min;

        return ("" + number).substring(add);
    }

    function dec2hex (dec) {
        return ('0' + dec.toString(16)).substr(-2)
    }

// generateId :: Integer -> String
    function generateId (len) {
        let u = uuidv4().toString().toUpperCase();
        return u.substr(0,8) + u.substr(-4,4);
    }

    function genSerial(){
        let v = [];
        let h = generateId();
        for(let i = 0 ; i < 12 ; i+=2) {
            v.push(h.substr(i,2));
        }
        return v.join(':');
    }

    this.publish = function (devices) {

        return new Promise( (fulfill, reject) => {

            let info = bridge.getService(Service.AccessoryInformation);

            let serial = config.serial || genSerial();
            let pinCode = config.pinCode || `${generate(3)}-${generate(2)}-${generate(3)}`;

            info.setCharacteristic(Characteristic.Manufacturer, `Sentinel`);
            info.setCharacteristic(Characteristic.Model, `Sentinel`);
            info.setCharacteristic(Characteristic.SerialNumber, serial);
            info.setCharacteristic(Characteristic.FirmwareRevision, '0.1');

            bridge.on('listening', function (port) {
                log.info("Homebridge is running on port %s.", port);

                let bridgeInfo = {
                    name: config.name,
                    port: port,
                    serial: serial,
                    pinCode: pinCode,
                    setupURI: bridge.setupURI()
                };

                fulfill( bridgeInfo );
            });

            bridge.on('identify', function (paired, callback) {
                log.info('Node Bridge identify');
                callback(); // success
            });

            let accessories = [];

            const LightAccessory = require('./accessories/light');
            const LockAccessory = require('./accessories/lock');
            const OutletAccessory = require('./accessories/outlet');
            const GarageAccessory = require('./accessories/garage-opener');
            const MotionSensorAccessory = require('./accessories/motion-sensor');
            const TemperatureSensorAccessory = require('./accessories/temperature-sensor');
            const HumiditySensorAccessory = require('./accessories/humidity-sensor');
            const ContactSensorAccessory = require('./accessories/contact-sensor');
            const LeakSensorAccessory = require('./accessories/leak-sensor');
            const Co2SensorAccessory = require('./accessories/co2-sensor');
            const SmokeSensorAccessory = require('./accessories/smoke-sensor');
            const SecuritySystemAccessory = require('./accessories/security-system');

            devices.forEach(function (device) {

                if (device.type.indexOf('light.') == 0) {
                    accessories.push(new LightAccessory(server, device.type, device.id, device.name));
                }

                if (device.type === 'switch') {
                    accessories.push(new OutletAccessory(server, device.type, device.id, device.name));
                }

                if (device.type === 'lock') {
                    accessories.push(new LockAccessory(server, device.id, device.name));
                }

                if (device.type === 'garage.opener') {
                    accessories.push(new GarageAccessory(server, device.id, device.name));
                }

                if (device.type === 'sensor.motion') {
                    accessories.push(new MotionSensorAccessory(server, device.id, device.name));
                }

                if (device.type === 'sensor.temperature') {
                    accessories.push(new TemperatureSensorAccessory(server, device.id, device.name));
                }

                if (device.type === 'sensor.humidity') {
                    accessories.push(new HumiditySensorAccessory(server, device.id, device.name));
                }

                if (device.type === 'sensor.door' || device.type === 'sensor.window') {
                    accessories.push(new ContactSensorAccessory(server, device.id, device.name));
                }

                if (device.type === 'sensor.leak') {
                    accessories.push(new LeakSensorAccessory(server, device.id, device.name));
                }

                if (device.type === 'sensor.co2') {
                    accessories.push(new Co2SensorAccessory(server, device.id, device.name));
                }

                if (device.type === 'sensor.smoke' || device.type === 'sensor.heat') {
                    accessories.push(new SmokeSensorAccessory(server, device.id, device.name));
                }

                if (device.type === 'alarm.partition') {
                    accessories.push(new SecuritySystemAccessory(server, device.id, device.name));
                }
            });

            // Add them all to the bridge
            accessories.forEach(function (accessory) {
                bridge.addBridgedAccessory(accessory);
            });

            let publishInfo = {
                username: serial,
                port: config.port || 0,
                pincode: pinCode,
                category: Accessory.Categories.BRIDGE
            };

            bridge.publish(publishInfo, false);
            /*
                    printSetupInfo();
                    printPin(publishInfo.pincode);
            */

            let signals = {'SIGINT': 2, 'SIGTERM': 15};
            Object.keys(signals).forEach(function (signal) {
                process.on(signal, function () {
                    bridge.unpublish();
                    setTimeout(function () {
                        process.exit(128 + signals[signal]);
                    }, 1000)
                });
            });

        });

    };
/*
    function printPin(pin){
        console.log("Or enter this code with your HomeKit app on your iOS device to pair with Homebridge:");
        console.log(chalk.black.bgWhite("                       "));
        console.log(chalk.black.bgWhite("    ┌────────────┐     "));
        console.log(chalk.black.bgWhite("    │ " + pin + " │     "));
        console.log(chalk.black.bgWhite("    └────────────┘     "));
        console.log(chalk.black.bgWhite("                       "));
    }

    function printSetupInfo() {
        console.log("Setup Payload:");
        console.log(bridge.setupURI());

        console.log("Scan this code with your HomeKit app on your iOS device to pair with Homebridge:");
        qrcode.generate(bridge.setupURI());
    }
*/

}

module.exports = hapBridge;

