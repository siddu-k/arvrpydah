/**
 * MTZ-80 Tractor Application Coordinator
 * Scene, lighting, camera, HUD telemetry (RPM / speed / steering), raycast inspection, XR.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TractorKinematics } from './kinematics.js';
import { TractorModel } from './model.js';
import { EngineAudio } from './audio.js';
import { XRManager } from './xr.js';

class TractorApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.clock = new THREE.Clock();
    this.kinematics = new TractorKinematics();
    this.audio = new EngineAudio();

    this.isAutoDisassembling = false;
    this.disassemblyDirection = 1;
    this.disassemblySpeed = 0.40;
    this.autoExplodePauseTimer = 0;
    this.targetExplode = null;

    this.initScene();
    this.initLighting();
    this.initModel();
    this.initControls();
    this.initXR();
    this.initUI();
    // Direct click-selection on the 3D model is disabled —
    // parts are selected from the 3D PARTS side panel only.
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.setAnimationLoop((time, frame) => this.render(time, frame));
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x09090b);
    this.scene.fog = new THREE.Fog(0x09090b, 18, 42);

    const floorGeom = new THREE.CircleGeometry(14, 64);
    this.floorMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.85, metalness: 0.2 });
    this.floor = new THREE.Mesh(floorGeom, this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.grid = new THREE.GridHelper(24, 48, 0x27272a, 0x27272a);
    this.grid.position.y = 0.01;
    this.grid.material.opacity = 0.35;
    this.grid.material.transparent = true;
    this.scene.add(this.grid);

    // Showroom turntable pad under the tractor
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 72),
      new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.9, metalness: 0.15 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.012;
    pad.receiveShadow = true;
    this.scene.add(pad);
    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(3.32, 3.42, 72),
      new THREE.MeshBasicMaterial({ color: 0x2e5aa8, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.y = 0.014;
    this.scene.add(padRing);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.05, 120);
    this.camera.position.set(4.8, 2.7, -5.0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    this.setupEnvironment();
  }

  setupEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x181e28);
    const mk = (color, w, pos, ry = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.set(...pos); m.rotation.y = ry;
      if (pos[1] === 6) m.rotation.x = Math.PI / 2;
      env.add(m);
    };
    mk(0xffffff, 8, [0, 6, 2]);
    mk(0x88ccff, 6, [-5, 2, -3], Math.PI / 3);
    mk(0xffaa66, 6, [5, 1, 3], -Math.PI / 3);
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    pmrem.dispose();
  }

  initLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    this.scene.add(this.ambientLight);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    this.keyLight.position.set(6, 9, -4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.left = -6; this.keyLight.shadow.camera.right = 6;
    this.keyLight.shadow.camera.top = 6; this.keyLight.shadow.camera.bottom = -6;
    this.keyLight.shadow.camera.far = 30;
    this.keyLight.shadow.bias = -0.0003;
    this.scene.add(this.keyLight);
    const rim = new THREE.DirectionalLight(0x70b5ff, 2.2);
    rim.position.set(-6, 4, 5);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0xffecd0, 18, 12, 1.8);
    fill.position.set(0, 3.2, 0);
    this.scene.add(fill);
  }

  initModel() {
    this.tractorModel = new TractorModel(this.kinematics);
    this.scene.add(this.tractorModel.root);
  }

  initControls() {
    // Mirrors the piston-engine rig: damped orbit around a fixed target,
    // zoom travels toward the target (no cursor-anchored jumps).
    // Distances scaled for the ~4 m tractor; zoom kept gentle per tuning.
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1.15, 0);
    this.controls.minDistance = 3.0;
    this.controls.maxDistance = 16.0;
    this.controls.zoomSpeed = 0.7;
    this.controls.zoomToCursor = false;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.12;

    // Smooth sliding zoom: OrbitControls' built-in dolly jumps once per
    // wheel notch ("one shot"), so it is disabled and the radius glides
    // toward a wheel-driven target every frame instead.
    this.controls.enableZoom = false;
    this.zoomTarget = this.camera.position.distanceTo(this.controls.target);
    this._lastPinch = null;
    this._pinchPts = new Map();
    this.initSmoothZoom();
  }

  initSmoothZoom() {
    const el = this.renderer.domElement;
    const clampTarget = (v) => THREE.MathUtils.clamp(v, this.controls.minDistance, this.controls.maxDistance);

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;       // line scroll → pixels
      else if (e.deltaMode === 2) d *= 400; // page scroll → pixels
      this.zoomTarget = clampTarget(this.zoomTarget * Math.exp(d * 0.0011));
    }, { passive: false });

    // Two-finger pinch glides the same target on touchscreens
    el.addEventListener('pointerdown', (e) => this._pinchPts.set(e.pointerId, { x: e.clientX, y: e.clientY }));
    const forget = (e) => { this._pinchPts.delete(e.pointerId); if (this._pinchPts.size < 2) this._lastPinch = null; };
    el.addEventListener('pointerup', forget);
    el.addEventListener('pointercancel', forget);
    el.addEventListener('pointerleave', forget);
    el.addEventListener('pointermove', (e) => {
      if (!this._pinchPts.has(e.pointerId)) return;
      this._pinchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pinchPts.size === 2) {
        const [a, b] = [...this._pinchPts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this._lastPinch && d > 0) {
          this.zoomTarget = clampTarget(this.zoomTarget * Math.exp((this._lastPinch - d) * 0.005));
        }
        this._lastPinch = d;
      }
    });
  }

  applySmoothZoom(delta) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const cur = off.length();
    if (cur < 1e-6) return;
    const t = 1 - Math.exp(-delta * 9);
    const nd = cur + (this.zoomTarget - cur) * t;
    if (Math.abs(nd - cur) > 1e-6) {
      off.setLength(nd);
      this.camera.position.copy(this.controls.target).add(off);
    } else {
      this.zoomTarget = cur;
    }
  }

  initXR() { this.xrManager = new XRManager(this); }

  showPartInspection(part) {
    const card = document.getElementById('part-info-card');
    if (!card) return;
    document.getElementById('part-name').innerText = part.name;
    document.getElementById('part-specs').innerText = part.specs;
    card.classList.remove('hidden');
  }

  initUI() {
    const btnPlay = document.getElementById('btn-play');
    if (btnPlay) btnPlay.addEventListener('click', () => {
      this.kinematics.isRunning = !this.kinematics.isRunning;
      btnPlay.innerHTML = this.kinematics.isRunning
        ? '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
      btnPlay.classList.toggle('active', this.kinematics.isRunning);
    });

    const rpmSlider = document.getElementById('rpm-slider');
    if (rpmSlider) rpmSlider.addEventListener('input', (e) => {
      const rpm = parseInt(e.target.value, 10);
      this.kinematics.setRPM(rpm);
      document.getElementById('rpm-value').innerText = rpm.toLocaleString() + ' RPM';
    });

    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) speedSlider.addEventListener('input', (e) => {
      this.kinematics.setSpeed(parseFloat(e.target.value));
      document.getElementById('speed-value').innerText = parseFloat(e.target.value).toFixed(1) + ' km/h';
    });

    const steerSlider = document.getElementById('steer-slider');
    if (steerSlider) steerSlider.addEventListener('input', (e) => {
      this.kinematics.setSteering(parseFloat(e.target.value));
      document.getElementById('steer-value').innerText = this.fmtSteer(parseFloat(e.target.value));
    });

    const driveBtn = document.getElementById('btn-drive');
    if (driveBtn) driveBtn.addEventListener('click', () => {
      this.kinematics.driveEnabled = !this.kinematics.driveEnabled;
      driveBtn.classList.toggle('active', this.kinematics.driveEnabled);
      driveBtn.querySelector('span').innerText = this.kinematics.driveEnabled ? 'DRIVE: ON' : 'DRIVE: OFF';
      this.audio.playMechanicalClick();
    });

    document.querySelectorAll('.cut-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cut-mode-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.tractorModel.setCrossSectionMode(btn.dataset.mode);
        this.audio.playMechanicalClick();
      });
    });

    const explodeSlider = document.getElementById('explode-slider');
    if (explodeSlider) explodeSlider.addEventListener('input', (e) => {
      this.isAutoDisassembling = false;
      this.targetExplode = null;
      document.getElementById('btn-auto-explode')?.classList.remove('active');
      const f = parseFloat(e.target.value) / 100;
      this.tractorModel.setExplodeFactor(f);
      document.getElementById('explode-value').innerText = Math.round(f * 100) + '%';
    });
    document.getElementById('btn-auto-explode')?.addEventListener('click', (e) => {
      this.targetExplode = null;
      this.isAutoDisassembling = !this.isAutoDisassembling;
      e.currentTarget.classList.toggle('active', this.isAutoDisassembling);
      this.audio.playMechanicalClick();
    });
    document.getElementById('btn-assemble')?.addEventListener('click', () => { this.animateExplodeTo(0); this.audio.playMechanicalClick(); });
    document.getElementById('btn-explode')?.addEventListener('click', () => { this.animateExplodeTo(1); this.audio.playMechanicalClick(); });

    document.querySelectorAll('.cam-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => { this.setCameraPreset(btn.dataset.view); this.audio.playMechanicalClick(); });
    });

    document.getElementById('btn-audio')?.addEventListener('click', (e) => {
      const isMuted = this.audio.toggleMute();
      e.currentTarget.classList.toggle('active', !isMuted);
    });
    document.getElementById('btn-enter-vr')?.addEventListener('click', () => this.xrManager.startVRSession());
    document.getElementById('btn-enter-ar')?.addEventListener('click', () => this.xrManager.startARSession());
    document.getElementById('btn-close-card')?.addEventListener('click', () => {
      document.getElementById('part-info-card')?.classList.add('hidden');
    });

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-content-${btn.dataset.tab}`)?.classList.add('active');
        this.audio.playMechanicalClick();
      });
    });
    document.querySelectorAll('.component-item').forEach((item) => {
      item.addEventListener('click', () => this.focusOnPart(item.dataset.part));
    });
    document.getElementById('btn-reset-part-view')?.addEventListener('click', () => {
      this.setCameraPreset('iso');
      document.querySelectorAll('.component-item').forEach((i) => i.classList.remove('active'));
      document.getElementById('part-info-card')?.classList.add('hidden');
      this.audio.playMechanicalClick();
    });
  }

  focusOnPart(partKey) {
    const part = this.tractorModel.parts[partKey];
    if (!part) return;
    part.group.updateWorldMatrix(true, true);
    const aabb = new THREE.Box3().setFromObject(part.group);
    let target = new THREE.Vector3(), camPos = new THREE.Vector3();
    if (!aabb.isEmpty()) {
      aabb.getCenter(target);
      const size = new THREE.Vector3();
      aabb.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z, 0.6);
      const fov = (this.camera.fov * Math.PI) / 180;
      const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.6;
      const dir = this.camera.position.clone().sub(this.controls.target).normalize();
      camPos.copy(target).add(dir.multiplyScalar(Math.max(dist, 3.0)));
      camPos.y = Math.max(camPos.y, target.y + 0.2);
    } else {
      target = part.group.getWorldPosition(new THREE.Vector3());
      camPos = target.clone().add(new THREE.Vector3(2, 1.5, -3));
    }
    this.animateCamera(camPos, target);
    document.querySelectorAll('.component-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.part === partKey);
    });
    this.showPartInspection(part);
    this.audio.playMechanicalClick();
  }

  setCameraPreset(preset) {
    if (preset === 'iso') this.animateCamera(new THREE.Vector3(4.8, 2.7, -5.0), new THREE.Vector3(0, 1.15, 0));
    else if (preset === 'front') this.animateCamera(new THREE.Vector3(0.4, 1.6, -6.2), new THREE.Vector3(0, 1.2, -0.8));
    else if (preset === 'cab') this.animateCamera(new THREE.Vector3(1.7, 2.6, -1.6), new THREE.Vector3(0, 1.55, 0.35));
    else if (preset === 'rear') this.animateCamera(new THREE.Vector3(-3.4, 2.2, 5.2), new THREE.Vector3(0, 1.0, 1.0));
  }

  animateCamera(tp, tl) {
    const sp = this.camera.position.clone(), st = this.controls.target.clone();
    let el = 0;
    const step = () => {
      el += 0.025;
      const t = Math.min(1, el / 0.8);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.camera.position.lerpVectors(sp, tp, e);
      this.controls.target.lerpVectors(st, tl, e);
      this.controls.update();
      this.zoomTarget = this.camera.position.distanceTo(this.controls.target);
      if (t < 1) requestAnimationFrame(step);
    };
    step();
  }

  updateHUD(s) {
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    set('hud-speed', s.speedKmh.toFixed(1) + ' km/h');
    set('hud-rpm2', Math.round(s.rpm) + ' rpm');
    set('hud-steer', this.fmtSteer(s.steeringDeg));
    set('hud-pto', Math.round(this.kinematics.ptoRPM * (s.rpm / 1600)) + ' rpm');
    const needle = document.getElementById('tacho-needle');
    if (needle) {
      const ratio = Math.min(1, s.rpm / 2400);
      needle.style.transform = `rotate(${-120 + ratio * 240}deg)`;
    }
    if (this.kinematics.isRunning) {
      const ss = document.getElementById('speed-readout');
      if (ss) ss.innerText = s.speedKmh.toFixed(1) + ' km/h ground speed';
    }
  }

  animateExplodeTo(t) { this.targetExplode = THREE.MathUtils.clamp(t, 0, 1); }

  fmtSteer(d) {
    const a = Math.abs(Math.round(d));
    return d > 0.5 ? `${a}° R` : d < -0.5 ? `${a}° L` : '0°';
  }

  render(time, frame) {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    if (this.targetExplode !== null && this.targetExplode !== undefined) {
      const cur = this.tractorModel.explodeFactor;
      const dir = this.targetExplode > cur ? 1 : -1;
      let next = cur + dir * 0.75 * delta;
      if ((dir === 1 && next >= this.targetExplode) || (dir === -1 && next <= this.targetExplode)) {
        next = this.targetExplode; this.targetExplode = null;
      }
      this.tractorModel.setExplodeFactor(next);
      const es = document.getElementById('explode-slider');
      if (es) es.value = Math.round(next * 100);
      const ev = document.getElementById('explode-value');
      if (ev) ev.innerText = Math.round(next * 100) + '%';
    } else if (this.isAutoDisassembling) {
      if (this.autoExplodePauseTimer > 0) this.autoExplodePauseTimer -= delta;
      else {
        let f = this.tractorModel.explodeFactor + this.disassemblyDirection * this.disassemblySpeed * delta;
        if (f >= 1) { f = 1; this.disassemblyDirection = -1; this.autoExplodePauseTimer = 0.8; }
        else if (f <= 0) { f = 0; this.disassemblyDirection = 1; this.autoExplodePauseTimer = 0.8; }
        this.tractorModel.setExplodeFactor(f);
        const es = document.getElementById('explode-slider');
        if (es) es.value = Math.round(f * 100);
        const ev = document.getElementById('explode-value');
        if (ev) ev.innerText = Math.round(f * 100) + '%';
      }
    }
    const state = this.kinematics.update(delta);
    this.tractorModel.update(state);
    this.audio.update(state, this.kinematics.rpm, this.kinematics.isRunning);
    this.updateHUD(state);
    this.xrManager.update(frame);
    // Glide zoom toward the wheel target, then damped orbit
    if (!this.renderer.xr.isPresenting) {
      this.applySmoothZoom(delta);
      this.controls.update();
    }
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

window.addEventListener('DOMContentLoaded', () => { window.app = new TractorApp(); });
