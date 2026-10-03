/* ============================================================
   scene.js — WebGL layer
   A tunnel of shader planes + wireframe solids + particle field.
   Scroll drives a camera dolly; pointer drives parallax; the
   active section's theme lerps the whole scene between
   dark and light monochrome.
   Exposes: window.PortfolioScene.create(canvas)
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var BG_DARK = 0x08080a;
  var BG_LIGHT = 0xf4f4f1;
  var LINE_DARK = 0xffffff;
  var LINE_LIGHT = 0x141417;

  var PLANE_COUNT = REDUCED ? 26 : 84;
  var PARTICLE_COUNT = REDUCED ? 320 : 1500;
  var TUNNEL_DEPTH = 150;

  var VERT = [
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform float uSeed;',
    'void main(){',
    '  vUv = uv;',
    '  vec3 p = position;',
    '  p.z += sin(uTime * 0.6 + uSeed) * 0.14;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform float uOpacity;',
    'uniform vec3  uColor;',
    'uniform float uSeed;',
    'void main(){',
    '  vec2 uv = vUv;',
    '  vec2 d = abs(uv - 0.5) * 2.0;',
    '  float e = max(d.x, d.y);',
    // outer frame
    '  float frame = smoothstep(0.93, 0.98, e) - smoothstep(0.98, 1.0, e);',
    // inner cross-hair
    '  float cross = 0.0;',
    '  cross += smoothstep(0.007, 0.0, abs(uv.x - 0.5)) * step(abs(uv.y - 0.5), 0.16);',
    '  cross += smoothstep(0.007, 0.0, abs(uv.y - 0.5)) * step(abs(uv.x - 0.5), 0.16);',
    // corner blocks
    '  float tick = step(0.84, uv.x) * step(0.84, uv.y) * (1.0 - smoothstep(0.96, 1.0, e));',
    // travelling scan line
    '  float scan = smoothstep(0.035, 0.0, abs(uv.y - fract(uTime * 0.15 + uSeed)));',
    '  float a = clamp(frame * 0.9 + cross * 0.5 + tick * 0.75 + scan * 0.35, 0.0, 1.0);',
    '  if (a < 0.008) discard;',
    '  gl_FragColor = vec4(uColor, a * uOpacity);',
    '}'
  ].join('\n');

  function create(canvas) {
    if (!window.THREE) return null;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
    } catch (err) {
      return null;
    }
    if (!renderer || !renderer.getContext()) return null;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    var bgColor = new THREE.Color(BG_DARK);
    scene.background = bgColor;
    scene.fog = new THREE.Fog(BG_DARK, 26, TUNNEL_DEPTH + 20);

    var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 420);
    camera.position.set(0, 0, 8);

    // ---- shared uniforms (one object reference shared by all planes) ----
    var uTime = { value: 0 };
    var uColor = { value: new THREE.Color(LINE_DARK) };

    // ---- shader plane field --------------------------------------
    var planeGeo = new THREE.PlaneGeometry(1, 1);
    var field = new THREE.Group();
    scene.add(field);
    var floaters = [];

    for (var i = 0; i < PLANE_COUNT; i++) {
      var t = i / PLANE_COUNT;
      var angle = (i * 2.399963) % (Math.PI * 2); // golden-angle spiral
      var radius = 3.2 + Math.random() * 8.5;
      var scale = 0.55 + Math.random() * 2.6;

      var mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: uTime,
          uColor: uColor,
          uOpacity: { value: 0.16 + Math.random() * 0.5 },
          uSeed: { value: Math.random() * 10 }
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      var mesh = new THREE.Mesh(planeGeo, mat);
      mesh.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.62,
        -6 - t * TUNNEL_DEPTH - Math.random() * 4
      );
      mesh.rotation.set(
        (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * 0.6
      );
      mesh.scale.setScalar(scale);
      field.add(mesh);
      floaters.push({
        mesh: mesh,
        spin: (Math.random() - 0.5) * 0.12,
        phase: Math.random() * Math.PI * 2,
        baseY: mesh.position.y
      });
    }

    // ---- wireframe solids ----------------------------------------
    var solidColor = uColor;
    var solids = [];
    var geos = [
      new THREE.IcosahedronGeometry(2.4, 1),
      new THREE.TorusGeometry(2.0, 0.06, 8, 40),
      new THREE.OctahedronGeometry(2.2, 0)
    ];
    var solidZ = [-2.5, -52, -104];
    for (var s = 0; s < geos.length; s++) {
      var sMat = new THREE.MeshBasicMaterial({
        color: LINE_DARK,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
        depthWrite: false
      });
      var solid = new THREE.Mesh(geos[s], sMat);
      solid.position.set((s % 2 ? -1 : 1) * 1.6, (s % 2 ? 0.8 : -0.6), solidZ[s]);
      scene.add(solid);
      solids.push({ mesh: solid, mat: sMat, speed: 0.12 + s * 0.05 });
    }
    void solidColor;

    // ---- particle field ------------------------------------------
    var pPos = new Float32Array(PARTICLE_COUNT * 3);
    for (var p = 0; p < PARTICLE_COUNT; p++) {
      pPos[p * 3] = (Math.random() - 0.5) * 30;
      pPos[p * 3 + 1] = (Math.random() - 0.5) * 20;
      pPos[p * 3 + 2] = -Math.random() * (TUNNEL_DEPTH + 10) + 6;
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    var pMat = new THREE.PointsMaterial({
      color: LINE_DARK,
      size: 0.045,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    });
    var points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    // ---- state ----------------------------------------------------
    var targetBg = BG_DARK;
    var targetLine = LINE_DARK;
    var bgTarget = new THREE.Color(BG_DARK);
    var lineTarget = new THREE.Color(LINE_DARK);

    var progress = 0;          // 0..1 scroll
    var progressSmooth = 0;
    var pointer = { x: 0, y: 0 };
    var pointerSmooth = { x: 0, y: 0 };

    var running = false;
    var rafId = null;
    var clock = new THREE.Clock();

    function resize() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    function renderFrame() {
      var dt = Math.min(clock.getDelta(), 0.05);
      var time = clock.elapsedTime;
      uTime.value = time;

      // smooth inputs
      progressSmooth += (progress - progressSmooth) * Math.min(1, dt * 3.2);
      pointerSmooth.x += (pointer.x - pointerSmooth.x) * Math.min(1, dt * 2.6);
      pointerSmooth.y += (pointer.y - pointerSmooth.y) * Math.min(1, dt * 2.6);

      // theme lerp
      bgColor.lerp(bgTarget, Math.min(1, dt * 2.0));
      if (scene.fog) scene.fog.color.copy(bgColor);
      uColor.value.lerp(lineTarget, Math.min(1, dt * 2.0));
      for (var i = 0; i < solids.length; i++) {
        solids[i].mat.color.copy(uColor.value);
      }
      if (pMat) pMat.color.copy(uColor.value);

      // camera dolly along the tunnel, driven by scroll
      var targetZ = 8 - progressSmooth * (TUNNEL_DEPTH + 6);
      camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 4.5);
      camera.position.x += (pointerSmooth.x * 2.1 - camera.position.x) * Math.min(1, dt * 3.0);
      camera.position.y += (-pointerSmooth.y * 1.5 - camera.position.y) * Math.min(1, dt * 3.0);

      var lookX = pointerSmooth.x * 1.6;
      var lookY = -pointerSmooth.y * 1.2 + Math.sin(progressSmooth * Math.PI) * 0.8;
      camera.lookAt(lookX, lookY, camera.position.z - 22);
      camera.rotation.z = pointerSmooth.x * 0.03;

      // float + spin
      for (var f = 0; f < floaters.length; f++) {
        var fl = floaters[f];
        fl.mesh.position.y = fl.baseY + Math.sin(time * 0.5 + fl.phase) * 0.28;
        fl.mesh.rotation.z += fl.spin * dt;
        fl.mesh.rotation.y += fl.spin * dt * 0.6;
      }
      for (var k = 0; k < solids.length; k++) {
        solids[k].mesh.rotation.x += solids[k].speed * dt;
        solids[k].mesh.rotation.y += solids[k].speed * dt * 1.3;
      }

      renderer.render(scene, camera);
    }

    function loop() {
      if (!running) return;
      renderFrame();
      rafId = requestAnimationFrame(loop);
    }

    // static first paint (also the whole thing under reduced-motion)
    renderFrame();

    return {
      start: function () {
        if (running) return;
        running = true;
        clock.getDelta();
        loop();
      },
      stop: function () {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      },
      setProgress: function (p) {
        progress = Math.max(0, Math.min(1, p));
        if (REDUCED) renderFrame();
      },
      setPointer: function (x, y) {
        pointer.x = x;
        pointer.y = y;
      },
      setTheme: function (isLight) {
        bgTarget.setHex(isLight ? BG_LIGHT : BG_DARK);
        lineTarget.setHex(isLight ? LINE_LIGHT : LINE_DARK);
        if (REDUCED) {
          bgColor.copy(bgTarget);
          uColor.value.copy(lineTarget);
          if (scene.fog) scene.fog.color.copy(bgColor);
          for (var i = 0; i < solids.length; i++) solids[i].mat.color.copy(uColor.value);
          if (pMat) pMat.color.copy(uColor.value);
          renderFrame();
        }
      },
      dispose: function () {
        this.stop();
        window.removeEventListener('resize', resize);
        renderer.dispose();
      }
    };
  }

  window.PortfolioScene = { create: create };
})();
