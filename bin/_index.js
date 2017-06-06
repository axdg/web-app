/** @jsx adapter.createNode */

// const fs = require('fs');
// const path = require('path');

const createServer = require('./create_server');
const createCompiler = require('./create_compiler');

const { parse, adapter, stringify, sequence } = require('@raywhite/pico-dom');

const { app, BrowserWindow } = require('electron')

/**
 * Create the JSONLD metadata for the page.
 *
 * @param {Object}
 * @returns {String}
 * @private
 */
const createJSONLD = function (props) {
  return JSON.stringify(Object.assign({
    '@context': {
      schema: 'schema":"http://schema.org/',
    }
  }, prop));
};

const createDocument = (function () {
  return sequence(stringify, parse.bind(null, true), stringify);
}());

/**
 * Creates markup for the index page, this can
 * be used either during live service, or for
 * for a production build.
 */
const createMarkup = function () {

};

createErrorMarkup = function (str = '') {
  return (
    <fragment>
      <title>nanoapp-b: error</title>
      <favicon />
      <style>
        {`
          html, body {
            margin: 0em,
            padding: 0em,
            font-family: 'courier',
          }

          pre {

          }

          pre code {

          }
        `}
      </style>
      <pre>
        <code>

          {'Whoops... you done goofed!\n\n'}
          {str}
        </code>
      </pre>
    </fragment>
  );
}

const createCompiler = (function () {
  const webpack = require('webpack');
  const ExtractTextPlugin = require("extract-text-webpack-plugin");

  /**
   * Creates a webpack compiler instance with
   * the specified config.
   *
   * @param {Boolean}
    *
   * @returns {Object}
   */
  return function (production = false) {
    return wepback({
      entry: '../src/index.js',
      output: {
        filename: '[name].packed.js',
        path: path.join(__dirname),
        publicPath: ('/assets/'),
      },
      module: {
        rules: [
          {
            /**
             * JS is transpiled through babel.
             */
            test: /\.js$/,
            exclude: /(node_modules|bin)/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: ['latest', 'stage-2'],
                plugins: [
                  require('babel-plugin-transform-class-properties'),
                  require('babel-plugin-transform-object-assign'),
                  require('babel-plugin-transform-es2015-block-scoping'),
                  require('babel-plugin-transform-react-jsx'),
                ]
              }
            }
          },
          {
            /**
             * Automatic inlining of markdown files when they
             * are required.
             */
            test: /.md$/,
            loader: 'raw-loader',
          },
          {
            /**
             * CSS setup is simple, it just inlines imports
             * and applies transformation of future syntax.
             */
            test: /\.css$/,
            use: ExtractTextPlugin.extract({
              fallback: 'style-loader',
              use: [
                'css-loader',
                {
                  loader: 'postcss-loader',
                  options: {
                    // TODO: Add minification to CSS assets (in prod).
                    plugins: () => [
                      require('postcss-import')({})),
                      require('postcss-cssnext')({}),
                    ],
                  }
                }
              ],
            })
          },
          {
            /**
             * Font are pulled out of the source and moved.
             */
            test: /\.(eot|svg|ttf|woff|woff2)$/,
            loader: 'file-loader?name=public/fonts/[name].[ext]'
          }
        ],
      },
      plugins: [
        new ExtractTextPlugin('[name].packed.css'),
      ],
      watchOptions: {
        aggregateTimeout: 256,
        poll: 512,
      }
    });
  };
}());

/**
 * This closure encapsulates all of the app specific
 * code related to the dev interface.
 */
const createDevInterface = (function () {
  let win = null;

  /**
   * Create a dataURI suitable for passing to electrons
   * `browserWindow.loadURL` method.
   *
   * @param {String}
   * @returns {String}
   * @private
   */
  const createDocumentDataURI = function (markup) {
    return `data:text/html;base64,${new Buffer(markup).toString('base64')}`;
  };

  const createErrorDocumentDataURI = sequence(createErrorPageMarkup, createDocument, createDocumentDataURI);
  const createIndexDocumentDataURI = sequence(createIndexPageMarkup, createDocument, createDocumentDataURI);

  const createRenderer = function () {
    // TODO: Add more electron options here.
    win = new BrowserWindow({ width: 1024, height: 768 });

    win.webContents.openDevTools({ mode: 'detach' });

    /** win.loadURL(); // load the document here */
    /** figure out how to connect the processes console outputs */

    win.on('close', function () {
      win === null;
    });
  };

  return function (/** the compiler instance */) {
    // Watch using the compiler, on error display an error page.
    // compiler.watch(function (err, stats) {
    //   // if err... win.loadURL(createErrorDataURI(err))
    //   // report the error to the console.
    // });

    // Create the window instance.
    app.on('ready', createRenderer);

    // When the app is activated, create a window if needed.
    app.on('activate', function () {
      if (win === null) createRenderer();
    });

    // Only quit on window close if we not on macOS.
    app.on('window-all-closed', function () {
      if (process.platform !== 'darwin') app.quit();
    });
  }
}());

const { micro, send, sendError, createError } = require('micro');

const createServer = (function () {
  const { micro, send, sendError, createError } = require('micro');

  return function () {

  };
}());

/**
 * Parse whichever arguments was passed in via the command line,
 * and figure out the appropriate logic to run.
 */
(function (argv) {
  console.log('up and running');

  const fns = {
    /**
     * Make a static build of the application, this
     * should just be used for inspecting everything
     * in the repo, with minification etc.
     */
    '--build': function () {
      console.log('apologies... not implemented');
    },

    /**
     * Make a production build of the application,
     * this is intended to be called by a deploy script but
     * can also be used to inspect the bundles etc.
     */
    '--build:prod': function () {
      console.log('apologies... not implemented');
    },

    /**
     * Watch the app and build on change, for testing
     * builds in various browsers.
     */
    '--serve': function () {
      console.log('apologies... not implemented');
    },

    /**
     * Open the electron based user interface for development,
     * watch files and recompile, reload the window on change
     * or display an error as needed.
     */
    'serve:interface': function () {
      sequence(createCompiler, createDevInterface)();
    },
  };

  const _argv = argv.splice(2);
  const arg = _argv.pop();

  if (argv.length || Object.keys(fns).indexOf(arg) === -1) {} // Throw

  return fns[arg]();
}(process.argv)/** () */); // Uncomment IIFE when complete.
