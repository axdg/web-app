const path = require('path');
const createConfig = require('./create_webpack.config.js');

const CONTENT_BASE = path.join(__dirname, './src');

const devServer = {
  contentBase: CONTENT_BASE,
  port: 5000,
  // hot: true,
  stats: {
    assets: true,
    assetsSort: 'size',
    cached: false,
    cachedAssets: false,
    children: false,
    chunks: false,
    chunkModules: false,
    chunkOrigins: false,
    chunksSort: 'size',
    context: '../src/',
    colors: true,
    depth: false,
    entrypoints: false,
    errors: true,
    errorDetails: true,
    exclude: [],
    hash: true,
    maxModules: 20,
    modules: false,
    modulesSort: 'field',
    moduleTrace: true,
    performance: true,
    providedExports: false,
    publicPath: false,
    reasons: false,
    source: false,
    timings: true,
    usedExports: false,
    version: false,
    warnings: true,
  },
};

module.exports = Object.assign({}, createConfig(), { devServer });
