/// <reference path="../pb_data/types.d.ts" />

// pottedpainter.ca is proxied by Cloudflare, which passes the visitor's
// address in CF-Connecting-IP.
migrate((app) => {
  const settings = app.settings();
  settings.trustedProxy.headers = ["CF-Connecting-IP", "X-Real-IP"];
  app.save(settings);
}, (app) => {
  const settings = app.settings();
  settings.trustedProxy.headers = ["X-Real-IP"];
  app.save(settings);
});
