import { build } from '../dist/app.js';

let app = null;

export default async function handler(req, res) {
  if (!app) {
    app = await build();
    await app.ready();
  }
  
  return app.server(req, res);
};