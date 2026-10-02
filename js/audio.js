/* ============================================================
   NEON SOUL - audio.js
   100% procedural audio via Web Audio API (no external files):
   - synth SFX one-shots
   - step-sequenced music (menu / combat / boss / victory)
   - haptics
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U, Save = NS.Save;

  var A = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    ready: false, muted: false,
    _noiseBuf: null, _track: null, _nextNote: 0, _step: 0,
    _timer: null, _voices: 0, _lastSfx: {}
  };

  var MAX_VOICES = 24;

  A.init = function () {
    if (A.ready) return true;
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return false;
    try { A.ctx = new C(); } catch (e) { return false; }
    A.master = A.ctx.createGain();
    A.master.gain.value = 0.9;
    var comp = A.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 9;
    comp.attack.value = 0.003; comp.release.value = 0.22;
    A.master.connect(comp); comp.connect(A.ctx.destination);

    A.musicGain = A.ctx.createGain();
    A.sfxGain = A.ctx.createGain();
    A.musicGain.connect(A.master); A.sfxGain.connect(A.master);
    A.applyVolumes();

    // shared noise buffer
    var len = A.ctx.sampleRate * 1.2;
    A._noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    var d = A._noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    A.ready = true;
    return true;
  };

  A.resume = function () {
    if (!A.ready) A.init();
    if (A.ctx && A.ctx.state === "suspended") A.ctx.resume();
  };

  A.applyVolumes = function () {
    if (!A.ready) return;
    var s = Save.data.settings;
    A.musicGain.gain.value = A.muted ? 0 : (s.music || 0);
    A.sfxGain.gain.value = A.muted ? 0 : (s.sfx || 0);
  };

  A.suspendAll = function () { if (A.ctx && A.ctx.state === "running") A.ctx.suspend(); };

  // ---------------- primitives ----------------
  function env(node, t, a, d, s, r, peak, sustainLvl) {
    var g = node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + a);
    g.exponentialRampToValueAtTime(Math.max(0.0001, peak * (sustainLvl === undefined ? 0.5 : sustainLvl)), t + a + d);
    g.setValueAtTime(Math.max(0.0001, peak * (sustainLvl === undefined ? 0.5 : sustainLvl)), t + a + d + s);
    g.exponentialRampToValueAtTime(0.0001, t + a + d + s + r);
  }

  function tone(opts) {
    if (!A.ready || A._voices > MAX_VOICES) return;
    var t = opts.t || A.ctx.currentTime;
    var o = A.ctx.createOscillator();
    var g = A.ctx.createGain();
    o.type = opts.type || "square";
    o.frequency.setValueAtTime(opts.f, t);
    if (opts.f2 !== undefined) {
      if (opts.glide === "exp") o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f2), t + (opts.dur || 0.2));
      else o.frequency.linearRampToValueAtTime(opts.f2, t + (opts.dur || 0.2));
    }
    var dest = opts.dest || A.sfxGain;
    var last = g;
    if (opts.filter) {
      var f = A.ctx.createBiquadFilter();
      f.type = opts.filter;
      f.frequency.setValueAtTime(opts.cutoff || 1200, t);
      if (opts.cutoff2) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.cutoff2), t + (opts.dur || 0.2));
      f.Q.value = opts.q || 1;
      g.connect(f); last = f;
    }
    o.connect(g);
    last.connect(dest);
    var dur = opts.dur || 0.2;
    env(g, t, opts.a || 0.004, opts.d || dur * 0.3, opts.s || 0, opts.r || dur * 0.6, opts.vol === undefined ? 0.3 : opts.vol, opts.sus);
    o.start(t);
    o.stop(t + dur + (opts.r || dur * 0.6) + 0.06);
    A._voices++;
    o.onended = function () { A._voices--; try { o.disconnect(); g.disconnect(); if (last !== g) last.disconnect(); } catch (e) { } };
  }

  function noise(opts) {
    if (!A.ready || A._voices > MAX_VOICES) return;
    var t = opts.t || A.ctx.currentTime;
    var src = A.ctx.createBufferSource();
    src.buffer = A._noiseBuf;
    src.playbackRate.value = opts.rate || 1;
    var f = A.ctx.createBiquadFilter();
    f.type = opts.filter || "bandpass";
    f.frequency.setValueAtTime(opts.f || 900, t);
    if (opts.f2) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.f2), t + (opts.dur || 0.2));
    f.Q.value = opts.q || 1.1;
    var g = A.ctx.createGain();
    src.connect(f); f.connect(g); g.connect(opts.dest || A.sfxGain);
    var dur = opts.dur || 0.2;
    env(g, t, opts.a || 0.002, opts.d || dur * 0.4, 0, opts.r || dur * 0.6, opts.vol === undefined ? 0.25 : opts.vol, 0.2);
    src.start(t);
    src.stop(t + dur + (opts.r || dur * 0.6) + 0.05);
    A._voices++;
    src.onended = function () { A._voices--; try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (e) { } };
  }

  // ---------------- SFX library ----------------
  var SFX = {
    shoot: function (t) {
      tone({ t: t, type: "square", f: 720, f2: 240, glide: "exp", dur: 0.09, vol: 0.14, filter: "lowpass", cutoff: 2600, cutoff2: 700 });
      noise({ t: t, f: 2400, f2: 900, dur: 0.05, vol: 0.05 });
    },
    shootHeavy: function (t) {
      tone({ t: t, type: "sawtooth", f: 340, f2: 90, glide: "exp", dur: 0.22, vol: 0.2, filter: "lowpass", cutoff: 1800, cutoff2: 300 });
      noise({ t: t, f: 1200, f2: 200, dur: 0.18, vol: 0.12 });
    },
    hit: function (t) {
      noise({ t: t, f: 1800, f2: 600, dur: 0.06, vol: 0.14, q: 0.8 });
      tone({ t: t, type: "triangle", f: 480, f2: 200, dur: 0.06, vol: 0.09 });
    },
    crit: function (t) {
      tone({ t: t, type: "square", f: 1400, f2: 500, glide: "exp", dur: 0.13, vol: 0.16 });
      noise({ t: t, f: 3400, f2: 800, dur: 0.11, vol: 0.13 });
    },
    kill: function (t) {
      noise({ t: t, filter: "lowpass", f: 1400, f2: 120, dur: 0.24, vol: 0.2 });
      tone({ t: t, type: "sawtooth", f: 220, f2: 55, glide: "exp", dur: 0.26, vol: 0.13 });
    },
    explode: function (t) {
      noise({ t: t, filter: "lowpass", f: 900, f2: 70, dur: 0.5, vol: 0.32, r: 0.4 });
      tone({ t: t, type: "sine", f: 130, f2: 36, glide: "exp", dur: 0.45, vol: 0.26 });
    },
    hurt: function (t) {
      tone({ t: t, type: "sawtooth", f: 200, f2: 70, glide: "exp", dur: 0.26, vol: 0.26, filter: "lowpass", cutoff: 1400, cutoff2: 260 });
      noise({ t: t, f: 700, f2: 180, dur: 0.2, vol: 0.16 });
    },
    dash: function (t) {
      noise({ t: t, filter: "bandpass", f: 500, f2: 3200, dur: 0.17, vol: 0.14, q: 2.2 });
      tone({ t: t, type: "sine", f: 300, f2: 900, dur: 0.15, vol: 0.09 });
    },
    shiftSoul: function (t) {
      tone({ t: t, type: "sine", f: 300, f2: 1300, glide: "exp", dur: 0.3, vol: 0.2 });
      tone({ t: t + 0.03, type: "triangle", f: 450, f2: 1900, glide: "exp", dur: 0.3, vol: 0.12 });
      noise({ t: t, f: 900, f2: 5200, dur: 0.3, vol: 0.08, q: 1.6 });
    },
    shiftFury: function (t) {
      tone({ t: t, type: "sawtooth", f: 900, f2: 110, glide: "exp", dur: 0.34, vol: 0.24, filter: "lowpass", cutoff: 3000, cutoff2: 380 });
      noise({ t: t, filter: "lowpass", f: 1600, f2: 120, dur: 0.3, vol: 0.16 });
    },
    detonate: function (t) {
      tone({ t: t, type: "square", f: 180, f2: 1500, glide: "exp", dur: 0.16, vol: 0.2 });
      noise({ t: t + 0.02, filter: "lowpass", f: 2600, f2: 200, dur: 0.4, vol: 0.28, r: 0.3 });
      tone({ t: t + 0.02, type: "sine", f: 90, f2: 40, dur: 0.4, vol: 0.22 });
    },
    coin: function (t) {
      tone({ t: t, type: "square", f: 1320, dur: 0.05, vol: 0.09 });
      tone({ t: t + 0.05, type: "square", f: 1980, dur: 0.1, vol: 0.09 });
    },
    heal: function (t) {
      tone({ t: t, type: "sine", f: 520, f2: 780, dur: 0.18, vol: 0.14 });
      tone({ t: t + 0.09, type: "sine", f: 780, f2: 1040, dur: 0.22, vol: 0.12 });
    },
    shield: function (t) {
      tone({ t: t, type: "triangle", f: 300, f2: 900, dur: 0.24, vol: 0.14, filter: "highpass", cutoff: 300 });
      noise({ t: t, f: 2600, dur: 0.2, vol: 0.06 });
    },
    ability: function (t) {
      tone({ t: t, type: "sawtooth", f: 160, f2: 720, glide: "exp", dur: 0.26, vol: 0.2, filter: "lowpass", cutoff: 600, cutoff2: 4200 });
      noise({ t: t + 0.05, f: 1800, f2: 4200, dur: 0.22, vol: 0.1 });
    },
    click: function (t) {
      tone({ t: t, type: "square", f: 880, f2: 1320, dur: 0.045, vol: 0.09 });
    },
    back: function (t) {
      tone({ t: t, type: "square", f: 700, f2: 420, dur: 0.06, vol: 0.08 });
    },
    upgrade: function (t) {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone({ t: t + i * 0.07, type: "triangle", f: f, dur: 0.2, vol: 0.13 });
      });
    },
    unlock: function (t) {
      [392, 523, 659, 784, 1047, 1319].forEach(function (f, i) {
        tone({ t: t + i * 0.06, type: "square", f: f, dur: 0.24, vol: 0.1 });
      });
    },
    levelup: function (t) {
      [440, 554, 659, 880].forEach(function (f, i) {
        tone({ t: t + i * 0.08, type: "sawtooth", f: f, dur: 0.3, vol: 0.12, filter: "lowpass", cutoff: 3000 });
      });
    },
    death: function (t) {
      tone({ t: t, type: "sawtooth", f: 420, f2: 40, glide: "exp", dur: 1.5, vol: 0.3, filter: "lowpass", cutoff: 2200, cutoff2: 120, r: 0.9 });
      noise({ t: t, filter: "lowpass", f: 800, f2: 60, dur: 1.4, vol: 0.2, r: 0.8 });
    },
    bossRoar: function (t) {
      tone({ t: t, type: "sawtooth", f: 70, f2: 160, dur: 1.1, vol: 0.34, filter: "lowpass", cutoff: 400, cutoff2: 1600, r: 0.6 });
      tone({ t: t + 0.05, type: "square", f: 104, f2: 46, dur: 1.0, vol: 0.2, filter: "lowpass", cutoff: 900 });
      noise({ t: t, filter: "lowpass", f: 600, f2: 2000, dur: 1.0, vol: 0.18, r: 0.5 });
    },
    warn: function (t) {
      tone({ t: t, type: "square", f: 880, dur: 0.1, vol: 0.12 });
      tone({ t: t + 0.14, type: "square", f: 880, dur: 0.1, vol: 0.12 });
    },
    charge: function (t) {
      tone({ t: t, type: "sawtooth", f: 120, f2: 900, glide: "exp", dur: 0.6, vol: 0.1, filter: "bandpass", cutoff: 400, cutoff2: 2400, q: 4 });
    },
    chargeReady: function (t) {
      tone({ t: t, type: "square", f: 1500, dur: 0.07, vol: 0.1 });
      tone({ t: t + 0.06, type: "square", f: 2000, dur: 0.09, vol: 0.09 });
    },
    portal: function (t) {
      tone({ t: t, type: "sine", f: 90, f2: 800, glide: "exp", dur: 0.9, vol: 0.2, filter: "lowpass", cutoff: 500, cutoff2: 4000 });
      noise({ t: t, f: 400, f2: 4000, dur: 0.9, vol: 0.1, q: 1.4 });
    },
    error: function (t) {
      tone({ t: t, type: "square", f: 200, f2: 120, dur: 0.15, vol: 0.14 });
    }
  };

  A.sfx = function (name, opts) {
    if (!A.ready || !SFX[name]) return;
    if (A.ctx.state === "suspended") return;
    var now = A.ctx.currentTime;
    // rate-limit identical sfx to avoid mud
    var last = A._lastSfx[name] || 0;
    var minGap = (opts && opts.gap !== undefined) ? opts.gap : 0.035;
    if (now - last < minGap) return;
    A._lastSfx[name] = now;
    try { SFX[name](now + 0.001); } catch (e) { }
  };

  // ---------------- MUSIC ----------------
  // note: scale degrees -> midi. Aeolian / phrygian flavors.
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  var TRACKS = {
    menu: {
      bpm: 82, root: 45,
      scale: [0, 3, 5, 7, 10, 12, 15],
      bass: [0, null, null, null, 0, null, 3, null, 5, null, null, null, 3, null, null, null],
      lead: [12, null, 15, null, 14, null, 12, null, 10, null, 12, null, null, 7, null, null],
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      leadType: "triangle", bassType: "sawtooth", vol: 0.5
    },
    combat: {
      bpm: 146, root: 41,
      bass: [0, 0, null, 0, null, 0, 3, null, 5, 5, null, 5, 3, null, 0, null],
      lead: [12, null, 12, 15, null, 14, null, 12, 10, null, 10, 12, null, 15, null, 17],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      hat: [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      leadType: "square", bassType: "sawtooth", vol: 0.55
    },
    boss: {
      bpm: 162, root: 38,
      bass: [0, 0, 1, 0, 0, 1, 0, 0, 5, 5, 3, 3, 1, 1, 0, 0],
      lead: [15, 14, 15, 17, null, 19, 17, 15, 14, null, 12, 14, 15, null, 19, 20],
      kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
      hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
      leadType: "sawtooth", bassType: "square", vol: 0.6
    },
    victory: {
      bpm: 118, root: 48,
      bass: [0, null, null, 7, null, null, 5, null, 3, null, null, 7, null, null, null, null],
      lead: [12, 16, 19, 24, null, 19, null, 16, 17, 21, 24, null, null, null, null, null],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      leadType: "triangle", bassType: "triangle", vol: 0.5
    }
  };

  A.currentTrack = null;

  A.music = function (name) {
    if (!A.ready) return;
    if (A.currentTrack === name) return;
    A.currentTrack = name;
    A._track = TRACKS[name] || null;
    A._step = 0;
    A._nextNote = A.ctx.currentTime + 0.06;
    if (!A._timer) {
      A._timer = setInterval(scheduler, 26);
    }
  };
  A.stopMusic = function () {
    A.currentTrack = null; A._track = null;
    if (A._timer) { clearInterval(A._timer); A._timer = null; }
  };

  function scheduler() {
    if (!A.ready || !A._track || A.ctx.state !== "running") return;
    var t = A._track;
    var spb = 60 / t.bpm / 4; // 16th
    var horizon = A.ctx.currentTime + 0.14;
    var guard = 0;
    while (A._nextNote < horizon && guard++ < 32) {
      playStep(t, A._step % 16, A._nextNote);
      A._step++;
      A._nextNote += spb;
    }
    if (A._nextNote < A.ctx.currentTime) A._nextNote = A.ctx.currentTime + 0.02;
  }

  function playStep(t, i, when) {
    var g = A.musicGain, v = t.vol;
    var b = t.bass[i];
    if (b !== null && b !== undefined) {
      tone({ t: when, type: t.bassType, f: midi(t.root + b), dur: 0.16, vol: 0.20 * v, dest: g, filter: "lowpass", cutoff: 900, q: 2, r: 0.1 });
      tone({ t: when, type: "sine", f: midi(t.root + b - 12), dur: 0.2, vol: 0.18 * v, dest: g, r: 0.12 });
    }
    var l = t.lead[i];
    if (l !== null && l !== undefined) {
      tone({ t: when, type: t.leadType, f: midi(t.root + 12 + l), dur: 0.1, vol: 0.075 * v, dest: g, filter: "lowpass", cutoff: 2600, r: 0.14 });
      tone({ t: when + 0.055, type: t.leadType, f: midi(t.root + 12 + l), dur: 0.07, vol: 0.035 * v, dest: g, filter: "lowpass", cutoff: 2200, r: 0.12 });
    }
    if (t.kick[i]) {
      tone({ t: when, type: "sine", f: 150, f2: 42, glide: "exp", dur: 0.14, vol: 0.4 * v, dest: g, a: 0.002, r: 0.1 });
    }
    if (t.snare[i]) {
      noise({ t: when, filter: "highpass", f: 1400, dur: 0.11, vol: 0.16 * v, dest: g, r: 0.09 });
      tone({ t: when, type: "triangle", f: 220, f2: 140, dur: 0.08, vol: 0.09 * v, dest: g });
    }
    if (t.hat[i]) {
      noise({ t: when, filter: "highpass", f: 7000, dur: 0.035, vol: 0.05 * v, dest: g, r: 0.03 });
    }
  }

  // ---------------- haptics ----------------
  // Browsers reject vibrate() until the user has actually touched the page,
  // so we gate it on a real gesture to keep the console clean.
  A.userGesture = false;
  A.markGesture = function () { A.userGesture = true; };
  A.vibrate = function (pattern) {
    if (!A.userGesture) return;
    if (!Save.data.settings.vibrate) return;
    if (!navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { }
  };

  NS.Audio = A;
})(window.NS);
