const path = require('path');
const { readFile } = require('fs-extra');
const { parse, stringify, adapter, map, sequence } = require('@raywhite/pico-dom');
const renderer = new require('markdown-it')({ html: true }); // eslint-disable-line new-cap
const PACKAGE_CONFIG = require('../package.json');

const createDocument = (function () {
  /**
   * Allows all nodes through with the exception of comment
   * nodes that don't preface the application.
   *
   * @param {Object}
   * @returns {Object}
   * @private
   */
  const fn = function (node) {
    if (adapter.isCommentNode(node)) {
      // Add some spacing after the header comment.
      if (adapter.getCommentNodeContent(node).indexOf(PACKAGE_CONFIG.author) !== -1) {
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

  const createComment = function (name, author) {
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
  return function (options = {}) {
    const {
      content = '',
      href = 'index.css',
      src = 'index.js',
      name = PACKAGE_CONFIG.name,
      description = PACKAGE_CONFIG.description,
      author = PACKAGE_CONFIG.author,
      license = PACKAGE_CONFIG.license,
    } = options;

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
      ${createComment(name, author)}
      <meta property="og:title" content="${name}"/>
      <meta property="og:site_name" content="${name}"/>
      <meta property="og:description" content="${description}"/>
      <script type="application/ld+json">${JSONLD_SCHEMA}</script>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${name}</title>
      <link rel="icon" href="/public/favicon.png" type="image/png">
      <link rel="stylesheet" href="${href}">
      <script defer src="${src}"></script>
      ${renderer.render(content)}
    `);
  };
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
module.exports = async function (file = '', props = {}) {
  if (!file) file = path.join(__dirname, '../src/index.md');
  const content = await readFile(file, 'utf8');
  return createDocument(Object.assign({}, props, { content }));
};
