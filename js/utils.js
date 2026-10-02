/* ============================================================
   NEON SOUL - utils.js
   Namespace + math/random/pool helpers
   ============================================================ */
window.NS = window.NS || {};

(function (NS) {
  "use strict";

  var U = {};

  // ---------- math ----------
  U.TAU = Math.PI * 2;
  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.invLerp = function (a, b, v) { return b === a ? 0 : (v - a) / (b - a); };
  U.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };
  U.dist = function (ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); };
  U.dist2 = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  U.angle = function (ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); };
  U.norm = function (x, y) {
    var m = Math.hypot(x, y);
    if (m < 1e-6) return { x: 0, y: 0, m: 0 };
    return { x: x / m, y: y / m, m: m };
  };
  // frame-rate independent smoothing
  U.damp = function (a, b, lambda, dt) { return U.lerp(a, b, 1 - Math.exp(-lambda * dt)); };
  U.approach = function (a, b, step) {
    if (a < b) return Math.min(a + step, b);
    if (a > b) return Math.max(a - step, b);
    return b;
  };
  U.angleDiff = function (a, b) {
    var d = (b - a) % U.TAU;
    if (d > Math.PI) d -= U.TAU;
    if (d < -Math.PI) d += U.TAU;
    return d;
  };
  U.rotateToward = function (cur, target, maxStep) {
    var d = U.angleDiff(cur, target);
    if (Math.abs(d) <= maxStep) return target;
    return cur + U.sign(d) * maxStep;
  };

  // easing
  U.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  U.easeInCubic = function (t) { return t * t * t; };
  U.easeOutBack = function (t) { var c = 1.70158 + 1; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  U.easeOutElastic = function (t) {
    if (t === 0 || t === 1) return t;
    var p = 0.35;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (U.TAU) / p) + 1;
  };

  // ---------- random ----------
  U.rand = function (a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + Math.random() * (b - a);
  };
  U.randInt = function (a, b) { return Math.floor(U.rand(a, b + 1)); };
  U.chance = function (p) { return Math.random() < p; };
  U.pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
  U.pickMany = function (arr, n) {
    var c = arr.slice(), out = [];
    while (out.length < n && c.length) out.push(c.splice((Math.random() * c.length) | 0, 1)[0]);
    return out;
  };
  U.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0, t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  U.weighted = function (items, weightFn) {
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += Math.max(0, weightFn(items[i]));
    if (total <= 0) return items[(Math.random() * items.length) | 0];
    var r = Math.random() * total;
    for (i = 0; i < items.length; i++) {
      r -= Math.max(0, weightFn(items[i]));
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  // seeded RNG (mulberry32) - used for deterministic room layouts
  U.RNG = function (seed) {
    this.s = (seed >>> 0) || 1;
  };
  U.RNG.prototype.next = function () {
    this.s |= 0; this.s = (this.s + 0x6D2B79F5) | 0;
    var t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  U.RNG.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  U.RNG.prototype.int = function (a, b) { return Math.floor(this.range(a, b + 1)); };
  U.RNG.prototype.pick = function (arr) { return arr[this.int(0, arr.length - 1)]; };
  U.RNG.prototype.chance = function (p) { return this.next() < p; };

  // ---------- format ----------
  U.fmt = function (n) {
    n = Math.round(n);
    if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "M";
    if (n >= 10000) return (n / 1000).toFixed(n >= 100000 ? 0 : 1) + "K";
    return "" + n;
  };
  U.time = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  };
  U.pct = function (v) { return Math.round(v * 100) + "%"; };

  // ---------- color ----------
  U.rgba = function (hex, a) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  };
  U.mixHex = function (a, b, t) {
    var pa = parseInt(a.replace("#", ""), 16), pb = parseInt(b.replace("#", ""), 16);
    var r = Math.round(U.lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
    var g = Math.round(U.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    var bl = Math.round(U.lerp(pa & 255, pb & 255, t));
    return "rgb(" + r + "," + g + "," + bl + ")";
  };

  // ---------- object pool ----------
  U.Pool = function (factory, reset, initial) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    this.active = [];
    for (var i = 0; i < (initial || 0); i++) this.free.push(factory());
  };
  U.Pool.prototype.get = function () {
    var o = this.free.length ? this.free.pop() : this.factory();
    o.dead = false;
    this.active.push(o);
    return o;
  };
  U.Pool.prototype.release = function (o) {
    o.dead = true;
  };
  U.Pool.prototype.sweep = function () {
    var a = this.active, n = 0;
    for (var i = 0; i < a.length; i++) {
      if (a[i].dead) {
        if (this.reset) this.reset(a[i]);
        if (this.free.length < 900) this.free.push(a[i]);
      } else {
        a[n++] = a[i];
      }
    }
    a.length = n;
  };
  U.Pool.prototype.clear = function () {
    for (var i = 0; i < this.active.length; i++) {
      if (this.reset) this.reset(this.active[i]);
      if (this.free.length < 900) this.free.push(this.active[i]);
    }
    this.active.length = 0;
  };

  // ---------- dom ----------
  U.$ = function (id) { return document.getElementById(id); };
  U.qs = function (sel, root) { return (root || document).querySelector(sel); };
  U.qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  U.el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  U.on = function (target, ev, fn, opts) {
    if (!target) return;
    target.addEventListener(ev, fn, opts || false);
  };
  U.show = function (e) { if (e) e.classList.remove("hidden"); };
  U.hide = function (e) { if (e) e.classList.add("hidden"); };
  U.esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };

  // circle/circle overlap
  U.hit = function (a, b) {
    var r = a.r + b.r;
    return U.dist2(a.x, a.y, b.x, b.y) <= r * r;
  };
  U.hitR = function (a, b, extra) {
    var r = a.r + b.r + (extra || 0);
    return U.dist2(a.x, a.y, b.x, b.y) <= r * r;
  };

  U.now = function () { return performance.now(); };

  NS.U = U;
})(window.NS);
