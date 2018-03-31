/**
 * TODO: Use postcss directly... no need to use webpack.
 */
require('../css/index.css')

/**
 * Main function.
 */
const main = () => console.log('[web-app]: dom content loaded')

document.addEventListener('DOMContentLoaded', main)
