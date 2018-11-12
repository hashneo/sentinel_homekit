'use strict';

function homekit(config) {

    if ( !(this instanceof homekit) ){
        return new homekit(config);
    }

    var moment = require('moment');

    const Logger = require('sentinel-common').logger;

    let log = new Logger();

    let that = this;

    let bridges = {};

    this.createBridge = (config) => {
        return new Promise( (fulfill, reject) =>{

            let server = require('./server');

            let hapBridge = require('./hapBridge.js')(config, server);

            server.loadSystem()
                .then((system) => {
                    let bridgeInfo = hapBridge.publish(system.devices);

                    bridges[bridgeInfo.serial] = bridgeInfo;

                    let path = global.config.path() + '/' + bridgeInfo.serial;

                    global.consul.kv.set(path, JSON.stringify(bridgeInfo), function (err, data) {
                        if (err)
                            return reject(err);

                        fulfill( bridgeInfo );
                    });
                })
                .catch( (err) =>{
                    reject(err);
                })
        })
    };

    let path = global.config.path() + '/';

    global.consul.kv.keys( path, function (err, keys) {
        if (err) {
            if ( err.statusCode !== 404 )
                throw(err);
            else
                return;
        }
        keys.forEach( (key) => {
            global.consul.kv.get(key, function (err, data) {
                if (err)
                    throw (err);

                that.createBridge( JSON.parse(data.Value) );

            });
        });
    });
}

module.exports = homekit;

