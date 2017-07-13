const { app, BrowserWindow } = require('electron');

/**
 * Seperate thread... work with
 * process.send and process.on('message', () => {})
 */

/**
 * Create a data URL from the given data.
 *
 * @param {String|Buffer}
 * @param {String}
 * @param {Boolean}
 * @returns {String}
 */
const createDataURL = function (data, mime, encode = true) {
  const _data = encode ? `;base64,${new Buffer(data).toString('base64')}` : `,${data}`;
  return `data:${mime}${_data}`;
};

/**
 * Create a data URL for an HTML document.
 *
 * @param {String}
 * @returns {String}
 */
const createMarkupDataURL = function (markup) {
  return createDataURL(markup, 'text/html;charset=utf-8');
};

// Global reference to prevent GC.
let win;

const createRenderer = (function () {
  const WINDOW_OPTIONS = {
    width: 1024,
    height: 768,
    backgroundColor: '#1f3153',
    show: false,
    offscreen: true,
    resizable: true,
    vibrancy: 'ultra-dark',
    // titleBarStyle: 'hiddenInset',
    webPreferences: {
      webSecurity: false,
    },
  };

  /**
   * Create a `BrowserWindow` with the above options...
   * open dev tools.
   *
   * @returns {Void}
   */
  return function () {
    win = new BrowserWindow(WINDOW_OPTIONS);
    win.webContents.openDevTools({});
    win.loadURL(createMarkupDataURL(''));

    // Window lifecycle listeners.
    win.on('ready-to-show', () => win.show());
    win.on('closed', () => win = null); // eslint-disable-line no-return-assign
  };
}());

// Application lifecycle listeners.
app.on('ready', createRenderer);
app.on('window-all-closed', () => (process.platform !== 'darwin') && app.quit());
app.on('activate', () => (win === null) && createRenderer());
