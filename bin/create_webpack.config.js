const path = require('path');
const { DefinePlugin } = require('webpack');
const BabiliPlugin = require('babili-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const cssnext = require('postcss-cssnext');
const precss = require('precss');

const ROOT = path.join(__dirname, '../');
const ENTRY_FILE = path.join(ROOT, './src/es', 'index.js');
const OUTPUT_DEST = path.join(ROOT, './dist');

module.exports = function (options = {}) {
  const {
    // SEE: `https://github.com/ai/browserslist`
    browsers = '> 1%, last 2 versions, Firefox ESR',
    entry = ENTRY_FILE,
    output = {
      filename: 'index.js',
      path: OUTPUT_DEST,
    },
    env = process.env.NODE_ENV || 'development',
  } = options;

  // Comments in css source, or minification of css.
  let minimize = false;

  // Source map generation... switched out in prod.
  let devtool = 'inline-source-map';

  // ECMAScript plugin setup... style text is extracted, compression in prod.
  const plugins = [
    new ExtractTextPlugin('index.css'),
    new DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env),
      'process.env.WEBPACKED': true,
    }),
  ];

  if (env === 'production') {
    devtool = 'hidden-source-map';
    minimize = { discardComments: { removeAll: true } };
    plugins.push(new BabiliPlugin({}, { comments: false }));
  }

  return {
    entry,
    // TODO: Allow for output to be passed as a single string.
    output,
    module: {
      rules: [
        {
          // Style pipeline... node-sass and postcss configuration.
          test: /\.(css|scss)$/,
          use: ExtractTextPlugin.extract({
            fallback: 'style-loader',
            use: [
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
                    precss({}),
                    cssnext({
                      warnForDuplicates: false,
                      browsers,
                    }),
                  ],
                },
              },
            ],
          }),
        },
        {
          // Babel configuration... env and JSX.
          test: /\.(es|js|jsx)$/,
          exclude: /(node_modules)/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                [
                  'env', {
                    targets: {
                      browsers,
                    },
                  },
                ],
              ],
              plugins: ['transform-react-jsx'],
            },
          },
        },
      ],
    },
    plugins,
    devtool,
  };
};
