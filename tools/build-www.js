/* ============================================================
   NEON SOUL - tools/build-www.js
   Copies the web app into ./www so Capacitor has a clean
   webDir (no node_modules, no android project, no tooling).
   Run:  node tools/build-www.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "www");

const FILES = ["index.html", "manifest.json", "sw.js"];
const DIRS = ["css", "js", "assets"];

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });

let count = 0;
for (const f of FILES) {
  const s = path.join(ROOT, f);
  if (!fs.existsSync(s)) { console.warn("missing:", f); continue; }
  fs.copyFileSync(s, path.join(OUT, f));
  count++;
}
for (const d of DIRS) {
  const s = path.join(ROOT, d);
  if (!fs.existsSync(s)) { console.warn("missing dir:", d); continue; }
  copyDir(s, path.join(OUT, d));
  count += fs.readdirSync(s).length;
}

// Inside a Capacitor APK the app is already local; a service worker only adds
// update headaches there, so the packaged copy skips registering it.
const idx = path.join(OUT, "index.html");
let html = fs.readFileSync(idx, "utf8");
html = html.replace("<body>", "<body>\n<script>window.NS_PACKAGED = true;</script>");
fs.writeFileSync(idx, html);

console.log("www/ built ->", OUT);
console.log(count + " top-level items copied");
