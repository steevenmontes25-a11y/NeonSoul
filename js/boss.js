/* ============================================================
   NEON SOUL - boss.js
   5 bosses, each with 3 phases and unique attack patterns.
   -> To add a boss: add an entry to BOSSES and reference it
      from levels.js (zone.boss).
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U, P = NS.Particles, Cb = NS.Combat, A = NS.Audio;

  function shootB(b, angle, speed, dmg, o) {
    o = o || {};
    Cb.spawn({
      x: b.x + Math.cos(angle) * (o.off === undefined ? b.r * 0.8 : o.off),
      y: b.y + Math.sin(angle) * (o.off === undefined ? b.r * 0.8 : o.off),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: o.r || 8, dmg: dmg * (NS.Game.dmgMul || 1), owner: 1,
      color: o.color || b.color, life: o.life || 5, kind: o.kind || "bolt",
      knock: o.knock || 120, srcBoss: true, homing: o.homing || 0,
      bounce: o.bounce || 0, wobble: o.wobble || 0
    });
  }

  function ring(b, n, baseA, speed, dmg, o) {
    for (var i = 0; i < n; i++) shootB(b, baseA + i * U.TAU / n, speed, dmg, o);
    A.sfx("shootHeavy");
  }

  function aimAt(b, p) { return U.angle(b.x, b.y, p.x, p.y); }

  /* ============================================================
     PATTERN LIBRARY (shared building blocks)
     ============================================================ */
  function pMoveTo(b, tx, ty, dt, speed) {
    var d = U.norm(tx - b.x, ty - b.y);
    b.vx = U.damp(b.vx, d.x * speed, 3, dt);
    b.vy = U.damp(b.vy, d.y * speed, 3, dt);
  }

  /* ============================================================
     BOSS DEFINITIONS
     ============================================================ */
  var BOSSES = {
    /* ---------------------------------------------------- 1. THE WATCHER */
    watcher: {
      name: "THE WATCHER", title: "Ojo del Distrito",
      hp: 1050, r: 46, color: "#25e0ff", accent: "#ff2fb9", dmg: 14,
      xp: 260, coin: 190, shards: 3,
      phases: [1, 0.66, 0.33],
      patterns: [
        { id: "volley", minP: 0, dur: 2.4, cd: 1.1,
          start: function (b, p) { b.tmpA = aimAt(b, p); b.tick = 0; },
          tick: function (b, dt, p) {
            b.tick -= dt;
            if (b.tick <= 0) {
              b.tick = 0.42;
              ring(b, b.phase >= 1 ? 12 : 9, b.tmpA, 235, b.dmg * 0.55, { r: 8, color: b.color });
              b.tmpA += 0.28;
            }
            pMoveTo(b, p.x, p.y, dt, 40);
          } },
        { id: "sweep", minP: 0, dur: 3.1, cd: 2.2,
          start: function (b, p) {
            b.tmpA = aimAt(b, p) - 0.9;
            b.beam = NS.Game.addBeam({ x: b.x, y: b.y, angle: b.tmpA, len: 1600, width: 26, dur: 3.1, dmg: b.dmg * 1.5, color: b.accent, tele: 0.75 });
            A.sfx("warn");
          },
          tick: function (b, dt, p) {
            b.tmpA += dt * 0.62;
            if (b.beam) { b.beam.x = b.x; b.beam.y = b.y; b.beam.angle = b.tmpA; }
            b.vx *= 0.9; b.vy *= 0.9;
          },
          end: function (b) { if (b.beam) { b.beam.dead = true; b.beam = null; } } },
        { id: "summon", minP: 1, dur: 1.6, cd: 6,
          start: function (b, p) {
            A.sfx("portal");
            for (var i = 0; i < 3 + b.phase; i++) {
              var a = Math.random() * U.TAU, d = U.rand(150, 260);
              NS.Game.spawnEnemy(U.pick(["runner", "shooter", "hunter"]), b.x + Math.cos(a) * d, b.y + Math.sin(a) * d);
            }
          },
          tick: function (b, dt, p) { b.vx *= 0.88; b.vy *= 0.88; } },
        { id: "spiral", minP: 1, dur: 3.4, cd: 3,
          start: function (b) { b.tmpA = 0; b.tick = 0; },
          tick: function (b, dt, p) {
            b.tick -= dt;
            if (b.tick <= 0) {
              b.tick = 0.1;
              for (var k = 0; k < 3; k++) shootB(b, b.tmpA + k * U.TAU / 3, 200, b.dmg * 0.45, { r: 7, color: b.accent });
              b.tmpA += 0.36;
            }
            pMoveTo(b, NS.Game.arena.cx, NS.Game.arena.cy, dt, 60);
          } },
        { id: "eyerain", minP: 2, dur: 3.2, cd: 2.4,
          start: function (b) { b.tick = 0; },
          tick: function (b, dt, p) {
            b.tick -= dt;
            if (b.tick <= 0) {
              b.tick = 0.26;
              var ar = NS.Game.arena;
              var x = U.rand(ar.x + 40, ar.x + ar.w - 40), y = U.rand(ar.y + 40, ar.y + ar.h - 40);
              NS.Game.addTelegraph(x, y, 78, 0.9, b.accent, b.dmg * 1.1);
            }
            pMoveTo(b, p.x, p.y, dt, 70);
          } }
      ],
      onPhase: function (b, ph) {
        NS.Game.addShake(9);
        A.sfx("bossRoar");
        Cb.clearEnemyBullets(true);
        if (ph === 2) {
          NS.Game.shrinkArena(0.82);
          NS.Game.toast("LA ARENA SE DERRUMBA", "bad");
        }
      },
      draw: function (ctx, b, t) {
        var r = b.r;
        ctx.save();
        ctx.translate(b.x, b.y);
        // outer ring
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, U.TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;

        ctx.rotate(Math.sin(t * 0.7) * 0.15);
        ctx.lineWidth = 4;
        ctx.strokeStyle = b.flash > 0 ? "#fff" : b.color;
        ctx.fillStyle = "rgba(8,14,26,.9)";
        ctx.beginPath();
        for (var i = 0; i < 8; i++) {
          var a = i * U.TAU / 8;
          var rr = r * (i % 2 ? 0.82 : 1.1);
          var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();

        // pupil tracks player
        var p = NS.Game.player;
        var pa = p ? U.angle(b.x, b.y, p.x, p.y) : 0;
        ctx.save();
        ctx.translate(Math.cos(pa) * r * 0.22, Math.sin(pa) * r * 0.22);
        ctx.fillStyle = b.accent;
        ctx.shadowColor = b.accent; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.46, r * 0.3, pa, 0, U.TAU); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.13, 0, U.TAU); ctx.fill();
        ctx.restore();
        ctx.restore();
      }
    },

    /* ---------------------------------------------------- 2. THE BROKER */
    broker: {
      name: "THE BROKER", title: "Usurero de Datos",
      hp: 1750, r: 40, color: "#ffc53d", accent: "#3dffa8", dmg: 16,
      xp: 420, coin: 320, shards: 4,
      phases: [1, 0.62, 0.3],
      patterns: [
        { id: "coinbomb", minP: 0, dur: 2.6, cd: 1.4,
          start: function (b) { b.tick = 0; },
          tick: function (b, dt, p) {
            b.tick -= dt;
            if (b.tick <= 0) {
              b.tick = 0.55;
              var a = aimAt(b, p) + U.rand(-0.25, 0.25);
              Cb.spawn({
                x: b.x, y: b.y, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250,
                r: 11, dmg: b.dmg * 0.7, owner: 1, color: "#ffc53d", life: 1.05, kind: "orb",
                srcBoss: true, boom: { r: 105, dmg: b.dmg }
              });
              A.sfx("shootHeavy");
            }
            pMoveTo(b, p.x - (p.x - b.x) * 0.4, p.y - (p.y - b.y) * 0.4, dt, 90);
          } },
        { id: "turrets", minP: 0, dur: 1.4, cd: 7,
          start: function (b, p) {
            A.sfx("portal");
            var ar = NS.Game.arena;
            for (var i = 0; i < 2 + b.phase; i++) {
              NS.Game.spawnEnemy("sentry", U.rand(ar.x + 90, ar.x + ar.w - 90), U.rand(ar.y + 90, ar.y + ar.h - 90));
            }
          },
          tick: function (b, dt) { b.vx *= 0.9; b.vy *= 0.9; } },
        { id: "charge", minP: 1, dur: 2.2, cd: 3,
          start: function (b, p) {
            b.tmpA = aimAt(b, p);
            b.chargeT = 0.55;
            NS.Game.addTelegraph(b.x + Math.cos(b.tmpA) * 300, b.y + Math.sin(b.tmpA) * 300, 150, 0.55, "#ffc53d");
            A.sfx("warn");
          },
          tick: function (b, dt, p) {
            if (b.chargeT > 0) { b.chargeT -= dt; b.vx *= 0.85; b.vy *= 0.85; return; }
            b.vx = U.damp(b.vx, Math.cos(b.tmpA) * 620, 6, dt);
            b.vy = U.damp(b.vy, Math.sin(b.tmpA) * 620, 6, dt);
            P.trail(b.x, b.y, b.color, b.r * 0.8, 0.3);
            if (U.dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) * (b.r + p.r)) {
              p.takeDamage(b.dmg * 1.3, { angle: b.tmpA, knock: 340 });
            }
          } },
        { id: "rain", minP: 2, dur: 3.6, cd: 2.2,
          start: function (b) { b.tick = 0; },
          tick: function (b, dt, p) {
            b.tick -= dt;
            if (b.tick <= 0) {
              b.tick = 0.14;
              var ar = NS.Game.arena;
              var x = U.rand(ar.x, ar.x + ar.w);
              Cb.spawn({ x: x, y: ar.y - 20, vx: U.rand(-30, 30), vy: 300, r: 7, dmg: b.dmg * 0.5, owner: 1, color: "#ffc53d", life: 5, srcBoss: true });
            }
            pMoveTo(b, NS.Game.arena.cx, NS.Game.arena.y + 120, dt, 100);
          } },
        { id: "homing", minP: 1, dur: 2.4, cd: 3.4,
          start: function (b) { b.tick = 0; },
          tick: function (b, dt, p) {
            b.tick -= dt;
            if (b.tick <= 0) {
              b.tick = 0.6;
              for (var i = 0; i < 3; i++) {
                shootB(b, aimAt(b, p) + (i - 1) * 0.5, 190, b.dmg * 0.6, { r: 9, color: "#3dffa8", homing: 1.1, kind: "orb", life: 4 });
              }
            }
            pMoveTo(b, p.x, p.y, dt, 70);
          } }
      ],
      onPhase: function (b, ph) {
        NS.Game.addShake(9); A.sfx("bossRoar");
        Cb.clearEnemyBullets(true);
        for (var i = 0; i < 12; i++) NS.Game.dropCoin(b.x + U.rand(-60, 60), b.y + U.rand(-60, 60), 5);
        NS.Game.toast(ph === 2 ? "MODO AVARICIA" : "EL BROKER SE ENFADA", "bad");
      },
      draw: function (ctx, b, t) {
        var r = b.r;
        ctx.save(); ctx.translate(b.x, b.y);
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.25;
        ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, U.TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        ctx.lineWidth = 4; ctx.strokeStyle = b.flash > 0 ? "#fff" : b.color;
        ctx.fillStyle = "rgba(26,18,4,.92)";
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.15); ctx.lineTo(r, 0); ctx.lineTo(0, r * 1.15); ctx.lineTo(-r, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // orbiting coins
        ctx.globalCompositeOperation = "lighter";
        for (var i = 0; i < 4; i++) {
          var a = t * 1.6 + i * U.TAU / 4;
          ctx.fillStyle = b.accent;
          ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, 6, 0, U.TAU); ctx.fill();
        }
        ctx.restore();
      }
    },

    /* ---------------------------------------------------- 3. FORGE TYRANT */
    forge: {
      name: "FORGE TYRANT", title: "Señor de la Fundición",
      hp: 2900, r: 54, color: "#ff5a28", accent: "#ffc53d", dmg: 19,
      xp: 640, coin: 460, shards: 5, heavy: true,
      phases: [1, 0.6, 0.28],
      patterns: [
        { id: "flamecone", minP: 0, dur: 2.8, cd: 1.6,
          start: function (b, p) { b.tmpA = aimAt(b, p); b.dir = U.chance(0.5) ? 1 : -1; b.tick = 0; A.sfx("warn"); },
          tick: function (b, dt, p) {
            b.tmpA += dt * 0.85 * b.dir;
            b.tick -= dt;
            if (b.tick <= 0) {
              b.tick = 0.07;
              shootB(b, b.tmpA + U.rand(-0.12, 0.12), U.rand(210, 300), b.dmg * 0.34, { r: 9, color: "#ff8a3d", life: 1.5, kind: "orb" });
            }
            b.vx *= 0.92; b.vy *= 0.92;
          } },
        { id: "slam", minP: 0, dur: 2.2, cd: 2.6,
          start: function (b, p) { b.tmpX = p.x; b.tmpY = p.y; b.hopT = 0.7; NS.Game.addTelegraph(p.x, p.y, 165, 0.7, "#ff5a28"); A.sfx("warn"); },
          tick: function (b, dt, p) {
            if (b.hopT > 0) {
              b.hopT -= dt;
              b.x = U.damp(b.x, b.tmpX, 5, dt); b.y = U.damp(b.y, b.tmpY, 5, dt);
              if (b.hopT <= 0) {
                Cb.explosion(b.x, b.y, 170, b.dmg * 1.5, { owner: 1, color: "#ff5a28", shake: 11 });
                for (var i = 0; i < 10; i++) shootB(b, i * U.TAU / 10 + U.rand(-0.1, 0.1), 260, b.dmg * 0.5, { r: 8, color: "#ff8a3d" });
                NS.Game.addShake(12);
                A.vibrate(60);
              }
            } else { b.vx *= 0.9; b.vy *= 0.9; }
          } },
        { id: "pillars", minP: 1, dur: 4, cd: 3.4,
          start: function (b) { b.tick = 0; b.tmpA = Math.random() * U.TAU; },
          tick: function (b, dt, p) {
            b.tick -= dt;
            if (b.tick <= 0) {
              b.tick = 0.55;
              var ar = NS.Game.arena;
              for (var i = 0; i < 3; i++) {
                var a = b.tmpA + i * U.TAU / 3;
                var d = U.rand(120, Math.min(ar.w, ar.h) * 0.42);
                NS.Game.addZone(ar.cx + Math.cos(a) * d, ar.cy + Math.sin(a) * d, 62, 4.5, b.dmg * 0.9, "#ff5a28");
              }
              b.tmpA += 0.7;
            }
            pMoveTo(b, NS.Game.arena.cx, NS.Game.arena.cy, dt, 60);
          } },
        { id: "missiles", minP: 1, dur: 3, cd: 3,
          start: function (b) { b.tick = 0; },
          tick: function (b, dt, p) {
            b.tick -= dt;
            if (b.tick <= 0) {
              b.tick = 0.32;
              shootB(b, aimAt(b, p) + U.rand(-0.6, 0.6), 165, b.dmg * 0.65, { r: 10, color: "#ffc53d", homing: 0.9, life: 4.5, kind: "orb" });
              A.sfx("shoot");
            }
            pMoveTo(b, p.x, p.y, dt, 55);
          } },
        { id: "overheat", minP: 2, dur: 4.6, cd: 4,
          start: function (b) { b.tick = 0; NS.Game.toast("SOBRECALENTAMIENTO", "bad"); A.sfx("bossRoar"); },
          tick: function (b, dt, p) {
            b.tick -= dt;
            P.spark(b.x, b.y, 2, { color: "#ff8a3d", speed: 200, life: 0.5, size: 3 });
            if (b.tick <= 0) {
              b.tick = 0.45;
              NS.Game.addZone(b.x, b.y, 70, 5, b.dmg * 0.8, "#ff5a28");
              ring(b, 10, Math.random() * U.TAU, 230, b.dmg * 0.4, { r: 7, color: "#ff8a3d" });
            }
            pMoveTo(b, p.x, p.y, dt, 130);
          } }
      ],
      onPhase: function (b, ph) {
        NS.Game.addShake(11); A.sfx("bossRoar");
        Cb.clearEnemyBullets(true);
        if (ph === 1) { for (var i = 0; i < 2; i++) NS.Game.spawnEnemy("tank", b.x + U.rand(-140, 140), b.y + U.rand(-140, 140)); }
        if (ph === 2) { b.speedBoost = 1.5; NS.Game.toast("EL NUCLEO ESTALLA", "bad"); }
      },
      draw: function (ctx, b, t) {
        var r = b.r;
        ctx.save(); ctx.translate(b.x, b.y);
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#ff5a28"; ctx.beginPath(); ctx.arc(0, 0, r * 1.5 + Math.sin(t * 6) * 6, 0, U.TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        ctx.lineWidth = 5; ctx.strokeStyle = b.flash > 0 ? "#fff" : b.color;
        ctx.fillStyle = "rgba(30,8,4,.94)";
        ctx.beginPath();
        ctx.rect(-r * 0.85, -r * 0.9, r * 1.7, r * 1.8);
        ctx.fill(); ctx.stroke();
        // shoulders
        ctx.beginPath();
        ctx.rect(-r * 1.35, -r * 0.8, r * 0.45, r * 0.9);
        ctx.rect(r * 0.9, -r * 0.8, r * 0.45, r * 0.9);
        ctx.fill(); ctx.stroke();
        // furnace core
        ctx.fillStyle = "#ffc53d";
        ctx.shadowColor = "#ff8a3d"; ctx.shadowBlur = 26;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.3 * (1 + Math.sin(t * 5) * 0.12), 0, U.TAU); ctx.fill();
        ctx.restore();
      }
    },

    /* ---------------------------------------------------- 4. VALKYR */
    valkyr: {
      name: "VALKYR", title: "Guardiana de las Ruinas",
      hp: 3900, r: 38, color: "#9b5cff", accent: "#bff6ff", dmg: 21,
      xp: 900, coin: 620, shards: 6,
      phases: [1, 0.64, 0.32],
      patterns: [
        { id: "cross", minP: 0, dur: 2.4, cd: 1.3,
          start: function (b) { b.tick = 0; b.tmpA = Math.random() * U.TAU; },
          tick: function (b, dt, p) {
            b.tick -= dt;
            if (b.tick <= 0) {
              b.tick = 0.5;
              for (var i = 0; i < 4; i++) {
                shootB(b, b.tmpA + i * Math.PI / 2, 290, b.dmg * 0.5, { r: 8, color: b.accent });
                shootB(b, b.tmpA + i * Math.PI / 2 + Math.PI / 4, 210, b.dmg * 0.4, { r: 6, color: b.color });
              }
              b.tmpA += 0.4;
            }
            pMoveTo(b, p.x + Math.cos(b.t) * 180, p.y + Math.sin(b.t * 1.3) * 180, dt, 150);
          } },
        { id: "blades", minP: 0, dur: 3.2, cd: 2.4,
          start: function (b, p) { b.dashN = 3; b.dashT = 0; },
          tick: function (b, dt, p) {
            b.dashT -= dt;
            if (b.dashT <= 0 && b.dashN > 0) {
              b.dashN--;
              b.dashT = 0.75;
              b.tmpA = aimAt(b, p);
              var ar = NS.Game.arena;
              b.x = U.clamp(p.x - Math.cos(b.tmpA) * 320, ar.x + 50, ar.x + ar.w - 50);
              b.y = U.clamp(p.y - Math.sin(b.tmpA) * 320, ar.y + 50, ar.y + ar.h - 50);
              b.tmpA = aimAt(b, p);
              P.ring(b.x, b.y, { r0: 6, r1: 90, color: b.color, life: 0.3, w: 3 });
              A.sfx("dash");
              b.vx = Math.cos(b.tmpA) * 780; b.vy = Math.sin(b.tmpA) * 780;
            }
            P.trail(b.x, b.y, b.accent, b.r * 0.7, 0.3);
            if (U.dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) * (b.r + p.r)) {
              p.takeDamage(b.dmg, { angle: Math.atan2(b.vy, b.vx), knock: 300 });
            }
            b.vx *= Math.exp(-2.2 * dt); b.vy *= Math.exp(-2.2 * dt);
          } },
        { id: "feathers", minP: 1, dur: 3.4, cd: 2.6,
          start: function (b) { b.tick = 0; },
          tick: function (b, dt, p) {
            b.tick -= dt;
            if (b.tick <= 0) {
              b.tick = 0.18;
              var a = aimAt(b, p) + U.rand(-0.9, 0.9);
              shootB(b, a, U.rand(230, 340), b.dmg * 0.4, { r: 6, color: b.accent, wobble: 0.6, life: 3 });
            }
            pMoveTo(b, NS.Game.arena.cx + Math.cos(b.t * 0.8) * 200, NS.Game.arena.cy + Math.sin(b.t * 0.8) * 150, dt, 170);
          } },
        { id: "clones", minP: 2, dur: 1.2, cd: 12,
          start: function (b, p) {
            A.sfx("portal");
            NS.Game.toast("ECOS DE VALKYR", "bad");
            for (var i = 0; i < 2; i++) {
              var a = Math.random() * U.TAU;
              var c = NS.Game.spawnEnemy("hunter", b.x + Math.cos(a) * 180, b.y + Math.sin(a) * 180, { elite: true });
              if (c) { c.color = "#bff6ff"; c.maxHp = c.hp = Math.round(b.maxHp * 0.08); }
            }
          },
          tick: function (b, dt) { b.vx *= 0.9; b.vy *= 0.9; } },
        { id: "lance", minP: 1, dur: 2.6, cd: 3.2,
          start: function (b, p) {
            b.tmpA = aimAt(b, p);
            b.beam = NS.Game.addBeam({ x: b.x, y: b.y, angle: b.tmpA, len: 1600, width: 20, dur: 2.6, dmg: b.dmg * 1.4, color: b.accent, tele: 0.6, follow: 1.2 });
            A.sfx("warn");
          },
          tick: function (b, dt, p) {
            if (b.beam) {
              b.beam.x = b.x; b.beam.y = b.y;
              b.beam.angle = U.rotateToward(b.beam.angle, aimAt(b, p), 1.1 * dt);
            }
            b.vx *= 0.93; b.vy *= 0.93;
          },
          end: function (b) { if (b.beam) { b.beam.dead = true; b.beam = null; } } }
      ],
      onPhase: function (b, ph) {
        NS.Game.addShake(10); A.sfx("bossRoar");
        Cb.clearEnemyBullets(true);
        if (ph === 1) NS.Game.toast("VALKYR DESPLIEGA SUS ALAS", "bad");
      },
      draw: function (ctx, b, t) {
        var r = b.r;
        ctx.save(); ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.28;
        ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, U.TAU); ctx.fill();
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        ctx.lineWidth = 4; ctx.strokeStyle = b.flash > 0 ? "#fff" : b.color;
        ctx.fillStyle = "rgba(16,8,32,.92)";
        // wings
        var flap = Math.sin(t * 4) * 0.25;
        for (var s = -1; s <= 1; s += 2) {
          ctx.save();
          ctx.scale(s, 1);
          ctx.rotate(flap);
          ctx.beginPath();
          ctx.moveTo(r * 0.3, 0);
          ctx.lineTo(r * 1.7, -r * 0.5);
          ctx.lineTo(r * 1.4, r * 0.35);
          ctx.lineTo(r * 0.4, r * 0.5);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
        // body
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 0.5, r * 0.4); ctx.lineTo(0, r * 1.0); ctx.lineTo(-r * 0.5, r * 0.4);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.accent; ctx.shadowColor = b.accent; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(0, -r * 0.25, r * 0.22, 0, U.TAU); ctx.fill();
        ctx.restore();
      }
    },

    /* ---------------------------------------------------- 5. NEXUS AVATAR */
    avatar: {
      name: "NEXUS AVATAR", title: "El Corazón Devorador",
      hp: 6200, r: 58, color: "#ff2fb9", accent: "#ffffff", dmg: 24,
      xp: 1600, coin: 1100, shards: 10,
      phases: [1, 0.7, 0.4, 0.15],
      patterns: [
        { id: "mirror", minP: 0, dur: 3.2, cd: 1.2,
          start: function (b, p) { b.tick = 0; b.mirrorSoul = p.state === "soul"; },
          tick: function (b, dt, p) {
            b.tick -= dt;
            if (b.tick <= 0) {
              // mirrors the player's state: fast small shots vs slow heavy shots
              if (p.state === "soul") {
                b.tick = 0.14;
                shootB(b, aimAt(b, p) + U.rand(-0.35, 0.35), 380, b.dmg * 0.3, { r: 6, color: "#25e0ff" });
              } else {
                b.tick = 0.7;
                ring(b, 14, aimAt(b, p), 200, b.dmg * 0.5, { r: 10, color: b.color });
              }
            }
            pMoveTo(b, p.x, p.y, dt, 70);
          } },
        { id: "wells", minP: 0, dur: 3.6, cd: 4,
          start: function (b) {
            var ar = NS.Game.arena;
            for (var i = 0; i < 3; i++) {
              NS.Game.addVortex(U.rand(ar.x + 100, ar.x + ar.w - 100), U.rand(ar.y + 100, ar.y + ar.h - 100), 175, 3.4, b.dmg * 0.35);
            }
            A.sfx("portal");
          },
          tick: function (b, dt, p) {
            b.vx *= 0.94; b.vy *= 0.94;
            if (Math.random() < dt * 3) shootB(b, Math.random() * U.TAU, 190, b.dmg * 0.4, { r: 8, color: b.accent });
          } },
        { id: "grid", minP: 1, dur: 4.2, cd: 4.4,
          start: function (b) {
            var ar = NS.Game.arena, i;
            for (i = 0; i < 4; i++) {
              NS.Game.addBeam({ x: ar.x, y: ar.y + ar.h * (i + 0.5) / 4, angle: 0, len: ar.w + 100, width: 22, dur: 1.6, dmg: b.dmg, color: "#ff2fb9", tele: 0.9, delay: i * 0.35 });
            }
            for (i = 0; i < 3; i++) {
              NS.Game.addBeam({ x: ar.x + ar.w * (i + 0.5) / 3, y: ar.y, angle: Math.PI / 2, len: ar.h + 100, width: 22, dur: 1.6, dmg: b.dmg, color: "#25e0ff", tele: 0.9, delay: 1.4 + i * 0.35 });
            }
            A.sfx("warn");
          },
          tick: function (b, dt, p) { pMoveTo(b, NS.Game.arena.cx, NS.Game.arena.cy, dt, 50); } },
        { id: "swarm", minP: 1, dur: 1.6, cd: 8,
          start: function (b, p) {
            A.sfx("portal");
            for (var i = 0; i < 5; i++) {
              var a = Math.random() * U.TAU, d = U.rand(170, 300);
              NS.Game.spawnEnemy(U.pick(["phantom", "berserker", "bomber", "hunter"]), b.x + Math.cos(a) * d, b.y + Math.sin(a) * d);
            }
          },
          tick: function (b, dt) { b.vx *= 0.9; b.vy *= 0.9; } },
        { id: "consume", minP: 2, dur: 3.4, cd: 5,
          start: function (b, p) {
            NS.Game.toast("EL NEXUS DEVORA TU ALMA", "bad");
            A.sfx("bossRoar");
            b.tick = 0;
          },
          tick: function (b, dt, p) {
            b.tick -= dt;
            p.soul = Math.max(0, p.soul - 14 * dt);
            if (b.tick <= 0) {
              b.tick = 0.3;
              var a = aimAt(b, p);
              for (var i = -2; i <= 2; i++) shootB(b, a + i * 0.17, 300, b.dmg * 0.45, { r: 8, color: "#fff", homing: 0.5 });
            }
            pMoveTo(b, p.x, p.y, dt, 110);
          } },
        { id: "finale", minP: 3, dur: 5, cd: 2,
          start: function (b) { b.tick = 0; b.tmpA = 0; NS.Game.addShake(8); },
          tick: function (b, dt, p) {
            b.tick -= dt;
            b.tmpA += dt * 2.2;
            if (b.tick <= 0) {
              b.tick = 0.09;
              for (var k = 0; k < 4; k++) shootB(b, b.tmpA + k * U.TAU / 4, 250, b.dmg * 0.34, { r: 7, color: k % 2 ? "#25e0ff" : "#ff2fb9" });
            }
            if (Math.random() < dt * 1.6) {
              var ar = NS.Game.arena;
              NS.Game.addTelegraph(U.rand(ar.x + 60, ar.x + ar.w - 60), U.rand(ar.y + 60, ar.y + ar.h - 60), 90, 0.8, "#fff", b.dmg);
            }
            pMoveTo(b, NS.Game.arena.cx, NS.Game.arena.cy, dt, 60);
          } }
      ],
      onPhase: function (b, ph) {
        NS.Game.addShake(14); A.sfx("bossRoar");
        Cb.clearEnemyBullets(true);
        NS.Game.toast("FASE " + (ph + 1), "bad");
        if (ph === 2) NS.Game.shrinkArena(0.86);
      },
      draw: function (ctx, b, t) {
        var r = b.r;
        ctx.save(); ctx.translate(b.x, b.y);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.9 + Math.sin(t * 3) * 8, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        // rotating rings
        for (var k = 0; k < 3; k++) {
          ctx.save();
          ctx.rotate(t * (0.6 + k * 0.42) * (k % 2 ? -1 : 1));
          ctx.strokeStyle = k % 2 ? "#25e0ff" : b.color;
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.ellipse(0, 0, r * (1.25 + k * 0.28), r * (0.5 + k * 0.2), 0, 0, U.TAU);
          ctx.stroke();
          ctx.restore();
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = 5; ctx.strokeStyle = b.flash > 0 ? "#fff" : b.accent;
        ctx.fillStyle = "rgba(24,4,26,.94)";
        ctx.beginPath();
        for (var i = 0; i < 12; i++) {
          var a = i * U.TAU / 12;
          var rr = r * (i % 2 ? 0.66 : 1.05) * (1 + Math.sin(t * 3 + i) * 0.04);
          var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.shadowColor = b.color; ctx.shadowBlur = 34;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.26 * (1 + Math.sin(t * 7) * 0.14), 0, U.TAU); ctx.fill();
        ctx.restore();
      }
    }
  };

  /* ============================================================
     RUNTIME
     ============================================================ */
  var B = {
    DEFS: BOSSES,

    create: function (id, x, y, opts) {
      opts = opts || {};
      var def = BOSSES[id] || BOSSES.watcher;
      var b = {
        id: 100000 + Math.floor(Math.random() * 10000),
        bossId: id, def: def, isBoss: true,
        name: def.name, title: def.title,
        x: x, y: y, vx: 0, vy: 0, kx: 0, ky: 0,
        r: def.r,
        maxHp: Math.round(def.hp * (opts.hpMul || 1)),
        dmg: def.dmg * (opts.dmgMul || 1),
        color: def.color, accent: def.accent,
        xp: def.xp, coin: def.coin, shards: def.shards,
        heavy: true, armor: 0,
        marks: 0, markPulse: 0, flash: 0, hitT: 0, t: 0, seed: 0,
        dead: false, spawning: 1.6,
        status: { burnT: 0, burnDps: 0, burnTick: 0, chillT: 0, chill: 0, shockT: 0 },
        phase: 0, phaseCount: def.phases.length,
        pattern: null, patT: 0, idleT: 1.2, cds: {},
        speedBoost: 1, elite: false, contactCd: 0
      };
      b.hp = b.maxHp;
      def.patterns.forEach(function (p) { b.cds[p.id] = U.rand(0, p.cd * 0.5); });
      return b;
    },

    update: function (b, dt, p, G) {
      b.t += dt;
      if (b.flash > 0) b.flash -= dt;
      if (b.hitT > 0) b.hitT -= dt;
      if (b.markPulse > 0) b.markPulse -= dt;

      if (b.spawning > 0) {
        b.spawning -= dt;
        if (b.spawning <= 0) { b.spawning = 0; A.sfx("bossRoar"); G.addShake(10); }
        return;
      }

      Cb.updateStatus(b, dt);
      if (b.dead) return;

      // phase transitions
      var frac = b.hp / b.maxHp;
      while (b.phase < b.def.phases.length - 1 && frac <= b.def.phases[b.phase + 1]) {
        b.phase++;
        b.pattern = null; b.patT = 0; b.idleT = 1.1;
        b.invuln = 0.9;
        if (b.def.onPhase) b.def.onPhase(b, b.phase);
      }
      if (b.invuln > 0) b.invuln -= dt;

      // pattern state machine
      var keys;
      if (b.pattern) {
        b.patT -= dt;
        if (b.pattern.tick) b.pattern.tick(b, dt, p, G);
        if (b.patT <= 0) {
          if (b.pattern.end) b.pattern.end(b, p);
          b.cds[b.pattern.id] = b.pattern.cd;
          b.pattern = null;
          b.idleT = U.rand(0.45, 0.95) / (1 + b.phase * 0.25);
        }
      } else {
        b.idleT -= dt;
        // drift toward a comfortable distance
        var d = U.norm(p.x - b.x, p.y - b.y);
        var want = d.m > 300 ? 1 : (d.m < 160 ? -1 : 0);
        b.vx = U.damp(b.vx, d.x * want * 90, 2, dt);
        b.vy = U.damp(b.vy, d.y * want * 90, 2, dt);
        for (keys in b.cds) if (b.cds[keys] > 0) b.cds[keys] -= dt;
        if (b.idleT <= 0) {
          var avail = b.def.patterns.filter(function (pt) {
            return pt.minP <= b.phase && (b.cds[pt.id] || 0) <= 0;
          });
          if (!avail.length) avail = b.def.patterns.filter(function (pt) { return pt.minP <= b.phase; });
          var pick = U.pick(avail);
          b.pattern = pick;
          b.patT = pick.dur;
          if (pick.start) pick.start(b, p, G);
        }
      }

      var sb = b.speedBoost || 1;
      b.x += (b.vx * sb + b.kx) * dt;
      b.y += (b.vy * sb + b.ky) * dt;
      b.kx *= Math.exp(-6 * dt); b.ky *= Math.exp(-6 * dt);
      G.clampToArena(b);

      // contact damage
      if (b.contactCd > 0) b.contactCd -= dt;
      if (!p.dead && b.contactCd <= 0) {
        var pr = b.r + p.r * 0.8;
        if (U.dist2(b.x, b.y, p.x, p.y) < pr * pr) {
          b.contactCd = 0.8;
          p.takeDamage(b.dmg * 0.7, { angle: U.angle(b.x, b.y, p.x, p.y), knock: 240 });
        }
      }
    },

    draw: function (ctx, b, t) {
      if (b.spawning > 0) {
        var k = 1 - b.spawning / 1.6;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = b.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (3.2 - k * 2.1), 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = k;
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = k;
        b.def.draw(ctx, b, t);
        ctx.restore();
        return;
      }
      if (b.invuln > 0 && Math.floor(t * 20) % 2 === 0) {
        ctx.save(); ctx.globalAlpha = 0.55;
        b.def.draw(ctx, b, t);
        ctx.restore();
      } else {
        b.def.draw(ctx, b, t);
      }
      if (b.marks > 0) NS.Enemies.drawMarks(ctx, b, t);
    }
  };

  NS.Boss = B;
})(window.NS);
