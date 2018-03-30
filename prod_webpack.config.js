const createConfig = require('./create_webpack.config.js')

module.exports = Object.assign({}, createConfig({ env: 'production' }), {});
