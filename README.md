# NEON SOUL

Roguelite de acción arcade cyberpunk. HTML5 Canvas 2D + Web Audio API.
**Cero dependencias, cero assets binarios externos**: los gráficos son vectoriales
procedurales, la música y los efectos se sintetizan en tiempo real y los iconos se
generan con un script de Node.

---

## 1. Abrirlo en local

### Opción A — doble clic (lo más rápido)
Abre `index.html` en Chrome, Edge o Firefox. El juego funciona completo
(todos los scripts son clásicos, no módulos ES, así que no hay problemas de CORS).

> Nota: con `file://` algunos navegadores restringen `localStorage`. Si el progreso no
> se guarda, usa la opción B. El Service Worker (modo offline) tampoco se registra
> en `file://` — es normal y está contemplado en el código.

### Opción B — servidor local (recomendado, necesario para PWA)

```bash
cd neon-soul
python -m http.server 8181
```

o, si prefieres Node:

```bash
npx --yes serve neon-soul -l 8181
```

Luego abre `http://localhost:8181`.

En la primera pantalla hay que **tocar “TOCA PARA ENTRAR”**: los navegadores exigen
un gesto del usuario antes de arrancar el audio.

---

## 2. Instalarlo como PWA

1. Sírvelo por HTTP/HTTPS (opción B, o súbelo a cualquier hosting estático:
   GitHub Pages, Netlify, Vercel, Cloudflare Pages…).
2. En Chrome/Edge de escritorio: icono de instalación en la barra de direcciones.
3. En Android: menú ⋮ → **Instalar aplicación / Añadir a pantalla de inicio**.
4. En iOS: Compartir → **Añadir a pantalla de inicio**.

Se instala a pantalla completa, funciona sin conexión (`sw.js` cachea todo el
app-shell) y guarda el progreso en `localStorage`.

Al publicar una versión nueva, sube el número de versión en `sw.js`:

```js
var CACHE = "neon-soul-v1.0.1";   // <- cambia esto y los clientes se actualizan
```

---

## 3. Generar el APK de Android con Capacitor

Requisitos: **Node 18+**, **JDK 17** y **Android Studio** (con el SDK de Android y las
variables `ANDROID_HOME` / `JAVA_HOME` configuradas).

### Comandos exactos

```bash
cd neon-soul
npm install
npm run build
npx cap init "NEON SOUL" com.neonsoul.game --web-dir www
npx cap add android
npx cap sync android
npx cap open android
```

`npm run build` copia el juego a `www/` (que es el `webDir` declarado en
`capacitor.config.json`). El fichero `capacitor.config.json` ya viene escrito, así que
si el paso `cap init` te pregunta, puedes saltártelo directamente:

```bash
cd neon-soul
npm install
npm run cap:add:android
npm run cap:open
```

### APK de depuración (sin Android Studio)

```bash
cd neon-soul
npm run build
npx cap sync android
cd android
gradlew.bat assembleDebug
```

APK resultante:
`android/app/build/outputs/apk/debug/app-debug.apk`

En Linux/macOS usa `./gradlew assembleDebug`.

### APK / AAB de release firmado

1. Crea el keystore (una sola vez):

```bash
keytool -genkey -v -keystore neonsoul.keystore -alias neonsoul -keyalg RSA -keysize 2048 -validity 10000
```

2. Añade en `android/key.properties`:

```properties
storeFile=../neonsoul.keystore
storePassword=TU_PASSWORD
keyAlias=neonsoul
keyPassword=TU_PASSWORD
```

3. Compila:

```bash
cd android
gradlew.bat assembleRelease      # APK  -> app/build/outputs/apk/release/
gradlew.bat bundleRelease        # AAB  -> app/build/outputs/bundle/release/
```

### Ajustes recomendados dentro de Android Studio
- `AndroidManifest.xml`: `android:screenOrientation="fullUser"` para permitir las dos
  orientaciones (el juego se adapta solo).
- Los iconos de la app se generan desde `assets/icons/icon-512.png`
  (Android Studio → *Image Asset*).

---

## 4. Estructura del proyecto

```
neon-soul/
├── index.html              # shell de la app: canvas, HUD, todas las pantallas
├── manifest.json           # PWA
├── sw.js                   # service worker (offline)
├── capacitor.config.json   # configuración de Capacitor
├── package.json            # scripts de build
├── css/
│   ├── style.css           # variables, base, botones, toasts
│   ├── menu.css            # menú, paneles, tienda, cartas de mejora, mapa
│   └── game.css            # HUD y controles táctiles
├── js/
│   ├── utils.js            # matemáticas, RNG con semilla, pools, helpers DOM
│   ├── storage.js          # guardado en localStorage, monedas, XP, niveles
│   ├── audio.js            # sintetizador de SFX + secuenciador musical
│   ├── input.js            # teclado, ratón, joystick virtual, botones táctiles
│   ├── particles.js        # sistema de partículas con pooling
│   ├── characters.js       # 4 personajes: stats, habilidad, Soul Shift, arte
│   ├── upgrades.js         # 54 mejoras de partida + sinergias
│   ├── levels.js           # 5 zonas: paleta, enemigos, peligros, jefe
│   ├── combat.js           # daño, proyectiles, elementos, MARCAS DE ALMA
│   ├── enemies.js          # 10 arquetipos de enemigo + modificador élite
│   ├── boss.js             # 5 jefes con fases y patrones
│   ├── procedural.js       # generación de mapa, salas y oleadas
│   ├── player.js           # jugador, Soul Shift, esquiva, habilidades
│   ├── meta.js             # árbol de mejoras permanentes (fragmentos)
│   ├── missions.js         # misiones diarias y permanentes
│   ├── achievements.js     # 27 logros
│   ├── shop.js             # personajes, skins, efectos y mejoras permanentes
│   ├── render.js           # canvas, arena de pantalla única, escenario
│   ├── ui.js               # todas las pantallas y el HUD
│   ├── game.js             # bucle principal, salas, eventos, economía
│   └── main.js             # arranque, requestAnimationFrame, PWA
├── assets/icons/           # iconos PNG generados
└── tools/
    ├── gen-icons.js        # genera los iconos (node tools/gen-icons.js)
    └── build-www.js        # prepara www/ para Capacitor
```

---

## 5. Controles

### PC
| Acción | Tecla |
|---|---|
| Mover | `WASD` / flechas |
| Apuntar | Ratón |
| Atacar | Clic izquierdo · `J` · `Enter` (mantén para carga) |
| Esquivar | Clic derecho · `K` · `Ctrl` |
| Habilidad | `ESPACIO` |
| **Soul Shift** | `SHIFT` |
| Pausa | `ESC` / `P` |

### Móvil
Joystick flotante a la izquierda (aparece donde pongas el pulgar) y cuatro botones a
la derecha: **atacar** (grande), **esquivar**, **habilidad** y **Soul Shift**.
El joystick puede moverse al lado derecho desde *Configuración*.

---

## 6. La mecánica: SOUL SHIFT

Dos estados que se alternan con un botón:

| | ALMA | FURIA |
|---|---|---|
| Velocidad | +45% (más según personaje) | normal |
| Daño | **mitad** | +55% (más según personaje) |
| Al golpear | aplica **MARCAS** (hasta 10) | **DETONA** las marcas |
| Recurso | gasta alma | regenera alma al hacer daño |

El bucle: entras en **ALMA** para esquivar entre balas y llenar de marcas a todo el
mundo → cambias a **FURIA** y cada impacto revienta las marcas en cadena con daño en
área. Además, **cada cambio genera una onda expansiva** que daña, empuja y anula las
balas enemigas cercanas: cambiar de estado es también un botón defensivo.

Si el alma llega a cero vuelves a FURIA automáticamente, así que hay que administrarla.

---

## 7. Dónde tocar cada cosa

| Quiero cambiar… | Fichero | Qué editar |
|---|---|---|
| **Personajes** | `js/characters.js` | Array `list`. Cada entrada define `stats` (vida, velocidad, daño, cadencia, alma…), `ability` (habilidad de ESPACIO), `mods` (cómo se comporta su Soul Shift: `markPerHit`, `detoMult`, `soulSpeed`, `furyDmg`, `shiftCost`), `price` y `unlock(save)`. El dibujo vectorial está en `NS.Chars.draw`. La lógica de cada habilidad está en `Player.prototype.tryAbility` (`js/player.js`), seleccionada por `ch.id`. |
| **Enemigos** | `js/enemies.js` | Objeto `TYPES`. Cada tipo es `{ hp, speed, r, dmg, color, xp, coin, init(e), ai(e,dt,p), draw(ctx,e,t) }`. Para añadir uno nuevo basta con crear la entrada y meter su clave en el pool de alguna zona de `levels.js`. El coste para el presupuesto de oleadas está en `COST` (`js/procedural.js`). |
| **Jefes** | `js/boss.js` | Objeto `BOSSES`. Cada jefe define `hp`, `phases` (fracciones de vida que disparan cada fase), `patterns` (cada patrón tiene `dur`, `cd`, `minP` y callbacks `start/tick/end`), `onPhase` y `draw`. Se asigna a una zona con `zone.boss` en `levels.js`. |
| **Mapas / zonas** | `js/levels.js` | Array `zones`: `palette` (colores), `enemies` / `lateEnemies`, `hazards`, `rooms` (número de salas), `boss` y los multiplicadores `hpMul` / `dmgMul` / `spawnMul`. Las zonas más allá de la 5 se generan solas (modo Sobrecarga) en `L.get`. |
| **Salas y generación** | `js/procedural.js` | `buildZoneMap` decide los nodos de cada paso, `makeRoom` coloca obstáculos y `makeWaves` compone las oleadas con un presupuesto de dificultad. |
| **Mejoras de partida** | `js/upgrades.js` | Array `LIST`: `{ id, name, desc, icon, rarity, tags, max, req(p), apply(p) }`. `apply` modifica `p.s` (los multiplicadores del jugador) o `p.flags` (comportamientos especiales). Las rarezas y sus pesos están en `RAR`. |
| **Mejoras permanentes** | `js/meta.js` | Array `NODES` (coste en fragmentos, máximo de niveles y bonus por nivel) y `M.bonus()`, que es lo que se inyecta al crear el jugador. |
| **Economía** | `js/storage.js` (XP y nivel), `js/shop.js` (precios de personajes, skins, efectos y mejoras permanentes), `js/game.js` → `endRun()` (cuánto conservas al morir: `keep`), `dropLoot()` (qué sueltan los enemigos) y `openRunShop()` (precios del contrabandista de partida). |
| **Dificultad** | `js/levels.js` → `hpMul`/`dmgMul`/`spawnMul` por zona y `L.curve(zone, roomIdx)` (curva global). `js/procedural.js` → `makeWaves` (presupuesto `budget`). `js/player.js` → `CHARGE_TIME`, multiplicadores de estado en `stateDmgMul`/`stateSpeedMul`. `js/combat.js` → el `0.55` de `C.detonate` controla el daño por marca. |
| **Audio** | `js/audio.js` | `SFX` (cada efecto es una función que programa osciladores) y `TRACKS` (patrones de 16 pasos: `bass`, `lead`, `kick`, `hat`, `snare`, `bpm`, `root`). |
| **Rendimiento** | `js/particles.js` (`setQuality`, `max`), `js/render.js` (`qualityDpr`, `SHORT` = tamaño del mundo visible). |

---

## 8. Contenido incluido

- **4 personajes** (3 desbloqueables jugando) con habilidad y Soul Shift propios.
- **10 tipos de enemigo** + variante **élite** con aura dorada y ataques extra.
- **5 jefes** con 3–4 fases, patrones telegrafiados, barra de vida y recompensas.
- **5 zonas** + modo **Sobrecarga** infinito al superar el Nexus Core.
- **54 mejoras** de partida con sinergias (fuego, rayo, hielo, multidisparo, marcas,
  orbitales, críticos…).
- **10 mejoras permanentes** en el Núcleo del Alma.
- **Tienda** con 8 skins, 5 estelas y 7 mejoras permanentes — todo con moneda del juego.
- **Misiones** diarias (rotan cada día) y permanentes.
- **27 logros** con recompensas.
- Eventos con decisiones, santuarios, reliquias, contrabandista y emboscadas.

## 9. Guardado

Todo se guarda en `localStorage` bajo la clave `neonsoul_save_v1`:
progreso, monedas, fragmentos, nivel, personajes, skins, mejoras permanentes,
récords, estadísticas, misiones, logros y configuración.

Para borrarlo: **Configuración → BORRAR PROGRESO (RESET SAVE)** (pide confirmación
pulsando dos veces), o desde la consola:

```js
localStorage.removeItem("neonsoul_save_v1"); location.reload();
```
