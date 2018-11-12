'use strict';

module.exports.getBridge = (req, res) => {
};

module.exports.deleteBridge = (req, res) => {
};

module.exports.createBridge = (req, res) => {

    let data = req.swagger.params.data.value;

    global.module.createBridge(data)
        .then( (bridgeInfo) => {
            res.json( bridgeInfo );
        })
        .catch( (err) => {
            res.status(500).json( { code: err.code || 0, message: err.message } );
        });
};
