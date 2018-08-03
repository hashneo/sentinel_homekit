'use strict';

const auth = require('../sentinel_common/lib/auth');
const request = require('request');
const WebSocketClient = require('websocket').client;

function server() {

    const that = this;

    let subscriptions = {};

    this.call = (url) => {

        if ( !url.startsWith('/api/') ){
            url = '/api' + url;
        }

        return new Promise((fulfill, reject) => {

            auth.login(global.auth.endpoint, global.config.auth)
                .then((jwt) => {
                    let options = {
                        uri: global.server.endpoint + url,
                        headers: {
                            'Authorization': `Bearer ${jwt}`
                        },
                        method: 'GET'
                    };

                    console.log('calling => ' + options.uri );

                    request(options, (err, resp, body) => {
                        if (err) {
                            return reject(err);
                        }

                        if (resp.statusCode !== 200) {
                            return reject(new Error(resp.statusCode));
                        }

                        try {
                            body = JSON.parse(body);

                            if ( body.result !== 'ok' ) {
                                return reject(new Error('result was not ok'));
                            }

                            fulfill(body.data);
                        }
                        catch (err) {
                            return reject(err);
                        }
                    });
                })
                .catch((err) => {
                    reject(err);
                });
        });
    };

    this.loadSystem = () => {
        return new Promise( (fulfill, reject) => {
            that.call('/api/system')
                .then( (data) => {
                    fulfill(data);
                })
                .catch( (err) => {
                    reject(err);
                });
        });
    };

    this.getDeviceStatus = (id) => {
        return new Promise((fulfill, reject) => {
            this.call(`/api/device/${id}/status`)
                .then((status) => {
                    fulfill(status[0]);
                })
                .catch((err) => {
                    reject(err);
                })
        });
    };

    this.findDeviceByType = (type) => {
        return new Promise((fulfill, reject) => {
            loadSystem()
                .then((system) => {
                    let results = [];

                    system.devices.forEach( (device) =>{
                        if ( device.type === type )
                            results.push(device);
                    });

                    fulfill(results);
                })
                .catch((err) => {
                    reject(err);
                })
        });
    };

    this.findDevice = (name) => {
        return new Promise((fulfill, reject) => {
            loadSystem()
                .then((system) => {
                    system.devices.forEach( (device) =>{
                        if ( device.name === name || device.id === name )
                            return fulfill( device );
                    });

                    fulfill(null);
                })
                .catch((err) => {
                    reject(err);
                })
        });
    };


    this.findScene = (area, name) => {
    };

    this.subscribe = ( device, f ) => {
        subscriptions[device] = f;
    };

    function connectWebSocket(){

        let client = new WebSocketClient();

        client.on('connectFailed', function(error) {
            console.log('Connect Error: ' + error.toString());
            setTimeout( connectWebSocket(), 5000 );
        });

        client.on('connect', function(connection) {

            console.log('WebSocket Client Connected');

            connection.on('error', function(error) {
                console.log("Connection Error: " + error.toString());
                setTimeout( connectWebSocket(), 5000 );
            });

            connection.on('close', function() {
                console.log('echo-protocol Connection Closed');
                setTimeout( connectWebSocket(), 5000 );
            });

            connection.on('message', function(message) {
                if (message.type === 'utf8') {
                    let data = JSON.parse(message.utf8Data);

                    if (subscriptions[data.device])
                        subscriptions[data.device]( data.status );
                }
            });

        });

        auth.login(global.auth.endpoint, global.config.auth)
            .then((jwt) => {
                let headers = {
                    'Authorization': `Bearer ${jwt}`
                };
                let wss = global.server.endpoint.replace('https', 'wss') + '/api/ws';
                client.connect( wss, 'echo-protocol', null, headers );
            })
            .catch((err) => {
                console.error(err);
                process.exit(1);
            });
    }

    connectWebSocket();

}

module.exports = new server();
