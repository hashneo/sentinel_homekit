'use strict';

const Bridge = require('hap-nodejs').Bridge;
const Service = require('hap-nodejs').Service;
const Characteristic = require('hap-nodejs').Characteristic;
const Accessory = require('hap-nodejs').Accessory;
const accessoryStorage = require('node-persist');

const uuidv4 = require( 'uuid/v4' );

const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const User = require('./user').User;

const Logger = require('sentinel-common').logger;

let log = new Logger();

function server() {

    if ( !(this instanceof server) ){
        return new server();
    }

    let that = this;

    accessoryStorage.initSync({ dir: User.cachedAccessoryPath() });

    let bridge = new Bridge('Sentinel Server', uuidv4());

    function toTitleCase(str) {
        return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }

    this.publish = function () {
        // pull out our custom Bridge settings from config.json, if any
        let bridgeConfig = {};

        let info = bridge.getService(Service.AccessoryInformation);

        info.setCharacteristic(Characteristic.Manufacturer, `Sentinel`);
        info.setCharacteristic(Characteristic.Model, `Sentinel`);
        info.setCharacteristic(Characteristic.SerialNumber, 'CC:22:3D:E3:CE:30');
        info.setCharacteristic(Characteristic.FirmwareRevision, '0.1');

        bridge.on('listening', function(port) {
            log.info("Homebridge is running on port %s.", port);
        });

        bridge.on('identify', function(paired, callback) {
            log.info('Node Bridge identify');
            callback(); // success
        });

        // Add them all to the bridge
        /*
        accessories.forEach(function(accessory) {
            bridge.addBridgedAccessory(accessory);
        });
*/
        let publishInfo = {
            username: "CC:22:3D:E3:CE:30",
            port: 0,
            pincode: "031-45-154",
            category: Accessory.Categories.BRIDGE
        };

        bridge.publish(publishInfo, false);

        printSetupInfo();
        printPin(publishInfo.pincode);

    };

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
}

let s = new server();

s.publish();

let signals = { 'SIGINT': 2, 'SIGTERM': 15 };
Object.keys(signals).forEach(function (signal) {
    process.on(signal, function () {
        bridge.unpublish();
        setTimeout(function (){
            process.exit(128 + signals[signal]);
        }, 1000)
    });
});