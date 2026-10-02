/* ============================================================
   NEON SOUL - main.js
   Bootstrap, main loop, lifecycle, PWA registration
   ============================================================ */
(function (NS) {
  "use strict";
  var U = NS.U;

  var TIPS = [
    "Cargando el núcleo del Nexus...",
    "En ALMA marcas. En FURIA detonas.",
    "Mantén ATAQUE para cargar un disparo pesado.",
    "El Soul Shift genera una onda que anula balas cercanas.",
    "Las sinergias aparecen cuando combinas mejoras del mismo tipo.",
    "Los élites sueltan fragmentos: sirven para mejoras permanentes."
  ];

  var last = 0, acc = 0, frames = 0, fpsT = 0, rafId = 0;

  function boot() {
    NS.Save.load();
    NS.Render.init();
    NS.Input.init();
    NS.UI.init();
    NS.Missions.ensure();
    NS.Game.recomputeArena();

    var fill = U.$("boot-fill"), tip = U.$("boot-tip"), btn = U.$("btn-boot");
    var pct = 0;
    var iv = setInterval(function () {
      pct += U.rand(8, 22);
      if (pct > 100) pct = 100;
      fill.style.width = pct + "%";
      tip.textContent = TIPS[Math.min(TIPS.length - 1, Math.floor(pct / 100 * TIPS.length))];
      if (pct >= 100) {
        clearInterval(iv);
        btn.classList.remove("hidden");
        tip.textContent = "Listo. Toca para activar el sonido y jugar.";
      }
    }, 110);

    var entered = false;
    function enter() {
      if (entered) return;
      entered = true;
      NS.Audio.init();
      NS.Audio.resume();
      NS.Audio.applyVolumes();
      NS.Game.toMenu();
      NS.Ach.check();
    }
    U.on(btn, "click", enter);
    U.on(U.$("screen-boot"), "click", function () { if (!btn.classList.contains("hidden")) enter(); });
    U.on(window, "keydown", function (e) {
      if (!entered && !btn.classList.contains("hidden")) enter();
    });

    ["pointerdown", "touchstart", "keydown"].forEach(function (ev) {
      U.on(window, ev, function () { NS.Audio.markGesture(); }, { passive: true });
    });

    // lifecycle
    U.on(document, "visibilitychange", function () {
      if (document.hidden) {
        if (NS.Game.state === "playing") NS.Game.togglePause();
        NS.Audio.suspendAll();
      } else {
        NS.Audio.resume();
      }
    });
    U.on(window, "contextmenu", function (e) {
      if (e.target && e.target.id === "game-canvas") e.preventDefault();
    });

    last = performance.now();
    rafId = requestAnimationFrame(loop);
    registerSW();
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.12) dt = 0.12;      // long stalls (tab switch) must not teleport anything
    if (dt <= 0) dt = 1 / 60;

    try {
      NS.Game.update(dt);
      NS.Render.draw(NS.Game, dt);
      if (NS.Game.player && NS.Game.state !== "menu") NS.UI.hud(NS.Game, dt);
    } catch (err) {
      // never let one bad frame kill the game loop
      if (!window.__nsErrLogged) { window.__nsErrLogged = true; console.error("NEON SOUL:", err); }
    }

    frames++;
    fpsT += dt;
    if (fpsT >= 0.5) {
      NS.UI.fps(Math.round(frames / fpsT));
      frames = 0; fpsT = 0;
    }
  }

  function registerSW() {
    if (window.NS_PACKAGED) return;              // inside the APK: assets are already local
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol === "file:") return;   // SW needs http(s)
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else boot();
})(window.NS);
