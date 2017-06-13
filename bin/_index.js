/**
 * Node core modules.
 */
const path = require('path');
const url = require('url');

/**
 * Webpack.
 */
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

/**
 * All other imported modules.
 */
const chalk = require('chalk'); // eslint-disable-line global-require
const micro = require('micro');
const port = require('get-port');
const { readFile, writeFile, copy } = require('fs-extra');
const { parse, adapter, map, stringify, sequence } = require('@raywhite/pico-dom');

const renderer = new require('markdown-it')({ html: true }); // eslint-disable-line new-cap

/**
 * Server methods.
 */
const { createError } = micro;

/**
 * Metadata can be iimported directly from `package.json`.
 */
const { name, description, author, license } = require('../package.json');

/**
 * The reporters for stderr and stdout.
 *
 * TODO: Replace with something like `ora` - `https://github.com/sindresorhus/ora`
 */
const [progress, panic] = (function () {
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
    const m = `${name}: ${message}`;
    return error ? console.error(fn(m)) : console.log(fn(m)); // eslint-disable-line no-console
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
    if (adapter.isCommentNode(node)) {
      // Add some spacing after the header comment.
      if (adapter.getCommentNodeContent(node).indexOf(author) !== -1) {
        return [node, adapter.createTextNode('\n\n')];
      }

      // Remove all other comment nodes.
      return null;
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
   * Pad a string a string for injection into a comment.
   *
   * @param {String}
   * @returns {String}
   */
  const pad = str => `*** ${str} ************************************************************`.slice(0, 64);

  /**
   * Build the markup for the index / 404 file.
   *
   * TODO: Create an option to add a permalink for
   * gh-pages and to statically inline assets into
   * the markup.
   *
   * TODO: Pass all parameters...
   * make this functional.
   *
   * @param {String}
   * @param {String}
   * @param {String}
   * @returns {String}
   */

  // TODO: Functional version... will break tests, replace return value.
  function (props/**, options */) {
    const { content, href, src, name, description, author, license } = props;
    [content, href, src, name, description, author, license].forEach(function (p) {
      if (item === undefined) throw new Error(`required property ${p} was undefined`);
    });
  }

  return function (content, href, src) {
     /**
     * The JSON-LD metadata to embed into the page.
     *
     * TODO: Potentially add image metadata;
     * Object.assign(schema, { thumbnailUrl: image, image })
     */
    const JSONLD_SCHEMA = JSON.stringify({
      '@context': 'http://schema.org',
      '@type': 'WebPage',
      name,
      description,
      author,
      license,
    });

    return create(`
<!-- ***********************************************************
****************************************************************
${pad(name)}
****************************************************************
${pad(author)}
****************************************************************
************************************************************ -->

<meta property="og:title" content="${name}"/>
<meta property="og:site_name" content="${name}"/>
<meta property="og:description" content="${description}"/>

<script type="application/ld+json">${JSONLD_SCHEMA}</script>

<meta name="viewport" content="width=device-width, initial-scale=1">

<title>${name}</title>

<link rel="icon" href="/${name}/public/favicon.png" type="image/png">

<link rel="stylesheet" href="${href}">

<!-- TODO: Should the loading of this script be deferred? -->
<script src="${src}"></script>

${renderer.render(content)}
    `);
  };
}());

const createCompiler = (function () {
  /**
   * Creates a webpack compiler instance with
   * the specified config.
   *
   * @param {Boolean}
    *
   * @returns {Object}
   */
  return function (/** production = false */) {
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
                  /* eslint-disable global-require */
                  require('babel-plugin-transform-class-properties'),
                  require('babel-plugin-transform-object-assign'),
                  require('babel-plugin-transform-es2015-block-scoping'),
                  require('babel-plugin-transform-react-jsx'),
                  /* eslint-enable global-require */
                ],
              },
            },
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
                      /* eslint-disable global-require */
                      require('postcss-import')({}),
                      require('postcss-cssnext')({}),
                      /* eslint-enable global-require */
                    ],
                  },
                },
              ],
            }),
          },
        ],
      },
      plugins: [
        new ExtractTextPlugin('index.packed.css'),
      ],
      watchOptions: {
        aggregateTimeout: 256,
        poll: 512,
      },
    });
  };
}());

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
  const setHeader = function (res, name, value) { // eslint-disable-line no-shadow
    return res.setHeader(name, value);
  };

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
  const getHeader = function (res, name) { // eslint-disable-line no-shadow, no-unused-vars
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
    return micro(async function (req, res) {
      try {
        // Allow only get requests.
        if (req.method !== 'GET') throw createError(405, 'Method Not Allowed');

        const { pathname } = url.parse(req.url);

        setHeaders(res, {
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Cache-Control': 'no-cache',
        });

        // TODO: Use a switch statement instead.
        let data;
        if (pathname === '/') {
          data = await readFile('./dist/index.html', 'utf-8');
          setHeader(res, 'Content-Type', 'text/html; charset=utf-8');
        } else if (pathname === '/index.packed.css') {
          data = await readFile('./dist/index.packed.css', 'utf-8');
          setHeader(res, 'Content-Type', 'text/css; charset=utf-8');
        } else if (pathname === '/index.packed.js') {
          data = await readFile('./dist/index.packed.js', 'utf-8');
          setHeader(res, 'Content-Type', 'application/javascript; charset=utf-8');
        } else if (path.extname(pathname)) {
          const _pathname = path.join(__dirname, '../dist', path.normalize(pathname));
          data = await readFile(_pathname);
        } else { throw new Error(); }

        progress(`serving ${pathname}`, 'white');
        return data;
      } catch (err) {
        panic(err);
        if (err.statusCode) throw err;
        throw createError(404, 'Not Found');
      }
    });
  };
}());

/**
 * Compile the contents of the site.
 *
 * @param {Boolean} NOTE: Not implemented.
 * @returns {Promise}
 * @private
 */
async function build(/** prod */) {
  progress('running webpack build');

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
            .replace(/^Hash: /, '')
            .split('\n')
            .map(l => `   ${l}`)
            .join('\n')
            .trim();

          progress(str, 'yellow');
          return resolve();
        });
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
          const markup = createDocument(content, '/index.packed.css', 'index.packed.js');
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
 * Creates a handler for the webpack build proecess...
 * if an interface is passed the window developmnet
 * window will be automitically reloaded.
 */
const createHandler = function () {
  return async function (err, stats) {
    /* eslint-disable no-shadow */
    try {
      if (err) throw err;

      const info = stats.toJson();

      if (stats.hasErrors()) panic(info.errors);
      if (stats.hasWarnings()) panic(info.warnings);

      // Report success.
      progress('weback build success', 'blue');

      // Grab the build stats... format and log.c
      const str = stats.toString({ color: false, chunks: false })
        .replace(/^Hash: /, '')
        .split('\n')
        .map(l => `   ${l}`)
        .join('\n')
        .trim();

      progress(str, 'yellow');

      await Promise.all([
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
            const markup = createDocument(content, '/index.packed.css', 'index.packed.js');
            await writeFile('./dist/index.html', markup);
          } catch (err) { throw err; }

          progress('index document generated');
        }()),
      ]);

      progress('completed build... reload!');

      // Load the url.
      // if (win !== null) win.loadURL('../dist/index.html');
    } catch (err) {
      panic(err.stack || err);
      if (err.details) panic(err.details);
    }
    /* eslint-enable no-shadow */
  };
};

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
    '--serve': async function () {
      const p = await port(5000);
      createCompiler().watch({}, createHandler());
      createServer().listen(p);
      progress(`server listener on port ${p}`);
    },

    /**
     *  TODO: Serve inside electron and reload... an incremental feature.
     *
     * '--serve:interface': function () {
     * const p = await port(5000);
     * createCompiler().watch({}, createHandler());
     * createServer().listen(p);
     * progress(`server listener on port ${p}`);
     * },
     */
  };

  const arg = argv.pop();

  /**
   * TODO: Log a sensible error when the command isn't recognised.
   */
  const command = fns[arg];
  if (command) await command();
}(process.argv));
