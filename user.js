var path = require('path');
var fs = require('fs');
var os = require('os');

'use strict';

module.exports = {
  User: User
};

/**
 * Manages user settings and storage locations.
 */

// global cached config
let config;

// optional custom storage path
let customStoragePath;

function User() {
}

User.config = function() {
  return config || (config = Config.load(User.configPath()));
};

User.storagePath = function() {
  if (customStoragePath) return customStoragePath;
  return path.join(os.homedir(), ".sentinel");
};

User.configPath = function() {
  return path.join(User.storagePath(), "config.json");
};

User.persistPath = function() {
  return path.join(User.storagePath(), "persist");
};

User.cachedAccessoryPath = function() {
  return path.join(User.storagePath(), "accessories");
};

User.setStoragePath = function(path) {
  customStoragePath = path;
};
