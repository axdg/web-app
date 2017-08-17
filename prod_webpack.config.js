const OPTIONS = {
  env: 'production',
};

module.exports = Object.assign({}, require('./create_webpack.config.js')(OPTIONS), {
  // Extra production params here.
});
