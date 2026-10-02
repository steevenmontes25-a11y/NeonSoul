/* ============================================================
   NEON SOUL - render.js
   Canvas setup, single-screen arena fitting, world drawing.
   The arena always fits the viewport exactly: no scrolling,
   no off-screen enemies. Great for phones.
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U, P = NS.Particles;

  var R = {
    canvas: null, ctx: null,
    W: 0, H: 0, dpr: 1,
    scale: 1, offX: 0, offY: 0,
    fullW: 760, fullH: 760,
    SHORT: 760,
    shake: 0, shakeX: 0, shakeY: 0,
    zoom: 1, zoomTarget: 1,
    bgPattern: null, time: 0
  };

  R.init = function () {
    R.canvas = U.$("game-canvas");
    R.ctx = R.canvas.getContext("2d", { alpha: false, desynchronized: true });
    R.resize();
    U.on(window, "resize", R.resize);
    U.on(window, "orientationchange", function () { setTimeout(R.resize, 250); });
    if (window.visualViewport) U.on(window.visualViewport, "resize", R.resize);
    return R;
  };

  R.qualityDpr = function () {
    var q = NS.Save.data.settings.quality;
    var d = window.devicePixelRatio || 1;
    if (q === "low") return 1;
    if (q === "high") return Math.min(d, 2);
    // auto
    var px = window.innerWidth * window.innerHeight;
    if (px > 1000000) return Math.min(d, 1.5);
    return Math.min(d, 2);
  };

  R.resize = function () {
    var c = R.canvas;
    if (!c) return;
    var cssW = window.innerWidth;
    var cssH = window.innerHeight;
    R.dpr = R.qualityDpr();
    c.style.width = cssW + "px";
    c.style.height = cssH + "px";
    c.width = Math.max(320, Math.round(cssW * R.dpr));
    c.height = Math.max(320, Math.round(cssH * R.dpr));
    R.W = c.width; R.H = c.height;

    var shortPx = Math.min(R.W, R.H), longPx = Math.max(R.W, R.H);
    var ratio = U.clamp(longPx / shortPx, 1, 1.95);
    var aShort = R.SHORT;
    var aLong = aShort * ratio;
    if (R.W >= R.H) { R.fullW = aLong; R.fullH = aShort; }
    else { R.fullW = aShort; R.fullH = aLong; }
    R.scale = shortPx / aShort;
    R.offX = (R.W - R.fullW * R.scale) / 2;
    R.offY = (R.H - R.fullH * R.scale) / 2;

    if (NS.Game && NS.Game.arena) NS.Game.recomputeArena();
    // low-power devices: drop particle budget
    P.setQuality(NS.Save.data.settings.quality === "low" ? 0.45 :
      (NS.Save.data.settings.quality === "high" ? 1 : (R.W * R.H > 2200000 ? 0.7 : 1)));
  };

  R.screenToWorld = function (sx, sy) {
    return {
      x: (sx * R.dpr - R.offX - R.shakeX) / R.scale,
      y: (sy * R.dpr - R.offY - R.shakeY) / R.scale
    };
  };

  R.addShake = function (n) {
    var mul = NS.Save.data.settings.shake;
    R.shake = Math.min(34, R.shake + n * mul);
  };

  R.updateShake = function (dt) {
    if (R.shake > 0.05) {
      R.shake *= Math.exp(-7 * dt);
      R.shakeX = U.rand(-R.shake, R.shake) * R.scale * 0.5;
      R.shakeY = U.rand(-R.shake, R.shake) * R.scale * 0.5;
    } else { R.shake = 0; R.shakeX = 0; R.shakeY = 0; }
    R.zoom = U.damp(R.zoom, R.zoomTarget, 8, dt);
  };

  // ============================================================
  //  MAIN DRAW
  // ============================================================
  R.draw = function (G, dt) {
    var ctx = R.ctx;
    R.time += dt;
    var zone = G.zone || NS.Levels.get(1);
    var pal = zone.palette;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.bg0;
    ctx.fillRect(0, 0, R.W, R.H);

    ctx.save();
    var z = R.zoom;
    ctx.translate(R.W / 2, R.H / 2);
    ctx.scale(z, z);
    ctx.translate(-R.W / 2, -R.H / 2);
    ctx.translate(R.offX + R.shakeX, R.offY + R.shakeY);
    ctx.scale(R.scale, R.scale);

    var a = G.arena;
    drawFloor(ctx, G, pal, a);
    drawHazardZones(ctx, G);
    drawObstacles(ctx, G, pal);
    drawLoot(ctx, G);
    drawBolts(ctx, G);
    drawVortex(ctx, G);

    // entities
    NS.Combat.draw(ctx);
    var i;
    for (i = 0; i < G.enemies.length; i++) {
      if (!G.enemies[i].dead) {
        if (G.enemies[i].isBoss) NS.Boss.draw(ctx, G.enemies[i], R.time);
        else NS.Enemies.draw(ctx, G.enemies[i], R.time);
      }
    }
    if (G.player && !G.player.dead) G.player.draw(ctx);

    drawBeams(ctx, G);
    P.draw(ctx);
    P.drawTexts(ctx);
    drawExitPortal(ctx, G);

    ctx.restore();

    // arena borders letterbox
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (R.offX > 0.5 || R.offY > 0.5) {
      ctx.fillStyle = "#05030a";
      if (R.offX > 0.5) { ctx.fillRect(0, 0, R.offX, R.H); ctx.fillRect(R.W - R.offX, 0, R.offX, R.H); }
      if (R.offY > 0.5) { ctx.fillRect(0, 0, R.W, R.offY); ctx.fillRect(0, R.H - R.offY, R.W, R.offY); }
    }
  };

  // ---------------- floor ----------------
  function drawFloor(ctx, G, pal, a) {
    var t = R.time;
    // full world backdrop
    var g = ctx.createLinearGradient(0, 0, R.fullW, R.fullH);
    g.addColorStop(0, pal.bg0);
    g.addColorStop(0.55, pal.bg1);
    g.addColorStop(1, pal.bg0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, R.fullW, R.fullH);

    // grid inside arena
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x, a.y, a.w, a.h);
    ctx.clip();

    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1.2;
    var step = 64;
    var ox = (t * 9) % step, oy = (t * 5) % step;
    ctx.beginPath();
    for (var x = a.x - step + ox; x < a.x + a.w + step; x += step) {
      ctx.moveTo(x, a.y); ctx.lineTo(x, a.y + a.h);
    }
    for (var y = a.y - step + oy; y < a.y + a.h + step; y += step) {
      ctx.moveTo(a.x, y); ctx.lineTo(a.x + a.w, y);
    }
    ctx.stroke();

    // scanline sweep
    ctx.globalCompositeOperation = "lighter";
    var sweep = (t * 90) % (a.h + 300) - 150;
    var sg = ctx.createLinearGradient(0, a.y + sweep - 90, 0, a.y + sweep + 90);
    sg.addColorStop(0, "rgba(255,255,255,0)");
    sg.addColorStop(0.5, pal.fog);
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(a.x, a.y, a.w, a.h);
    ctx.restore();

    // arena border
    ctx.save();
    ctx.strokeStyle = pal.wall;
    ctx.lineWidth = 3;
    ctx.shadowColor = pal.wall;
    ctx.shadowBlur = 22;
    ctx.globalAlpha = 0.85;
    roundRect(ctx, a.x + 2, a.y + 2, a.w - 4, a.h - 4, 16);
    ctx.stroke();
    // corner ticks
    ctx.globalAlpha = 1;
    ctx.lineWidth = 5;
    ctx.strokeStyle = pal.accent;
    var L = 34;
    var cs = [[a.x, a.y, 1, 1], [a.x + a.w, a.y, -1, 1], [a.x, a.y + a.h, 1, -1], [a.x + a.w, a.y + a.h, -1, -1]];
    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var c = cs[i];
      ctx.moveTo(c[0] + c[2] * 10, c[1]); ctx.lineTo(c[0] + c[2] * L, c[1]);
      ctx.moveTo(c[0], c[1] + c[3] * 10); ctx.lineTo(c[0], c[1] + c[3] * L);
    }
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  R.roundRect = roundRect;

  // ---------------- obstacles ----------------
  function drawObstacles(ctx, G, pal) {
    var t = R.time;
    for (var i = 0; i < G.obstacles.length; i++) {
      var o = G.obstacles[i];
      ctx.save();
      if (o.kind === "pylon") {
        ctx.translate(o.x, o.y);
        ctx.rotate(t * 0.22 + o.phase);
        ctx.fillStyle = "rgba(10,7,20,.92)";
        ctx.strokeStyle = o.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = o.color; ctx.shadowBlur = 16;
        ctx.beginPath();
        for (var k = 0; k < 6; k++) {
          var a = k * U.TAU / 6;
          var px = Math.cos(a) * o.r, py = Math.sin(a) * o.r;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.5 + Math.sin(t * 2 + o.phase) * 0.2;
        ctx.fillStyle = o.color;
        ctx.beginPath(); ctx.arc(0, 0, o.r * 0.25, 0, U.TAU); ctx.fill();
      } else if (o.kind === "void") {
        var vg = ctx.createRadialGradient(o.x, o.y, o.r * 0.2, o.x, o.y, o.r);
        vg.addColorStop(0, "#000");
        vg.addColorStop(0.75, "#0a0614");
        vg.addColorStop(1, "rgba(155,92,255,.35)");
        ctx.fillStyle = vg;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = "rgba(155,92,255,.6)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, U.TAU); ctx.stroke();
      } else if (o.kind === "spikes") {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.28 + Math.sin(t * 3 + o.phase) * 0.08;
        ctx.fillStyle = o.color;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = o.color; ctx.lineWidth = 2;
        ctx.beginPath();
        for (var s = 0; s < 8; s++) {
          var sa = s * U.TAU / 8 + t * 0.4;
          ctx.moveTo(o.x + Math.cos(sa) * o.r * 0.3, o.y + Math.sin(sa) * o.r * 0.3);
          ctx.lineTo(o.x + Math.cos(sa) * o.r * 0.85, o.y + Math.sin(sa) * o.r * 0.85);
        }
        ctx.stroke();
      } else if (o.kind === "vent") {
        var act = o.ventOn;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = act ? 0.75 : 0.2 + Math.sin(t * 5 + o.phase) * 0.08;
        var vgr = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, o.r);
        vgr.addColorStop(0, act ? "#fff3c0" : "#ff8a3d");
        vgr.addColorStop(1, "rgba(255,90,40,0)");
        ctx.fillStyle = vgr;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, U.TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#ff8a3d"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 0.6, 0, U.TAU); ctx.stroke();
      } else if (o.kind === "beam") {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = o.color;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 7;
        ctx.shadowColor = o.color; ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(o.angle) * o.len, Math.sin(o.angle) * o.len);
        ctx.stroke();
        ctx.fillStyle = o.color;
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, U.TAU); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // ---------------- hazards ----------------
  function drawHazardZones(ctx, G) {
    var i, z;
    // telegraphs
    for (i = 0; i < G.telegraphs.length; i++) {
      z = G.telegraphs[i];
      var k = 1 - z.t / z.dur;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.16 + k * 0.28;
      ctx.fillStyle = z.color;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = z.color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r * k, 0, U.TAU); ctx.stroke();
      ctx.restore();
    }
    // persistent damage zones
    for (i = 0; i < G.zones.length; i++) {
      z = G.zones[i];
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      var pulse = 0.22 + Math.sin(R.time * 6 + z.seed) * 0.07;
      var grd = ctx.createRadialGradient(z.x, z.y, z.r * 0.15, z.x, z.y, z.r);
      grd.addColorStop(0, U.rgba("#ffffff", pulse * 0.7));
      grd.addColorStop(0.4, U.rgba(z.color === "#ff5a28" ? "#ff5a28" : "#ff2fb9", pulse));
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawBeams(ctx, G) {
    for (var i = 0; i < G.beams.length; i++) {
      var b = G.beams[i];
      if (b.delay > 0) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.globalCompositeOperation = "lighter";
      if (b.tele > 0) {
        ctx.globalAlpha = 0.35 + Math.sin(R.time * 30) * 0.12;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 10]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(b.len, 0); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        var w = b.width * (1 + Math.sin(R.time * 30) * 0.08);
        var g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, b.color);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(0, -w / 2, b.len, w);
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 0.9;
        ctx.fillRect(0, -w * 0.12, b.len, w * 0.24);
      }
      ctx.restore();
    }
  }

  function drawVortex(ctx, G) {
    for (var i = 0; i < G.vortex.length; i++) {
      var v = G.vortex[i];
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.globalCompositeOperation = "lighter";
      var k = v.t / v.dur;
      for (var r = 0; r < 3; r++) {
        ctx.strokeStyle = r % 2 ? "#9b5cff" : "#ff2fb9";
        ctx.globalAlpha = 0.5 * k;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        var rr = v.r * (0.3 + r * 0.3) * (0.7 + 0.3 * Math.sin(R.time * 5 + r));
        ctx.arc(0, 0, rr, R.time * (2 + r) % U.TAU, R.time * (2 + r) % U.TAU + 4);
        ctx.stroke();
      }
      var g = ctx.createRadialGradient(0, 0, 2, 0, 0, v.r);
      g.addColorStop(0, "rgba(255,255,255,.5)");
      g.addColorStop(0.3, "rgba(155,92,255,.25)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.globalAlpha = k;
      ctx.beginPath(); ctx.arc(0, 0, v.r, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawBolts(ctx, G) {
    if (!G.bolts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < G.bolts.length; i++) {
      var b = G.bolts[i];
      var a = b.t / b.dur;
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3 * a + 1;
      ctx.shadowColor = b.color; ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      var segs = 5;
      for (var s = 1; s < segs; s++) {
        var t = s / segs;
        var nx = U.lerp(b.x1, b.x2, t) + Math.sin(s * 9 + b.seed) * 14 * (1 - a);
        var ny = U.lerp(b.y1, b.y2, t) + Math.cos(s * 7 + b.seed) * 14 * (1 - a);
        ctx.lineTo(nx, ny);
      }
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------- loot ----------------
  function drawLoot(ctx, G) {
    var t = R.time;
    ctx.save();
    for (var i = 0; i < G.loot.length; i++) {
      var l = G.loot[i];
      var bob = Math.sin(t * 5 + l.seed) * 3;
      ctx.save();
      ctx.translate(l.x, l.y + bob);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = l.color;
      ctx.beginPath(); ctx.arc(0, 0, l.r * 2.2, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = l.color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.2;
      if (l.kind === "coin") {
        ctx.rotate(t * 2 + l.seed);
        ctx.beginPath();
        ctx.moveTo(0, -l.r); ctx.lineTo(l.r, 0); ctx.lineTo(0, l.r); ctx.lineTo(-l.r, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (l.kind === "heart") {
        ctx.beginPath();
        ctx.arc(-l.r * 0.4, -l.r * 0.2, l.r * 0.5, 0, U.TAU);
        ctx.arc(l.r * 0.4, -l.r * 0.2, l.r * 0.5, 0, U.TAU);
        ctx.moveTo(-l.r * 0.85, 0);
        ctx.lineTo(0, l.r); ctx.lineTo(l.r * 0.85, 0);
        ctx.closePath(); ctx.fill();
      } else if (l.kind === "soul") {
        ctx.rotate(-t * 3);
        ctx.beginPath();
        for (var k = 0; k < 6; k++) {
          var a = k * U.TAU / 6;
          var rr = k % 2 ? l.r * 0.5 : l.r;
          var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else { // shard
        ctx.rotate(t * 1.4);
        ctx.beginPath();
        ctx.moveTo(0, -l.r * 1.3); ctx.lineTo(l.r * 0.7, 0);
        ctx.lineTo(0, l.r * 1.3); ctx.lineTo(-l.r * 0.7, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawExitPortal(ctx, G) {
    if (!G.exitPortal) return;
    var e = G.exitPortal, t = R.time;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 3; i++) {
      ctx.strokeStyle = i % 2 ? "#25e0ff" : "#ff2fb9";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.r * (0.6 + i * 0.22), e.r * (0.9 - i * 0.1), t * (0.8 + i * 0.5), 0, U.TAU);
      ctx.stroke();
    }
    var g = ctx.createRadialGradient(0, 0, 2, 0, 0, e.r);
    g.addColorStop(0, "rgba(255,255,255,.75)");
    g.addColorStop(0.5, "rgba(155,92,255,.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#fff";
    ctx.font = "700 15px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.globalAlpha = 0.85 + Math.sin(t * 4) * 0.15;
    ctx.fillText("AVANZAR", 0, e.r + 22);
    ctx.restore();
  }

  NS.Render = R;
})(window.NS);
