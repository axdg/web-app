const path = require('path');
const { parse } = require('url');

const { micro, send, sendError, createError } = require('micro');
const { exists, readFile, writeFile } = require('fs-extra');

/**
 * A functional version of `setHeader`.
 *
 * @param {Object}
 * @param {String}
 * @param {String}
 * @returns {Void}
 * @private
 */
const setHeader = function (res, name, value) {
  return res.setHeader(name, value);
}

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

/**
 * A functional version of `getHeader`.
 *
 * @param {Object}
 * @param {Strinf}
 * @returns {Void}
 * @private
 */
const getHeader = function (res, name) {
  return res.getHeader(name);
};

const createListener = function (dirname) {};

const listener = async function (req, res) {
  const { method, url } = req;

  // Set the CORS headers.
  setHeaders(res, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
  });

  // Allow only `GET` requests, but **TODO** send custom error pages.
  if (method !== 'GET') throw createError(405, 'Method Not Allowed'));

  let { pathname } = parse(url);

  // Serve the index file.
  if (pathname === '') return {
    setHeader(res, 'Content-Type': 'text/html charset=utf-8');
    return '';
  }

  // Reconstruct the path.
  pathname = path.join('../build/', path.normalize(pathname));

  // Serve a buffer for a handfull of types.
  switch (path.extname(pathname).toLowerCase()) {
    case: '.html':
      setHeader(res, 'Content-Type': 'text/html; charset=utf-8');
    case: '.css':
      setHeader(res, 'Content-Type': 'text/css; charset=utf-8');
    case: '.js'
      setHeader(res, 'Content-Type': 'text/javascript; charset=utf-8');

    try {
      const data = await readFile(pathname, 'utf-8');
      return data;
    } catch (err) {
      throw createError(404, 'Not Found');
    }
  }

  /**
   * Use `fs.createWriteStream` for all other cases.
   *
   * TODO: Support range headers.
   */
  try {
    const stats = await stat(pathname);
    if (!stats.isFile()) throw null;

    const stream = fs.createReadStream(pathname);
    stream.on('err', () => res.end());

    return stream;
  } catch (err) {
    throw createError(404, 'Not Found');
  }
};

module.exports = (dirname) => micro(createListener(dirname));
