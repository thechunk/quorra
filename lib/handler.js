'use strict';

const Path = require('path');
const Joi = require('joi');
const Boom = require('boom');
const Hoek = require('hoek');

const React = require('react');
const renderToString = require('react-dom/server').renderToString;
const match = require('react-router').match;
const RoutingContext = require('react-router').RoutingContext;

let internals = {};

internals.schema = Joi.alternatives([
  Joi.object({
    relativeTo: Joi.string(),
    routerFile: Joi.string(),
    layout: Joi.string().optional(),
    props: Joi.object().optional(),
    state: Joi.object().optional()
  })
]);

exports.handler = (route, options) => {

  let settings = Joi.attempt(options, internals.schema, 'Invalid react handler options (' + route.path + ')');

  // Required properties
  settings.relativeTo = options.relativeTo;
  settings.routerFile = /\.jsx$/.test(settings.routerFile) ? settings.routerFile : settings.routerFile + '.jsx';

  settings.props = options.props || {};
  settings.state = options.state || {};

  if (options.layout) {
    settings.layout = /\.jsx$/.test(options.layout) ? options.layout : options.layout + '.jsx';
  }

  Hoek.assert(typeof settings.relativeTo === 'string', 'Relative path of react files must be set', route.path);
  Hoek.assert(typeof settings.routerFile === 'string', 'Router file must be set', route.path);

  return (request, reply) => {
    return reply(exports.response(settings, request));
  };
};

exports.response = (options, request) => {

  options = options || {};

  var source = {
    path: request.path,
    router: Path.normalize(Hoek.isAbsolutePath(options.routerFile) ? options.routerFile : Path.join(options.relativeTo, options.routerFile)),
    layout: options.layout ?
      Path.normalize(Hoek.isAbsolutePath(options.layout) ? options.layout : Path.join(options.relativeTo, options.layout)) :
      false,
    props: options.props,
    state: options.state,
    settings: options
  };

  return request.generateResponse(source, { variety: 'react', marshal: internals.marshal });

};

internals.marshal = (response, next) => {

  let routes = require(response.source.router);
  routes = routes.default || routes;

  match({ routes, location: response.source.path }, (error, redirectLocation, renderProps) => {
    if (error) {
      next(Boom.wrap(error));
    } else if (redirectLocation) {
      next.redirect(redirectLocation.pathname + redirectLocation.search)
    } else if (renderProps) {
      internals.prepare(response, RoutingContext, renderProps, next);
    } else {
      next(Boom.notFound('Not Found'));
    }
  })
};


internals.prepare = (response, RoutingContext, renderProps, next) => {

  const content = renderToString(<RoutingContext {...renderProps} />);

  if (response.source.layout) {
    let layoutComponent = require(response.source.layout);
    layoutComponent = layoutComponent.default || layoutComponent;

    const Element = React.createFactory(layoutComponent);

    const props = Object.assign({}, response.source.props, {
      content: content,
      state: response.source.state
    });

    const layoutOutput = renderToString(Element(props));

    return next(null, layoutOutput);
  }

  return next(null, content);
};