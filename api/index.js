const { build } = require('../dist/app.js');

let app = null;

module.exports = async function handler(req, res) {
  if (!app) {
    app = await build();
    await app.ready();
  }
  
  return app.server(req, res);
};