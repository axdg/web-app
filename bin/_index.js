/** @jsx adapter.createNode */

const path = require('path');

const fs = require('fs-extra');
const { app, BrowserWindow } = require('electron');
const { micro, send, sendError, createError } = require('micro');

const { parse, adapter, stringify, sequence } = require('@raywhite/pico-dom');

const createDocument = (function () {
  /**
   * Parse the contents of the index file as a document.
   *
   * @param {Stirng}
   * @returns {String}
   * @private
   */
  return sequence(stringify, parse.bind(null, true), stringify);
}());

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
             * Font are pulled out of the source and moved into the
             * appropriate distribution directory.
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
 * code related to the electron based devlopement
 * interface.
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
    compiler.watch(function (err, stats) {
      /**
       * Error handling is roughly done as per the notes on how the JS
       * API error handling section of the webpack docs dictates - see;
       * `https://webpack.js.org/api/node/#error-handling`.
       */
      if (err) {
        /**
         * TODO: Log and error to the console.
         * TODO: Render an error page, containing details where present.
         */
      }

      const i = stats.toJSON();

      if (stats.hasErrors()) {
        /**
         * TODO: Log and error to the console.
         * TODO: Render an error page, containing `i.errors`
         */
      }

      if (stats.hasWarnings()) {
        /**
         * TODO: Display the warnings in the browser console.
         * TODO: Render the warnings to the console.
         */
      }
    });

    // Create the window instance.
    app.on('ready', createRenderer);

    // When the app is activated, create a window if needed.
    app.on('activate', function () {
      if (win === null) createRenderer();
    });

    // Only quit when the window closes if we're on macOS.
    app.on('window-all-closed', function () {
      if (process.platform !== 'darwin') app.quit();
    });
  }
}());

// TODO: This is where I'm at...
const createServer = (function () {
  return function () {
    // Serve the files as required.
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
    '--serve:interface': function () {
      sequence(createCompiler, createDevInterface)();
    },
  };

  const _argv = argv.splice(2);
  const arg = _argv.pop();

  if (argv.length || Object.keys(fns).indexOf(arg) === -1) {} // Throw

  // TODO: Log a sensible error where the command isn't recognised.
  const command = fns[argv];
  return command ? command() ? null;
}(process.argv));
