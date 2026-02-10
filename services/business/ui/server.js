const fs = require("fs");
const https = require("https");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";
const keyPath = process.env.UI_SSL_KEY_FILE || "/tmp/ui_key.pem";
const certPath = process.env.UI_SSL_CERT_FILE || "/tmp/ui_cert.pem";

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const key = fs.readFileSync(keyPath);
  const cert = fs.readFileSync(certPath);

  https
    .createServer({ key, cert }, (req, res) => {
      handle(req, res);
    })
    .listen(port, hostname, () => {
      console.log(`UI HTTPS server listening on https://${hostname}:${port}`);
    });
});
