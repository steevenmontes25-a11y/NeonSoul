/* ============================================================
   NEON SOUL - particles.js
   Pooled particle system: sparks, rings, debris, damage numbers
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U;

  var P = {
    list: [],
    free: [],
    texts: [],
    freeTexts: [],
    quality: 1,        // 0.4 (low) .. 1 (high)
    max: 520
  };

  function newP() {
    return {
      kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
      size: 3, color: "#fff", drag: 0.9, grav: 0, spin: 0, rot: 0,
      r0: 0, r1: 0, w: 2, add: true, dead: true, fade: 1
    };
  }
  function newT() {
    return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, txt: "", color: "#fff", size: 14, dead: true, crit: false };
  }

  for (var i = 0; i < 180; i++) P.free.push(newP());
  for (var j = 0; j < 40; j++) P.freeTexts.push(newT());

  function grab() {
    if (P.list.length >= P.max) {
      // recycle oldest
      var o = P.list.shift();
      P.list.push(o);
      return o;
    }
    var p = P.free.length ? P.free.pop() : newP();
    p.dead = false;
    P.list.push(p);
    return p;
  }

  P.setQuality = function (q) { P.quality = q; P.max = q < 0.6 ? 220 : (q < 0.9 ? 380 : 560); };

  // ---------------- emitters ----------------
  // kind 0: dot spark, 1: ring, 2: shard(line), 3: glow orb
  P.spark = function (x, y, count, o) {
    o = o || {};
    count = Math.max(1, Math.round(count * P.quality));
    var dir = o.dir === undefined ? null : o.dir;
    var spread = o.spread === undefined ? Math.PI * 2 : o.spread;
    for (var i = 0; i < count; i++) {
      var p = grab();
      var a = dir === null ? Math.random() * U.TAU : dir + (Math.random() - 0.5) * spread;
      var sp = U.rand(o.speed ? o.speed * 0.4 : 60, o.speed || 220);
      p.kind = o.kind === undefined ? 0 : o.kind;
      p.x = x + (o.jitter ? U.rand(-o.jitter, o.jitter) : 0);
      p.y = y + (o.jitter ? U.rand(-o.jitter, o.jitter) : 0);
      p.vx = Math.cos(a) * sp + (o.vx || 0);
      p.vy = Math.sin(a) * sp + (o.vy || 0);
      p.maxLife = p.life = U.rand((o.life || 0.45) * 0.6, o.life || 0.45);
      p.size = U.rand((o.size || 3) * 0.6, o.size || 3);
      p.color = o.color || "#fff";
      p.drag = o.drag === undefined ? 2.6 : o.drag;
      p.grav = o.grav || 0;
      p.rot = a;
      p.spin = o.spin || 0;
      p.add = o.add !== false;
      p.fade = 1;
    }
  };

  P.ring = function (x, y, o) {
    o = o || {};
    var p = grab();
    p.kind = 1;
    p.x = x; p.y = y; p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.r0 = o.r0 || 4; p.r1 = o.r1 || 60;
    p.w = o.w || 3;
    p.maxLife = p.life = o.life || 0.35;
    p.color = o.color || "#fff";
    p.add = o.add !== false;
    p.drag = 0;
    return p;
  };

  P.orb = function (x, y, o) {
    o = o || {};
    var p = grab();
    p.kind = 3;
    p.x = x; p.y = y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.size = o.size || 10;
    p.maxLife = p.life = o.life || 0.3;
    p.color = o.color || "#fff";
    p.drag = o.drag === undefined ? 1.6 : o.drag;
    p.add = true;
    return p;
  };

  P.burst = function (x, y, color, power) {
    power = power || 1;
    P.spark(x, y, 10 * power, { color: color, speed: 260 * power, life: 0.4, size: 3.4, drag: 3.2 });
    P.ring(x, y, { r0: 3, r1: 42 * power, color: color, life: 0.3, w: 3 });
  };

  P.explosion = function (x, y, radius, color) {
    P.ring(x, y, { r0: radius * 0.2, r1: radius, color: color || "#ff8a3d", life: 0.34, w: 5 });
    P.ring(x, y, { r0: 2, r1: radius * 0.75, color: "#fff", life: 0.2, w: 2 });
    P.spark(x, y, 20, { color: color || "#ff8a3d", speed: radius * 5, life: 0.55, size: 4, drag: 2.4 });
    P.spark(x, y, 8, { color: "#ffd48a", speed: radius * 3, life: 0.7, size: 2.4, drag: 1.4, kind: 2 });
  };

  P.trail = function (x, y, color, size, life) {
    if (P.quality < 0.55 && Math.random() < 0.5) return;
    var p = grab();
    p.kind = 3;
    p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.size = size || 6;
    p.maxLife = p.life = life || 0.24;
    p.color = color || "#25e0ff";
    p.drag = 0;
    p.add = true;
  };

  P.shard = function (x, y, count, o) {
    o = o || {};
    o.kind = 2;
    P.spark(x, y, count, o);
  };

  // ---------------- damage numbers ----------------
  P.text = function (x, y, txt, o) {
    o = o || {};
    if (!NS.Save.data.settings.damageNumbers && o.dmg) return;
    var t = P.freeTexts.length ? P.freeTexts.pop() : newT();
    t.dead = false;
    t.x = x + U.rand(-8, 8); t.y = y - 6;
    t.vx = o.vx === undefined ? U.rand(-26, 26) : o.vx;
    t.vy = o.vy === undefined ? -62 : o.vy;
    t.maxLife = t.life = o.life || 0.75;
    t.txt = txt;
    t.color = o.color || "#fff";
    t.size = o.size || 15;
    t.crit = !!o.crit;
    P.texts.push(t);
    if (P.texts.length > 46) {
      var old = P.texts.shift();
      old.dead = true; P.freeTexts.push(old);
    }
  };

  // ---------------- lifecycle ----------------
  P.update = function (dt) {
    var l = P.list, n = 0, i, p;
    for (i = 0; i < l.length; i++) {
      p = l[i];
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; if (P.free.length < 400) P.free.push(p); continue; }
      if (p.kind !== 1) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.drag) {
          var f = Math.exp(-p.drag * dt);
          p.vx *= f; p.vy *= f;
        }
        if (p.grav) p.vy += p.grav * dt;
        if (p.spin) p.rot += p.spin * dt;
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      l[n++] = p;
    }
    l.length = n;

    var ts = P.texts; n = 0;
    for (i = 0; i < ts.length; i++) {
      var t = ts[i];
      t.life -= dt;
      if (t.life <= 0) { t.dead = true; if (P.freeTexts.length < 60) P.freeTexts.push(t); continue; }
      t.x += t.vx * dt; t.y += t.vy * dt;
      t.vy += 130 * dt;
      t.vx *= 0.96;
      ts[n++] = t;
    }
    ts.length = n;
  };

  P.draw = function (ctx) {
    var l = P.list, i, p, a;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (i = 0; i < l.length; i++) {
      p = l[i];
      a = p.life / p.maxLife;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      if (p.kind === 0) {
        ctx.fillStyle = p.color;
        var s = p.size * (0.35 + a * 0.65);
        ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
      } else if (p.kind === 1) {
        var r = U.lerp(p.r0, p.r1, 1 - a * a);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.w * a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, r), 0, U.TAU);
        ctx.stroke();
      } else if (p.kind === 2) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.5 * a);
        var len = p.size * 3 * a;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(p.rot) * len, p.y - Math.sin(p.rot) * len);
        ctx.stroke();
      } else {
        var rr = p.size * (0.4 + a * 0.8);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a * 0.55;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, U.TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  P.drawTexts = function (ctx) {
    var ts = P.texts;
    if (!ts.length) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i];
      var a = Math.min(1, t.life / t.maxLife * 1.7);
      var pop = t.life > t.maxLife - 0.08 ? 1 + (t.life - (t.maxLife - 0.08)) * 4 : 1;
      ctx.globalAlpha = a;
      ctx.font = "900 " + (t.size * pop * (t.crit ? 1.35 : 1)).toFixed(1) + "px Segoe UI, system-ui, sans-serif";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(0,0,0,.72)";
      ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color;
      if (t.crit) { ctx.shadowColor = t.color; ctx.shadowBlur = 12; }
      ctx.fillText(t.txt, t.x, t.y);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  };

  P.clear = function () {
    for (var i = 0; i < P.list.length; i++) if (P.free.length < 400) P.free.push(P.list[i]);
    P.list.length = 0;
    for (var j = 0; j < P.texts.length; j++) if (P.freeTexts.length < 60) P.freeTexts.push(P.texts[j]);
    P.texts.length = 0;
  };

  P.count = function () { return P.list.length + P.texts.length; };

  NS.Particles = P;
})(window.NS);
