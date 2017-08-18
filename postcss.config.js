const postcss = require('postcss');
const cssvars = require('postcss-simple-vars');
const cssnext = require('postcss-cssnext');
const cssnano = require('cssnano');

/**
 * This export includes all of the css plugins that are
 * required for an abstract build of out css.
 */
const _plugins = [
  cssvars({}/** TODO: Pass global variables */),
  cssnext({}),
  cssnano({}/** TODO: Discard comments in src */),
];

/**
 * Process CSS in a buffer (b).
 *
 * @param {Buffer}
 * @returns {Buffer}
 */
module.exports = b => postcss(_plugins).process(b);
module.exports.plugins = _plugins;
