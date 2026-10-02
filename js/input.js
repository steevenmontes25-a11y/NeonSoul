/* ============================================================
   NEON SOUL - input.js
   Keyboard + mouse + multitouch (floating joystick & action pads)
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U;

  var I = {
    // analog move vector (-1..1)
    mx: 0, my: 0,
    // aim direction (unit vector); 0,0 = auto aim
    aimX: 0, aimY: 0, hasAim: false,
    // held
    attack: false,
    // edge triggers (consumed each frame)
    attackPressed: false, dashPressed: false, abilityPressed: false,
    shiftPressed: false, pausePressed: false, anyPressed: false,
    // meta
    touchMode: false, pointerX: 0, pointerY: 0, hasPointer: false,
    keys: {}
  };

  var joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false, radius: 56 };
  var btnTouch = {};      // touchId -> button name
  var els = {};

  var KEYMAP = {
    KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
    Space: "ability", ShiftLeft: "shift", ShiftRight: "shift",
    KeyJ: "attack", KeyZ: "attack", Enter: "attack",
    KeyK: "dash", KeyX: "dash", ControlLeft: "dash", ControlRight: "dash",
    Escape: "pause", KeyP: "pause"
  };

  I.init = function () {
    els.canvas = U.$("game-canvas");
    els.tc = U.$("touch-controls");
    els.joyBase = U.$("joystick-base");
    els.joyKnob = U.$("joystick-knob");
    els.joyZone = U.$("joystick-zone");

    bindKeyboard();
    bindMouse();
    bindTouch();
    detectTouch();
    return I;
  };

  function detectTouch() {
    var coarse = window.matchMedia && window.matchMedia("(pointer:coarse)").matches;
    var hasTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    I.touchMode = !!(coarse || (hasTouch && window.innerWidth < 1100));
  }
  I.setTouchMode = function (on) { I.touchMode = !!on; };

  // ---------------- keyboard ----------------
  function bindKeyboard() {
    U.on(window, "keydown", function (e) {
      var a = KEYMAP[e.code];
      if (!a) return;
      if (e.repeat) { e.preventDefault(); return; }
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) >= 0) e.preventDefault();
      I.keys[a] = true;
      I.anyPressed = true;
      if (a === "attack") { I.attack = true; I.attackPressed = true; }
      if (a === "dash") I.dashPressed = true;
      if (a === "ability") I.abilityPressed = true;
      if (a === "shift") I.shiftPressed = true;
      if (a === "pause") I.pausePressed = true;
      NS.Audio.resume();
    });
    U.on(window, "keyup", function (e) {
      var a = KEYMAP[e.code];
      if (!a) return;
      I.keys[a] = false;
      if (a === "attack") I.attack = false;
    });
    U.on(window, "blur", function () {
      I.keys = {}; I.attack = false; I.mx = I.my = 0;
      joy.active = false; joy.id = null; updateJoyVisual();
    });
  }

  // ---------------- mouse ----------------
  function bindMouse() {
    var c = els.canvas;
    U.on(window, "mousemove", function (e) {
      I.pointerX = e.clientX; I.pointerY = e.clientY; I.hasPointer = true;
    });
    U.on(c, "mousedown", function (e) {
      if (e.button === 0) { I.attack = true; I.attackPressed = true; }
      if (e.button === 2) { I.dashPressed = true; }
      I.anyPressed = true;
      NS.Audio.resume();
      e.preventDefault();
    });
    U.on(window, "mouseup", function (e) {
      if (e.button === 0) I.attack = false;
    });
    U.on(c, "contextmenu", function (e) { e.preventDefault(); });
  }

  // ---------------- touch ----------------
  function bindTouch() {
    var zone = els.joyZone;
    if (zone) {
      U.on(zone, "touchstart", function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (joy.id === null) {
            joy.id = t.identifier;
            joy.ox = t.clientX; joy.oy = t.clientY;
            joy.x = 0; joy.y = 0; joy.active = true;
            joy.radius = Math.max(42, Math.min(72, window.innerHeight * 0.09));
            updateJoyVisual();
          }
        }
        I.touchMode = true;
        NS.Audio.resume();
        e.preventDefault();
      }, { passive: false });

      U.on(zone, "touchmove", function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier === joy.id) {
            var dx = t.clientX - joy.ox, dy = t.clientY - joy.oy;
            var m = Math.hypot(dx, dy);
            var R = joy.radius;
            if (m > R) { dx = dx / m * R; dy = dy / m * R; }
            joy.x = dx; joy.y = dy;
            // dead zone
            var mag = Math.hypot(dx, dy) / R;
            if (mag < 0.18) { I.mx = 0; I.my = 0; }
            else {
              var n = U.norm(dx, dy);
              var sc = Math.min(1, (mag - 0.18) / 0.62);
              I.mx = n.x * sc; I.my = n.y * sc;
            }
            updateJoyVisual();
          }
        }
        e.preventDefault();
      }, { passive: false });

      var endJoy = function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joy.id) {
            joy.id = null; joy.active = false; joy.x = joy.y = 0;
            I.mx = 0; I.my = 0;
            updateJoyVisual();
          }
        }
      };
      U.on(zone, "touchend", endJoy, { passive: false });
      U.on(zone, "touchcancel", endJoy, { passive: false });
    }

    bindPad("tb-attack", "attack");
    bindPad("tb-dash", "dash");
    bindPad("tb-ability", "ability");
    bindPad("tb-shift", "shift");

    // stop page-level gestures during play
    U.on(document, "touchmove", function (e) {
      if (NS.Game && NS.Game.state === "playing") e.preventDefault();
    }, { passive: false });
    U.on(document, "gesturestart", function (e) { e.preventDefault(); });
  }

  function bindPad(id, action) {
    var el = U.$(id);
    if (!el) return;
    els[action] = el;
    U.on(el, "touchstart", function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) btnTouch[e.changedTouches[i].identifier] = action;
      press(action, true);
      el.classList.add("pressed");
      I.touchMode = true;
      NS.Audio.resume();
      e.preventDefault();
    }, { passive: false });
    var end = function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var id2 = e.changedTouches[i].identifier;
        if (btnTouch[id2] === action) {
          delete btnTouch[id2];
          press(action, false);
          el.classList.remove("pressed");
        }
      }
      e.preventDefault();
    };
    U.on(el, "touchend", end, { passive: false });
    U.on(el, "touchcancel", end, { passive: false });
    // mouse fallback so buttons work when testing touch UI on desktop
    U.on(el, "mousedown", function (e) { press(action, true); el.classList.add("pressed"); NS.Audio.resume(); e.preventDefault(); });
    U.on(window, "mouseup", function () { if (el.classList.contains("pressed")) { press(action, false); el.classList.remove("pressed"); } });
  }

  function press(action, down) {
    I.anyPressed = I.anyPressed || down;
    if (action === "attack") { I.attack = down; if (down) I.attackPressed = true; }
    else if (down) {
      if (action === "dash") I.dashPressed = true;
      else if (action === "ability") I.abilityPressed = true;
      else if (action === "shift") I.shiftPressed = true;
    }
  }

  function updateJoyVisual() {
    var b = els.joyBase, k = els.joyKnob;
    if (!b) return;
    if (joy.active) {
      b.classList.add("on");
      b.style.left = joy.ox + "px";
      b.style.top = joy.oy + "px";
      b.style.width = (joy.radius * 2) + "px";
      b.style.height = (joy.radius * 2) + "px";
      if (k) k.style.transform = "translate(-50%,-50%) translate(" + joy.x + "px," + joy.y + "px)";
    } else {
      b.classList.remove("on");
      b.style.left = "-999px";
      if (k) k.style.transform = "translate(-50%,-50%)";
    }
  }

  // ---------------- per-frame ----------------
  I.update = function () {
    // keyboard movement overrides joystick when used
    var kx = (I.keys.right ? 1 : 0) - (I.keys.left ? 1 : 0);
    var ky = (I.keys.down ? 1 : 0) - (I.keys.up ? 1 : 0);
    if (kx || ky) {
      var n = U.norm(kx, ky);
      I.mx = n.x; I.my = n.y;
    } else if (!joy.active) {
      if (!joy.active && (I.mx || I.my) && !I.touchMode) { I.mx = 0; I.my = 0; }
    }

    // aim from mouse pointer when available and not in touch mode
    I.hasAim = false;
    if (I.hasPointer && !I.touchMode && NS.Render && NS.Render.screenToWorld && NS.Game && NS.Game.player) {
      var w = NS.Render.screenToWorld(I.pointerX, I.pointerY);
      var p = NS.Game.player;
      var d = U.norm(w.x - p.x, w.y - p.y);
      if (d.m > 4) { I.aimX = d.x; I.aimY = d.y; I.hasAim = true; }
    }
  };

  I.endFrame = function () {
    I.attackPressed = false;
    I.dashPressed = false;
    I.abilityPressed = false;
    I.shiftPressed = false;
    I.pausePressed = false;
    I.anyPressed = false;
  };

  I.releaseAll = function () {
    I.attack = false; I.mx = 0; I.my = 0;
    I.keys = {};
    joy.id = null; joy.active = false; updateJoyVisual();
    btnTouch = {};
    ["attack", "dash", "ability", "shift"].forEach(function (a) {
      if (els[a]) els[a].classList.remove("pressed");
    });
  };

  I.showTouch = function (on) {
    if (!els.tc) return;
    els.tc.classList.toggle("hidden", !on);
  };

  NS.Input = I;
})(window.NS);
