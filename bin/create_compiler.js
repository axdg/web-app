 const createCompiler = require('create_compiler');
 const createServer = require('create_server');


/**
 * Creates a webpack compiler instance with
 * the specified config.
 *
 * @param {Boolean}
  *
 * @returns {Object}
 */
module.exports = function (production = false) {
  return wepback({
    entry: '../src/index.js',
    output: {
      filename: '[name].packed.js',
      path: path.join('../build/'),
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
                  /**
                   * TODO: Add minification to CSS assets
                   * (in prod).
                  */
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
