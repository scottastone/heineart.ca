/// <reference path="../pb_data/types.d.ts" />

// The site runs behind nginx; trust its X-Real-IP header so logs and rate
// limits see the visitor's address instead of nginx's.
migrate((app) => {
  const settings = app.settings();
  settings.trustedProxy.headers = ["X-Real-IP"];
  app.save(settings);
}, (app) => {
  const settings = app.settings();
  settings.trustedProxy.headers = [];
  app.save(settings);
});
