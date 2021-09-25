'use strict';

const SwaggerExpress = require('swagger-express-mw');
const SwaggerUi = require('swagger-tools/middleware/swagger-ui');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const uuid = require('uuid');

let opts = {
    host: process.env.CONSUL || '127.0.0.1',
    port: parseInt( process.env.CONSUL_PORT || '8500' ),
    promisify: true
};

opts.secure = process.env.CONSUL_SECURE || (opts.port === 443);

const consul = require('consul')( opts  );

const logger = require('sentinel-common').logger;

let moduleName = 'homekit';

global.moduleName = moduleName;

app.use(bodyParser.json({limit: '50mb'}));
app.use(cookieParser());

global.consul = consul;

let appConfig = {
    appRoot: __dirname, // required config
    swaggerSecurityHandlers: {
        Oauth: (req, authOrSecDef, scopesOrApiKey, cb) => {
            if (scopesOrApiKey === 'open') {
                cb();
            }else {
                cb();
            }
        }
    }
};

consul.kv.get(`config/sentinel/${moduleName}`, function(err, result) {
    if (err) throw err;

    if (!result)
        result = { Value : null };

    let config = JSON.parse(result.Value);

    if (!config)
        config = {};

    config.save = function(){
        return new Promise( (fulfill, reject) => {
            consul.kv.set( `config/sentinel/${moduleName}`, JSON.stringify(config, null, '\t'), function(err, result) {
                if (err)
                    return reject(err);
                fulfill(result);
            })
        });
    };

    config.path = () => {
        return `config/sentinel/${moduleName}`;
    };

    global.config = config;
    global.config.save();

    //if (process.env.DEBUG) {
        global.auth = {'endpoint': 'https://home.steventaylor.me'};
        global.server = {'endpoint': 'https://home.steventaylor.me'};
    //}

    SwaggerExpress.create(appConfig, function (err, swaggerExpress) {
        if (err) {
            throw err;
        }

        app.use(SwaggerUi(swaggerExpress.runner.swagger));
        // install middleware
        swaggerExpress.register(app);

        let serviceId = process.env.SERVICE_ID || uuid.v4();

        let port = process.env.PORT || undefined;
        let server = app.listen(port, () => {

            let host = process.env.HOST || process.env.SERVICE_NAME || require('ip').address();
            let port = server.address().port;

            let module = {
                id: serviceId,
                name: moduleName,
                address: host,
                port: port,
                active: true,
                endpoint : `http://${host}:${port}`,
                check: {
                    http: `http://${host}:${port}/health?id=${serviceId}`,
                    interval: '15s'
                }
            };

            process.env.SERVICE_ID = serviceId;

            if (swaggerExpress.runner.swagger.paths['/health']) {
                logger.info(`you can get /health?id=${serviceId} on port ${port}`);
            }

            global.module = require(`./${moduleName}.js`)(config);

        });

    });

});

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    process.exit(1);
});

module.exports = app;
