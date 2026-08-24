/* Formula Runner 2.0 — landing page behaviour.
   One signature moment: a live night circuit rendered in a single fragment shader
   behind the headline. Everything else is quiet supporting work. */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ *
   * Signature: the circuit
   * ------------------------------------------------------------------ */

  var VERT = [
    "attribute vec2 aPos;",
    "void main() { gl_Position = vec4(aPos, 0.0, 1.0); }"
  ].join("\n");

  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes;",
    "uniform float uRoad;",   // metres travelled, wrapped
    "uniform float uSky;",    // unused clock, kept for future drift
    "uniform float uGrain;",
    "uniform float uLean;",   // -1..1 pointer lean

    "const vec3 NEON = vec3(0.0, 0.898, 1.0);",
    "const float HY = 0.085;",       // horizon, just above centre
    "const float HALF = 7.2;",       // 4 lanes x 3.6 m, halved
    "const float LANE = 3.6;",
    "const float TAU = 6.2831853;",
    "const float WRAP = 5460.0;",    // divisible by both the dash and pole periods

    "float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",

    "void main() {",
    "  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;",
    "  float px = 1.0 / uRes.y;",
    "  vec3 col;",

    "  if (p.y > HY) {",
    // Bare night sky over a lit horizon: exactly what the game shows.
    "    float k = p.y - HY;",
    "    col = mix(vec3(0.022, 0.049, 0.082), vec3(0.006, 0.013, 0.026), smoothstep(0.0, 0.40, k));",
    "    col += NEON * 0.185 * exp(-k * 34.0);",
    "    col += NEON * 0.085 * exp(-abs(p.x) * 3.2) * exp(-k * 11.0);",
    "  } else {",
    "    float d = 1.0 / (HY - p.y);",              // depth: ~1.7 at the bottom edge, huge at the horizon
    "    float z = d * 2.2 + uRoad;",
    "    float curve = sin(z * TAU * 7.0 / WRAP) * 0.35 + sin(z * TAU * 3.0 / WRAP) * 0.6;",
    "    float x = p.x * d * 2.45 + curve + uLean * 0.55;",
    "    float pxx = d * 2.45 * px;",               // world metres per pixel, across
    "    float ax = abs(x);",

    "    float pool = exp(-pow(fract(z / 26.0) - 0.5, 2.0) * 30.0);",  // light spilled by the poles
    "    float onRoad = 1.0 - smoothstep(HALF - pxx, HALF + pxx, ax);",

    "    vec3 road = mix(vec3(0.030, 0.046, 0.066), vec3(0.055, 0.082, 0.112), pool);",
    "    road += NEON * 0.045 * pool;",
    "    vec3 off = vec3(0.008, 0.014, 0.024);",
    "    col = mix(off, road, onRoad);",

    "    float barrier = smoothstep(HALF + 0.2, HALF + 0.5, ax) * (1.0 - smoothstep(HALF + 2.0, HALF + 3.2, ax));",
    "    col = mix(col, vec3(0.026, 0.042, 0.062), barrier * 0.5);",

    "    float dash = step(fract(z / 8.4), 0.42);",
    "    float lane = min(abs(ax - LANE), ax);",
    "    float lw = max(0.09, pxx * 0.9);",
    "    float mark = (1.0 - smoothstep(lw, lw + pxx * 1.8, lane)) * dash * onRoad;",
    "    col = mix(col, vec3(0.80, 0.89, 0.97), mark * 0.92);",

    // Fog first, so the surface dissolves toward the horizon...
    "    vec3 haze = vec3(0.010, 0.022, 0.040) + NEON * 0.05;",
    "    col = mix(haze, col, exp(-(d - 1.6) * 0.055));",

    // ...then the rails on top, which stay legible all the way to the vanishing point.
    "    float rail = abs(ax - HALF);",
    "    float rw = max(0.07, pxx * 0.8);",
    "    float core = 1.0 - smoothstep(rw, rw + pxx * 2.2, rail);",
    "    float halo = exp(-pow(rail / 0.8, 2.0));",
    "    col += NEON * (core * 0.92 + halo * 0.16) * (0.30 + 0.70 * exp(-(d - 1.6) * 0.018));",
    "  }",

    "  col *= 1.0 - 0.34 * pow(length(p * vec2(0.6, 1.0)), 2.2);",
    "  col += (hash2(gl_FragCoord.xy + uGrain) - 0.5) * 0.026;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function circuit(canvas) {
    var gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" }) ||
      canvas.getContext("experimental-webgl");
    if (!gl) return null;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var u = {
      res: gl.getUniformLocation(prog, "uRes"),
      road: gl.getUniformLocation(prog, "uRoad"),
      sky: gl.getUniformLocation(prog, "uSky"),
      grain: gl.getUniformLocation(prog, "uGrain"),
      lean: gl.getUniformLocation(prog, "uLean")
    };

    var dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(u.res, canvas.width, canvas.height);
    }

    var road = 0;
    var sky = 0;
    var lean = 0;
    var leanTarget = 0;
    var speed = 34;          // metres per second, base cruise
    var speedTarget = 34;
    var running = false;
    var last = 0;
    var frame = 0;

    function draw() {
      gl.uniform1f(u.road, road);
      gl.uniform1f(u.sky, sky);
      gl.uniform1f(u.lean, lean);
      gl.uniform1f(u.grain, Math.random() * 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function tick(now) {
      if (!running) return;
      var dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      speed += (speedTarget - speed) * Math.min(1, dt * 3.2);
      lean += (leanTarget - lean) * Math.min(1, dt * 2.4);
      road = (road + speed * dt) % 5460;
      sky += dt;
      resize();
      draw();
      frame = requestAnimationFrame(tick);
    }

    resize();
    draw();

    return {
      start: function () {
        if (running || reduced) return;
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(tick);
      },
      stop: function () {
        running = false;
        cancelAnimationFrame(frame);
      },
      boost: function (on) { speedTarget = on ? 78 : 34; },
      lean: function (v) { leanTarget = v; },
      resize: function () { resize(); if (!running) draw(); }
    };
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  var canvas = document.getElementById("circuit-canvas");
  var scene = canvas ? circuit(canvas) : null;
  if (!scene && canvas) canvas.style.display = "none";

  var hero = document.querySelector(".hero");
  if (scene && hero) {
    // The hero's intersection state does not change while the tab is hidden, so the
    // observer will not fire on return. Track it and gate the restart on both.
    var heroVisible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          heroVisible = e.isIntersecting;
          heroVisible ? scene.start() : scene.stop();
        });
      }, { rootMargin: "120px" }).observe(hero);
    } else {
      scene.start();
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden || !heroVisible) scene.stop();
      else scene.start();
    });

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(scene.resize, 120);
    });

    if (!reduced && window.matchMedia("(pointer: fine)").matches) {
      hero.addEventListener("pointermove", function (e) {
        scene.lean((e.clientX / window.innerWidth) * 2 - 1);
      });
      hero.addEventListener("pointerleave", function () { scene.lean(0); });
    }
  }

  // Hovering "Play" opens the throttle. The one interaction the page rewards.
  var play = document.querySelector("[data-throttle]");
  if (play && scene && !reduced) {
    ["pointerenter", "focus"].forEach(function (ev) {
      play.addEventListener(ev, function () { scene.boost(true); });
    });
    ["pointerleave", "blur"].forEach(function (ev) {
      play.addEventListener(ev, function () { scene.boost(false); });
    });
  }

  // Magnetic pull on the primary call to action.
  if (play && !reduced && window.matchMedia("(pointer: fine)").matches) {
    play.addEventListener("pointermove", function (e) {
      var r = play.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2);
      var dy = e.clientY - (r.top + r.height / 2);
      play.style.transform = "translate(" + dx * 0.16 + "px," + dy * 0.24 + "px)";
    });
    play.addEventListener("pointerleave", function () { play.style.transform = ""; });
  }

  // Nav gets a backing once the hero starts scrolling away.
  var nav = document.querySelector(".nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("is-stuck", window.scrollY > 40); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Staggered reveals.
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    reveals.forEach(function (el, i) {
      var group = el.parentElement;
      var index = group ? [].indexOf.call(group.children, el) : i;
      el.style.setProperty("--d", Math.min(index, 5) * 80 + "ms");
      io.observe(el);
    });
    var pending = reveals.length;
    var ticking = false;
    var sweep = function () {
      ticking = false;
      var left = 0;
      reveals.forEach(function (el) {
        if (el.classList.contains("is-visible")) return;
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add("is-visible");
          io.unobserve(el);
        } else {
          left++;
        }
      });
      pending = left;
      if (!pending) window.removeEventListener("scroll", onMove);
    };
    var onMove = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sweep);
    };
    window.addEventListener("scroll", onMove, { passive: true });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // Entrance: canvas, then headline lines, then the rest.
  var seq = [
    [".hero .kicker", 700],
    [".hero .lead", 1080],
    [".hero-actions", 1200],
    [".hero-meta", 1320],
    [".nav", 1440],
    [".scroll-cue", 1560]
  ];
  document.querySelectorAll(".hero h1 .line > span").forEach(function (el, i) {
    el.style.setProperty("--d", 260 + i * 90 + "ms");
  });
  seq.forEach(function (pair) {
    var el = document.querySelector(pair[0]);
    if (el) el.style.setProperty("--d", pair[1] + "ms");
  });
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { document.body.classList.add("is-in"); });
  });

  // Current year in the footer.
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
