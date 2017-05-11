/** @jsx adapter.createNode */

// const fs = require('fs');
// const path = require('path');

const { parse, adapter, stringify, sequence } = require('@raywhite/pico-dom');

const { app, BrowserWindow } = require('electron')
const { micro, send, sendError, createError } = require('micro');

const webpack = require('webpack');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const cssnext = require('postcss-cssnext');
const _import = require('postcss-import');

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

/**
 * Creates a webpack compiler instance with
 * the specified config.
 *
 * @returns {Object}
 */
const createCompiler = function (production = false) {
  // TODO: Add babel config here.
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
          test: /.md$/,
          loader: 'raw-loader',
        },
        {
          test: /\.css$/,
          use: ExtractTextPlugin.extract({
            fallback: 'style-loader',
            use: [
              'css-loader',
              {
                loader: 'postcss-loader',
                options: {
                  // TODO: Add minification to CSS assets.
                  plugins: () => [_import({}), cssnext({})],
                }
              }
            ],
          })
        },
        {
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

const createServer = function () {};

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
