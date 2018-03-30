# web-app

> A modern web application boilerplate ;)

## About

**WIP:** This is a boilerplate for a modern web application... using webpack (v4), postcss etc.

## Notes

- Source maps are inline (*development*), and external (*production*).
- Same goes for minification... none during dev.

## Structure

**Configuration Files**

- `./.babelrc` (`json`) - babel config.
- `./.eslintrc` (`json`)
- `./create_webpack.config.js`
- `./dev_webpack.config.js`
- `./prod_webpack.config.js`

**Application Code**

- `./src/`
  - `./es/` - app source.
    - `index.es` - entry.
  - `./css/` 
    - `./index.css` - css entry.
  - `./index.html`
- `./dist` - build folder.

## TODO

- Create HTTP and WS server (**DONE**)
- Compile using memory FS (**SKIPPED**)
- Setup tests... and renderer tests (**SKIPPED**)
- Wrap up and export as a standalone.
- Loading animation.
- Colors etc.

## License

**MIT** &bull; &copy; [axdg](mailto:axdg@dfant.asia) &bull; 2017-2018 &bull;
