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
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

const msf = new require('memory-fs'); // eslint-disable-line new-cap

/**
 * All other imported modules.
 */
const chalk = require('chalk'); // eslint-disable-line global-require
const micro = require('micro');
const port = require('get-port');
const { readFile, writeFile, copy } = require('fs-extra');
const renderer = new require('markdown-it')({ html: true }); // eslint-disable-line new-cap
const { parse, adapter, map, stringify, sequence } = require('@raywhite/pico-dom');

/**
 * Server methods.
 */
const { createError } = micro;

/**
 * Metadata can be imported directly from `package.json`.
 */
const { name, description, author, license } = require('../package.json');

/**
 * Constants.
 */
const DOCUMENT_PROPERTIES = {
  name,
  description,
  author,
  license,
  href: 'index.packed.css',
  src: 'index.packed.js',
};

const BASE_DIR = path.join(__dirname, '../');
const SRC_DIR = path.join(BASE_DIR, 'src');
const DIST_DIR = path.join(BASE_DIR, 'dist');
const INDEX_MD = path.join(SRC_DIR, 'index.md');

/**
 * The reporters for stderr and stdout.
 *
 * TODO: Replace with something like `ora` - `https://github.com/sindresorhus/ora`
 */
const [progress, panic] = (function () {
  /**
   * Log to stdout or stderr using the provided colorization.
   *
   * TODO: Pass options as a single argument (Object), allowing
   * for interpolation.
   *
   * TODO: Make this a seperate repo.
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
   * A wrapper utility to log to stderr with red colorization.
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

  const comment = function (name, author) {
    return `
      <!-- ***********************************************************
      ****************************************************************
      ${pad(name)}
      ****************************************************************
      ${pad(author)}
      ****************************************************************
      ************************************************************ -->`
        .split('\n').map(s => s.trim()).join('\n');
  };

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
  return function (props/**, options = { live } */) {
    const { content, href, src, name, description, author, license } = props;

    // Check that all of the required props exits.
    [content, href, src, name, description, author, license].forEach(function (p) {
      if (p === undefined) throw new Error(`required property ${p} was undefined`);
    });

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
      ${comment(name, author)}

      <meta property="og:title" content="${name}"/>
      <meta property="og:site_name" content="${name}"/>
      <meta property="og:description" content="${description}"/>

      <script type="application/ld+json">${JSONLD_SCHEMA}</script>

      <meta name="viewport" content="width=device-width, initial-scale=1">

      <title>${name}</title>

      <link rel="icon" href="/public/favicon.png" type="image/png">

      <link rel="stylesheet" href="${href}">

      <!-- TODO: Should the loading of this script be deferred? -->
      <script src="${src}"></script>

      ${renderer.render(content)}
    `);
  }
}());

/**
 * Asyncronously read the index markdown file and
 * generate the index markup document.
 *
 * TODO: Add option to pass live thrrough.
 *
 * @param {String}
 * @param {Object}
 * @param {Object}
 */
const createMarkup = async function (file, props/** , options = { live: false } */) {
  const content = await readFile(file, 'utf8');
  return createDocument(Object.assign({}, props, { content })/**, options*/);
};

const createCompiler = (function () {
  /**
   * Creates a webpack compiler instance with
   * the specified config.
   *
   * TODO: Add compilation options, and sourcemaps.
   *
   * @param {Boolean}
    *
   * @returns {Object}
   */
  return function (/** production = false */) {
    const compiler = webpack({
      entry: path.join(SRC_DIR, 'index.js'),
      output: {
        filename: 'index.packed.js',
        path: DIST_DIR,
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

    return compiler;
  };
}());

/**
 * Creates a webpack compiler instance with
 * the specified config.
 *
 * TODO: Add compilation options, and sourcemaps.
 *
 * @param {Object}
  *
 * @returns {Object}
 */
const _createCompiler = function (options) {
  const { production = false, fs = null } = options;

  /**
   * TODO: Source maps (at least prod) appear to be completely broken... no idea
   * why, but it appears to have something to the extract text plugin.
   *
   * This will be solved when switching over to using postcss iteslef for loading
   * the data.
   *
   * let devtool = 'eval-source-map';
   * devtool = 'hidden-source-map'; // Broken AF... webpack sucks.
   */

  // Plugins; The differ between dev and production between dev and production.
  const plugins = [new ExtractTextPlugin('index.packed.css')];

  if (production) plugins.push(new UglifyJSPlugin());

  const compiler = webpack({
    entry: path.join(SRC_DIR, 'index.js'),
    output: {
      filename: 'index.packed.js',
      path: DIST_DIR,
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
    plugins,
    watchOptions: {
      aggregateTimeout: 256,
      poll: 512,
    },
  });


  if (!production) compiler.outputFileSystem = fs;
  return compiler;
};

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


  // Is there a build running... delay service if that's the case.
  let scheduled = false;

  /**
   * Returns the micro server... we'd need to call listen
   * on that too.
   *
   * @returns {Object}
   * @private
   */
  return function (fs) {
    // TODO: Accept a websocket connection.
    return micro(async function (req, res) {
      try {
        // Allow only get requests, trivial attempt to deal with http errors.
        if (req.method !== 'GET') throw createError(405, 'Method Not Allowed');

        // Set the appropriate CORS headers.
        setHeaders(res, {
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Cache-Control': 'no-cache',
        });

        const { pathname } = url.parse(req.url);

        let data;
        switch (pathname) {
          case '/':
            data = await readFile(path.join(DIST_DIR, 'index.html'), 'utf-8');
            setHeader(res, 'Content-Type', 'text/html; charset=utf-8');
            break;

          case '/index.packed.css':
            data = await readFile(path.join(DIST_DIR, 'index.packed.css'), 'utf-8');
            setHeader(res, 'Content-Type', 'text/css; charset=utf-8');
            break;

          case '/index.packed.js':
            data = await readFile(path.join(DIST_DIR, 'index.packed.js'), 'utf-8');
            setHeader(res, 'Content-Type', 'application/javascript; charset=utf-8');
            break;

          default:
            const _pathname = path.join(DIST_DIR, path.normalize(pathname));
            data = await readFile(_pathname);
        }

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
async function build() {
  progress('running webpack build');

  try {
    await Promise.all([
      // Compile the JS using webpack.
      new Promise(function (resolve, reject) {
        _createCompiler({ production: true }).run(function (err, stats) {
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
          // TODO: This can likely be moved into constants.
          const _pathname = path.join(SRC_DIR, 'index.md');
          const markup = await createMarkup(_pathname, DOCUMENT_PROPERTIES);
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
    '--build:prod': build.bind(null/**, production */),

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
  };

  const arg = argv.pop();

  /**
   * TODO: Log a sensible error when the command isn't recognised.
   */
  const command = fns[arg];
  if (command) await command();
}(process.argv));
