// const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const url = require('url');
const { app, BrowserWindow } = require('electron');
const micro = require('micro');
const webpack = require('webpack');
const MemoryFS = require('memory-fs');
const WEBPACK_CONFIG = require('./create_webpack.config.js')();
const createMarkup = require('./create_markup');

// Reset the output path on the webpack config, set the base for service.
WEBPACK_CONFIG.output.path = '/';
const SERVICE_DIR = path.join(__dirname, '../src');
const INDEX = '/index.html';

const { createError } = micro;

/**
 * Create a data URL from the given data.
 *
 * @param {String|Buffer}
 * @param {String}
 * @param {Boolean}
 * @returns {String}
 */
const createDataURL = function (data, mime, encode = true) {
  const _data = encode ? `;base64,${new Buffer(data).toString('base64')}` : `,${data}`;
  return `data:${mime}${_data}`;
};

/**
 * Create a data URL for an HTML document.
 *
 * @param {String}
 * @returns {String}
 */
const createMarkupDataURL = function (markup) {
  return createDataURL(markup, 'text/html;charset=utf-8');
};

/**
 * A functional version of `req||res.getHeader`.
 *
 * @param {Object}
 * @param {String}
 * @returns {Void}
 */
const getHeader = function (res, name) {
  return res.getHeader(name);
};

/**
 * Funcitonal version of `res.setHeader`.
 *
 * @param {Object}
 * @param {String}
 * @param {String}
 * @returns {Void}
 */
const setHeader = function (res, name, value) {
  res.setHeader(name, value);
};

/**
 * Sets the content type header with UTF8 encoding.
 *
 * @param {Object}
 * @param {String}
 * @returns {Void}
 */
const setUTFEncodedContentType = function (res, type) {
  setHeader(res, 'Content-Type', `${type}; charset=utf-8`);
};

/**
 * Sets a bunch of headers from a plain object.
 *
 * @param {Object}
 * @param {Object}
 * @returns {Void}
 */
const setHeaders = function (res, headers) {
  Object.keys(headers).forEach(name => setHeader(res, name, headers[name]));
};

/**
 * Instantiate the development server.
 *
 * This will;
 *    - start a sever.
 *    - star webpacl watching
 *    - TODO: start a development interface.
 *
 * @returns {Void}
 */
const createDevServer = function (exec) {
  let pending = true;
  const cache = { _err: null, _stats: null };
  const queue = [];

  // Create the webpack compiler, set a memory FS instance.
  const compiler = webpack(WEBPACK_CONFIG);
  compiler.outputFileSystem = new MemoryFS(cache);

  /**
   * Promisified `memory.readFile` that doesn't reject on
   * missing file.
   *
   * @param {Stirng}
   * @param {Object}
   * @returns {Promise}
   */
  const readFileMemory = function (path, options) { // eslint-disable-line no-shadow
    return new Promise(function (resolve) {
      compiler.outputFileSystem.readFile(path, options, function (_, data) {
        return resolve(data || null);
      });
    });
  };

  /**
   * The async request listener... this is required
   * this is wrapped in a try catch in the micro instance.
   *
   * @param {Object}
   * @param {Object}
   * @returns {String|Buffer|Stream}
   * @private
   */
  const listener = async function (req, res) {
    // CORS headers.
    setHeaders(res, {
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': 'no-cache',
    });

    // Method not allowed and build error handling.
    if (req.method !== 'GET') throw createError(405, 'Method Not Allowed');

    // Grab the pathname... check the cache;
    let data = null;
    let { pathname } = url.parse(req.url);
    if (pathname === '/') pathname = INDEX;

    let p;
    let fn;

    (function () {
      let resolve;
      let reject;

      // A `Promise` to await.
      p = new Promise(function (_resolve, _reject) {
        resolve = _resolve;
        reject = _reject;
      });

      /**
       * Called whenever webpack isn't building, resolves
       * or rejects `p`.
       *
       * @returns {Void}
       */
      fn = async function () {
        if (cache._err) return reject(createError(500, 'Webpack Error', cache._err));
        if (cache._stats.hasErrors()) {
          const { errors } = cache._stats.toJson();
          return reject(createError(500, 'Webpack Build Error', errors));
        }
        return resolve(await readFileMemory(pathname));
      };
    }());

    // All files await a build.
    !pending ? fn() : queue.push(fn); // eslint-disable-line no-unused-expressions
    data = await p;

    /**
     * If the content isn't being served by webpack, then it's
     * either going to be a request for the markup or for something
     * from disk, so just look for it.
     */
    if (!data) {
      try {
        /**
         * TODO: Check the file size and return a stream where
         * it's appropriate in this situation.
         */
        data = pathname !== INDEX ?
          await readFile(path.join(SERVICE_DIR, path.normalize(pathname))) :
          await createMarkup();
      } catch (err) {
        // 404... couldn't be found.
        throw createError(404, 'Not Found');
      }
    }

    // Set the content type.
    const extname = path.extname(pathname);
    switch (extname) {
      case '.html':
      case '.htm':
        setUTFEncodedContentType(res, 'text/html');
        break;
      case '.css':
        setUTFEncodedContentType(res, 'text/css');
        break;
      case '.js':
      case '.es':
        setUTFEncodedContentType(res, 'application/javascript');
        break;
      default:
        res.setHeader('Content-Type', 'application/octet-stream');
        break;
    }

    if (getHeader(res, 'Content-Type') !== 'application/octet-stream') data = data.toString('utf8');
    return data;
  };

  // Create the server, set headers.
  const server = micro(async function (req, res) {
    let d;
    try {
      d = await listener(req, res);
    } catch (err) {
      // TODO: Handle errors sensbily.
      console.log(err.message);
      return null;
    }
    return d;
  });

  /**
   * Starve the queue of functions.
   *
   * @returns {Void}
   */
  const schedule = function () {
    let fn;
    while (fn = queue.shift()) fn(); // eslint-disable-line no-cond-assign
  };

  /**
   * Schedule compilation.
   *
   * @returns {Void}
   */
  const tock = function () {
    pending = true;
    return true;
  };

  compiler.watch({}, async function (err, stats) {
    pending = false;
    Object.assign(cache, { _err: err, _stats: stats });
    schedule();
    return await exec();
  });

  // Add compilation lifecycle hooks and listen.
  compiler.plugin('watch-run', tock);
  compiler.plugin('run', tock);
  server.listen(3000);
};

const createRenderer = (function () {
  // Global reference to prevent GC.
  let win;

  /**
   * TODO: Add `titlebarStyle` of hidden inset.
   */
  const WINDOW_OPTIONS = {
    width: 1024,
    height: 768,
    backgroundColor: '#1f3153',
    show: true,
    offscreen: true,
    resizable: true,
    vibrancy: 'ultra-dark',
    webPreferences: {
      webSecurity: false,
    },
  };

  /**
   * Create a `BrowserWindow` with the above options...
   * opens dev tools, although not detached ATM.
   *
   * @returns {Void}
   */
  return function () {
    if (!win) win = new BrowserWindow(WINDOW_OPTIONS);
    win.webContents.openDevTools({});

    // Window lifecycle listeners.
    win.on('ready-to-show', () => win.show());
    win.on('closed', () => win = null); // eslint-disable-line no-return-assign

    return async function () {
      if (win !== null) {
        const m = await createMarkup();
        win.loadURL(createMarkupDataURL(m), { baseURLForDataURL: 'http://localhost:3000/' });
      }
    };
  }
}());


// Application lifecycle listeners.
app.on('ready', () => createDevServer(createRenderer()));
app.on('window-all-closed', () => (process.platform !== 'darwin') && app.quit());
app.on('activate', () => createRenderer());
