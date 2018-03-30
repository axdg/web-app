const path = require('path');
const { readFileSync } = require('fs');

const { DefinePlugin, optimize: { ModuleConcatenationPlugin } } = require('webpack');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const cssvars = require('postcss-simple-vars');
const cssnext = require('postcss-cssnext');

const ROOT = path.join(__dirname, './');
const ENTRY_FILE = path.join(ROOT, './src/es', 'index.es');
const OUTPUT_DEST = path.join(ROOT, './dist');

const BABEL_CONFIG = JSON.parse(readFileSync('./.babelrc', 'utf-8'));

module.exports = function (options = {}) {
  const {
    // NOTE: By default we're in development mode.
    env = process.env.NODE_ENV || 'development',
    // TODO: This seems like really intense support, make the default higher.
    browsers = ['last 2 versions', 'safari >= 7', 'IE >= 8'],
  } = options;

  /**
   * NOTE: We import the `.babelrc` so that we can share it's
   * config with any test setup that we're also using babel
   * for, but in this case we only want to target browsers
   * and turn module transpilation off so that it will allow
   * webpack to deal with import statements.
   */
  BABEL_CONFIG.presets[0][1] = {
    modules: false,
    targets: {
      browsers,
    },
  };

  // Comments in css source, or minification of css.
  let minimize = false;

  // Source map generation... switched out in prod.
  let devtool = 'inline-source-map';

  // ECMAScript plugin setup... style text is extracted, compression in prod.
  const plugins = [
    new MiniCssExtractPlugin({ filename: 'index.css' }),
    new DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env),
      'process.env.WEBPACKED': true,
    }),
  ];

  if (env === 'production') {
    devtool = 'hidden-source-map';
    minimize = {
      discardComments: {
        removeAll: true ,
      },
    };
    plugins.push(
      new UglifyJsPlugin({ cache: true, sourceMap: true }),
      new ModuleConcatenationPlugin(),
    );
  }

  return {
    mode: env,
    entry: ENTRY_FILE,
    // TODO: Allow for output to be passed as a single string.
    output: {
      filename: 'index.js',
      path: OUTPUT_DEST,
    },
    module: {
      rules: [
        {
          // Style pipeline... node-sass config.
          test: /\.(css|postcss)$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                sourceMap: true,
                minimize,
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: true,
                plugins: () => [
                  cssvars({}/** TODO: Pass global CSS vars */),
                  cssnext({
                    warnForDuplicates: false,
                    browsers,
                  }),
                ],
              },
            },
          ],
        },
        {
          // Babel configuration... env and JSX.
          test: /\.(es|js|jsx)$/,
          exclude: /(node_modules)/,
          use: {
            loader: 'babel-loader',
            options: BABEL_CONFIG,
          },
        },
      ],
    },
    plugins,
    devtool,
  };
};
