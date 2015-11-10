'use strict';

// This plugin requires babel to handle some transpliling
require('babel-core/register')({
  presets: ['react', 'es2015']
});

const ReactHandler = require('./handler');

const registerPlugin = function (server, options, next) {

  server.handler('react', ReactHandler.handler(options.path.relativeTo));

  server.decorate('reply', 'react', function (path, responseOptions) {

    return this.response(ReactHandler.response(path, responseOptions, this.request));
  });

  return next();

};

registerPlugin.attributes = {
  name: 'hapi-react-handler',
  version: '1.0.0',
  dependencies: [],
  connections: false,
  once: true
};

module.exports = registerPlugin;