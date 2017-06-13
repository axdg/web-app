/** @jsx adapter.createNode */

/**
 * Node core modules.
 */
const path = require('path');
const url = require('url');

/**
 * Electron modules.
 */
const { app, BrowserWindow } = require('electron');

/**
 * All other imported modules.
 */
const { readFile, writeFile, exists, copy } = require('fs-extra');
const { micro, send, sendError, createError } = require('micro');
const { parse, adapter, map, stringify, sequence } = require('@raywhite/pico-dom');
const renderer = new require('markdown-it')({ html: true });

/**
 * Metadata can be iimported directly from `package.json`.
 */
const { name, description, author, license } = require('../package.json');

// The reporters for stdin and stdout.
const [progress, panic] = (function () {
  const chalk = require('chalk');

  /**
   * Log to stdout or stderr using the provided colorization.
   *
   * @param {String}
   * @param {String}
   * @param {Boolean}
   * @returns {Void}
   * @private
   */
  const _progress = function (message, color = 'cyan', error = false) {
    const fn = chalk[color];
    const m = `${name}: ${message}`
    return error ? console.error(fn(m)) : console.log(fn(m));
  };

  /**
   * A wrapper utility to stderr with red colorization.
   *
   * @param {String}
   * @returns {Void}
   * @private
   */
  const _panic = function (message) {
    return _progress(message, 'red', true);
  };

  return [_progress, _panic];
}());

const createDocument = (function () {
  const fn = function (node) {
    // Add a some spacing after the initial comment.
    if (adapter.isCommentNode(node) && adapter.getCommentNodeContent(node).indexOf(author) !== -1) {
      return [node, adapter.createTextNode('\n\n')];
    }

    // Remove empty text nodes (minify).
    if (adapter.isTextNode(node) && !adapter.getTextNodeContent(node).trim()) {
      return null;
    }

    return node;
  };

  /**
   * Parse the contents of the index file as a document.
   *
   * @param {Stirng}
   * @returns {String}
   * @private
   */
  const create = sequence(parse.bind(null, true), map.bind(null, fn), stringify);

  /**
   * The JSON-LD metadata to embed into the page.
   *
   * TODO: Add image metadata.
   * Object.assign(schema, { thumbnailUrl: image, image })
   */
  const schema = JSON.stringify({
      '@context': 'http://schema.org',
      '@type': 'WebPage',
      name,
      description,
      author,
      license,
  });

  /**
   * Slice the comment lines to a total length of 64 chars.
   *
   * @param {String}
   * @returns {String}
   * @private
   */
  const slice = str => str.slice(0, 64);

  /**
   * Build the markup for the index / 404 file.
   *
   * TODO: Add permalink for gh-pages 404.
   *
   * @param {String}
   * @param {String}
   * @param {String}
   * @returns {String}
   */
  return function (content, href, src) {
    const _name = slice(`*** ${name} ************************************************************`);
    const _author = slice(`*** ${author} ************************************************************`);

    return create(`
<!-- ***********************************************************
****************************************************************
${_name}
****************************************************************
${_author}
****************************************************************
************************************************************ -->

<meta property="og:title" content="${name}"/>
<meta property="og:site_name" content="${name}"/>
<meta property="og:description" content="${description}"/>

<script type="application/ld+json">${JSON.stringify(schema)}</script>

<meta name="viewport" content="width=device-width, initial-scale=1">

<title>${name}</title>

<link rel="icon" href="/minimal/public/favicon.png" type="image/png">

<link rel="stylesheet" href="${href}">

<!-- NOTE: It's possible that loading of this should be deferred. -->
<script src="${src}"></script>

${renderer.render(content)}
    `);
  };
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
    return webpack({
      entry: './src/index.js',
      output: {
        filename: 'index.packed.js',
        path: path.join(__dirname, '../', 'dist'),
        publicPath: ('/public/'),
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
             * CSS setup is simple, it just inlines imports
             * and applies transformation of future syxntax.
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
                      require('postcss-import')({}),
                      require('postcss-cssnext')({}),
                    ],
                  }
                }
              ],
            })
          },
        ],
      },
      plugins: [
        new ExtractTextPlugin('index.packed.css'),
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

    /**
     * Load the url and figure out how to connect the
     * the console outputs.
     */
    // win.loadURL();

    win.on('close', function () {
      win === null;
    });
  };

  return function (compiler) {
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

      /**
       * No errors to report... so we can reload the window,
       * but only if it actually exists.
       */
      if (win !== null) {/** Reload the document */}
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
  /**
   * A functional version of `setHeader`.
   *
   * @param {Object}
   * @param {String}
   * @param {String}
   * @returns {Void}
   * @private
   */
  const setHeader = function (res, name, value) {
    return res.setHeader(name, value);
  }

  /**
   * A functional version of `setHeader`.
   *
   * @param {Object}
   * @param {Object}
   * @returns {Void}
   * @private
   */
  const setHeaders = function (res, headers) {
    Object.keys(headers).forEach(function (key) {
      setHeader(res, key, headers[key]);
    });
  };

  /**
   * A functional version of `getHeader`.
   *
   * @param {Object}
   * @param {Strinf}
   * @returns {Void}
   * @private
   */
  const getHeader = function (res, name) {
    return res.getHeader(name);
  };

  /**
   * Returns the micro server... we'd need to call listen
   * on that too.
   *
   * @returns {Object}
   * @private
   */
  return function () {
    micro(async function (req, res) {
      try {
        // Allow only get requests.
        if (req.method !== 'GET') throw createError(405, 'Method Not Allowed');

        const { pathname } = url.parse(req.url);

        setHeaders(res, {
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        });

        if (pathname === '/') {
          const [cascade, script] = await Promise.all([
            readFile(/** Path to the bundled css. */),
            readFile(/** Path to the bundled script. */)
          ]);

          /**
           * TODO: This function needs to take both that cascade and the
           * script and generate an index markup file... the script can
           * be base64 encoded and dumped into the file.
           */
          createDocument(content, href, src);
        }

        // Serve JS, CSS and HTML5 with a content type (read from file).

        // Serve every other type of file as an octet stream.
      } catch (err) {
        /**
         * Switch on error code and serve error markup as required.
         * This would be using some of the same functionality as
         * the live reload functionality that's build into the
         * live reloading application.
         */
        panic(err.stack);
      }
    });
  };
}());

/**
 * Build the contents
 */
async function build () {
  progress('starting webpack build');

  try {
    await Promise.all([
      // Compile the JS using webpack.
      new Promise(function (resolve, reject) {
        createCompiler().run(function (err, stats) {
          if (err) return reject(err);

          const info = stats.toJson();

          if (stats.hasErrors()) panic(info.errors);
          if (stats.hasWarnings()) panic(info.warnings);

          // Report success.
          progress('weback build success', 'blue');

          // Grab the build stats... format and log.c
          const str = stats.toString({ color: false, chunks: false })
            .replace(/^Hash\: /, '')
            .split('\n')
            .map(l => `   ${l}`)
            .join('\n')
            .trim();

          progress(str, 'yellow');
          resolve();
        })
      }),

      // Copy the src files that are needed in dist.
      (async function () {
        progress('transferring static public contents');

        try {
          await copy('./src/public', './dist/public');
        } catch (err) { throw err; }

        progress('transfer of static contents complete');
      }()),

      // Create the index document.
      (async function () {
        progress('generating index document');

        try {
          const content = await readFile('./src/index.md', 'utf-8');
          const markup = createDocument(content, '/index.packed.css', 'index.pack.js');
          await writeFile('./dist/index.html', markup);
        } catch (err) { throw err; }

        progress('index document generated');
      }()),
    ]);

  } catch (err) {
    panic('whoops... something went wrong');
    panic(err.stack || err);
    if (err.details) panic(err.details);
  }

  // Report completion.
  progress('done... building of all assets complete', 'blue');
}

/**
 * Parse whichever arguments was passed in via the command line,
 * and figure out the appropriate logic to run.
 */
(async function (argv) {
  progress('init', 'yellow');
  const fns = {
    /**
     * Make a static build of the application, this
     * should just be used for inspecting everything
     * in the repo, with minification etc.
     */
    '--build': build.bind(null),

    /**
     * Make a production build of the application,
     * this is intended to be called by a deploy script but
     * can also be used to inspect the bundles etc.
     *
     * TODO: Need to pass an some variable in order to bundle with
     * minimization.
     */
    '--build:prod': build.bind(null),

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
      // sequence(createCompiler, createDevInterface)();
    },
  };

  const arg = argv.pop();

  // TODO: Log a sensible error where the command isn't recognised.
  const command = fns[arg];
  if (command) {
    await command();
    return;
  }

  // TODO: Fell, through... command not found.
}(process.argv));
