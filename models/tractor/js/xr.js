/**
 * MTZ-80 Tractor WebXR Integration Manager
 * Immersive AR tabletop placement + 6-DoF VR with laser inspection,
 * floating 3D HUD palette, trigger select, grip grab-to-rotate.
 */

import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

export class XRManager {
  constructor(app) {
    this.app = app;
    this.renderer = app.renderer;
    this.scene = app.scene;
    this.camera = app.camera;

    this.isAR = false;
    this.isVR = false;
    this.hitTestSource = null;
    this.hitTestSourceRequested = false;
    this.reticle = null;
    this.arPlaced = false;

    this.controllers = [];
    this.controllerGrips = [];
    this.controllerModelFactory = new XRControllerModelFactory();
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();

    this.hoveredPart = null;
    this.selectedPart = null;
    this.activeGrabController = null;
    this.grabStartMatrix = new THREE.Matrix4();
    this.modelStartMatrix = new THREE.Matrix4();

    this.vrHudPanel = null;
    this.vrHudCanvas = null;
    this.vrHudCtx = null;
    this.vrHudTexture = null;
    this.vrButtons = [];
    this.hoveredVrButton = null;

    this.checkSupport();
    this.setupARReticle();
  }

  get model() { return this.app.tractorModel; }

  async checkSupport() {
    this.supportsAR = false;
    this.supportsVR = false;
    if ('xr' in navigator) {
      try { this.supportsVR = await navigator.xr.isSessionSupported('immersive-vr'); } catch (_) {}
      try { this.supportsAR = await navigator.xr.isSessionSupported('immersive-ar'); } catch (_) {}
    }
    const btnVR = document.getElementById('btn-enter-vr');
    const btnAR = document.getElementById('btn-enter-ar');
    if (btnVR) { btnVR.disabled = !this.supportsVR; btnVR.title = this.supportsVR ? 'Enter Immersive VR' : 'WebXR VR not detected'; }
    if (btnAR) { btnAR.disabled = !this.supportsAR; btnAR.title = this.supportsAR ? 'Enter Pass-Through AR' : 'WebXR AR requires ARCore / headset'; }
  }

  setupARReticle() {
    const ringGeom = new THREE.RingGeometry(0.35, 0.38, 32).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, side: THREE.DoubleSide });
    this.reticle = new THREE.Mesh(ringGeom, ringMat);
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.reticle.add(dot);
  }

  async startVRSession() {
    if (!navigator.xr) return;
    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
      });
      this.renderer.xr.setSession(session);
      this.isVR = true;
      document.body.classList.add('in-xr-mode');
      this.setupVRControllers();
      this.createVRFloatingHUD();
      this.model.root.position.set(0, 1.1, -1.6);
      this.model.root.scale.set(0.55, 0.55, 0.55);
      session.addEventListener('end', () => {
        this.isVR = false;
        document.body.classList.remove('in-xr-mode');
        this.cleanupVRSession();
        this.model.root.position.set(0, 0, 0);
        this.model.root.scale.set(1, 1, 1);
        this.model.root.rotation.set(0, 0, 0);
      });
    } catch (e) {
      console.error('Failed to start VR Session:', e);
      alert('Unable to start VR session: ' + e.message);
    }
  }

  async startARSession() {
    if (!navigator.xr) return;
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'light-estimation'],
        domOverlay: { root: document.body }
      });
      this.renderer.xr.setSession(session);
      this.isAR = true;
      this.arPlaced = false;
      this.hitTestSourceRequested = false;
      document.body.classList.add('in-xr-mode', 'in-ar-mode');
      this.model.root.visible = false;
      const controller = this.renderer.xr.getController(0);
      const onSelect = () => {
        if (this.reticle.visible && !this.arPlaced) {
          this.model.root.position.setFromMatrixPosition(this.reticle.matrix);
          this.model.root.scale.set(0.35, 0.35, 0.35);
          this.model.root.visible = true;
          this.arPlaced = true;
          this.reticle.visible = false;
          const toast = document.getElementById('ar-toast');
          if (toast) toast.innerText = 'Tractor anchored! Walk around or tap to reposition.';
        } else if (this.arPlaced) {
          this.arPlaced = false;
        }
      };
      controller.addEventListener('select', onSelect);
      session.addEventListener('end', () => {
        this.isAR = false;
        this.arPlaced = false;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.reticle.visible = false;
        this.model.root.visible = true;
        this.model.root.position.set(0, 0, 0);
        this.model.root.scale.set(1, 1, 1);
        document.body.classList.remove('in-xr-mode', 'in-ar-mode');
        controller.removeEventListener('select', onSelect);
      });
    } catch (e) {
      console.error('Failed to start AR Session:', e);
      alert('Unable to start AR session: ' + e.message);
    }
  }

  setupVRControllers() {
    this.controllers = [];
    this.controllerGrips = [];
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.name = `VRController_${i}`;
      const rayGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3.2)]);
      controller.add(new THREE.Line(rayGeom, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })));
      const cursor = new THREE.Mesh(new THREE.SphereGeometry(0.01, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00d4ff }));
      cursor.name = 'LaserCursor';
      cursor.position.set(0, 0, -3.2);
      controller.add(cursor);
      controller.addEventListener('selectstart', (e) => this.onVRSelectStart(e.target));
      controller.addEventListener('squeezestart', (e) => this.onVRGripStart(e.target));
      controller.addEventListener('squeezeend', (e) => this.onVRGripEnd(e.target));
      this.scene.add(controller);
      this.controllers.push(controller);
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(this.controllerModelFactory.createControllerModel(grip));
      this.scene.add(grip);
      this.controllerGrips.push(grip);
    }
  }

  createVRFloatingHUD() {
    if (this.vrHudPanel) this.scene.remove(this.vrHudPanel);
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    this.vrHudCanvas = canvas;
    this.vrHudCtx = canvas.getContext('2d');
    this.vrHudTexture = new THREE.CanvasTexture(canvas);
    this.vrHudPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.375),
      new THREE.MeshBasicMaterial({ map: this.vrHudTexture, transparent: true, side: THREE.DoubleSide })
    );
    this.vrHudPanel.position.set(0.75, 1.45, -1.2);
    this.vrHudPanel.rotation.y = -0.4;
    this.scene.add(this.vrHudPanel);
    this.initVRButtons();
    this.renderVRHudCanvas();
  }

  initVRButtons() {
    this.vrButtons = [
      { id: 'play', x: 40, y: 110, w: 200, h: 65, label: 'START / STOP', action: () => {
        this.app.kinematics.isRunning = !this.app.kinematics.isRunning;
        this.app.audio.playMechanicalClick();
      }},
      { id: 'rpm_down', x: 260, y: 110, w: 90, h: 65, label: '- RPM', action: () => {
        this.app.kinematics.setRPM(this.app.kinematics.rpm - 200);
        this.app.audio.playMechanicalClick();
      }},
      { id: 'rpm_up', x: 365, y: 110, w: 90, h: 65, label: '+ RPM', action: () => {
        this.app.kinematics.setRPM(this.app.kinematics.rpm + 200);
        this.app.audio.playMechanicalClick();
      }},
      { id: 'drive', x: 40, y: 200, w: 135, h: 60, label: 'DRIVE', action: () => {
        this.app.kinematics.driveEnabled = !this.app.kinematics.driveEnabled;
        this.app.audio.playMechanicalClick();
      }},
      { id: 'xray', x: 190, y: 200, w: 135, h: 60, label: 'X-RAY', action: () => {
        this.model.setCrossSectionMode('xray');
        this.app.audio.playMechanicalClick();
      }},
      { id: 'solid', x: 340, y: 200, w: 115, h: 60, label: 'SOLID', action: () => {
        this.model.setCrossSectionMode('solid');
        this.app.audio.playMechanicalClick();
      }},
      { id: 'assemble', x: 40, y: 285, w: 200, h: 65, label: 'ASSEMBLE', action: () => {
        this.app.animateExplodeTo(0);
        this.app.audio.playMechanicalClick();
      }},
      { id: 'explode', x: 255, y: 285, w: 200, h: 65, label: 'EXPLODE', action: () => {
        this.app.animateExplodeTo(1.0);
        this.app.audio.playMechanicalClick();
      }},
      { id: 'reset_rot', x: 40, y: 375, w: 415, h: 60, label: 'RESET TRACTOR ROTATION', action: () => {
        this.model.root.rotation.set(0, 0, 0);
        this.app.audio.playMechanicalClick();
      }}
    ];
  }

  renderVRHudCanvas() {
    const ctx = this.vrHudCtx;
    if (!ctx) return;
    ctx.fillStyle = 'rgba(10, 10, 14, 0.94)';
    ctx.beginPath(); ctx.roundRect(0, 0, 1024, 512, 24); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(2, 2, 1020, 508, 24); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 32px Inter, sans-serif';
    ctx.fillText('MTZ-80 | VR CONTROLS', 40, 56);
    ctx.fillStyle = '#71717a'; ctx.font = '500 20px monospace';
    ctx.fillText(`RPM: ${Math.round(this.app.kinematics.rpm)}  |  SPEED: ${(this.app.kinematics.state.speedKmh || 0).toFixed(1)} km/h`, 40, 88);
    this.vrButtons.forEach((btn) => {
      const hov = this.hoveredVrButton === btn.id;
      ctx.fillStyle = hov ? '#ffffff' : '#18181b';
      ctx.beginPath(); ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 12); ctx.fill();
      ctx.strokeStyle = hov ? '#ffffff' : 'rgba(255,255,255,0.16)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = hov ? '#09090b' : '#f4f4f5';
      ctx.font = 'bold 20px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
      ctx.textAlign = 'left';
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.moveTo(480, 30); ctx.lineTo(480, 480); ctx.stroke();
    ctx.fillStyle = '#a1a1aa'; ctx.font = 'bold 18px monospace';
    ctx.fillText('SELECTED COMPONENT:', 505, 60);
    const part = this.selectedPart || this.hoveredPart;
    if (part) {
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px Inter, sans-serif';
      ctx.fillText(part.name || 'Tractor Assembly', 505, 100);
      ctx.fillStyle = '#a1a1aa'; ctx.font = '20px monospace';
      (part.specs || '').split(' | ').slice(0, 4).forEach((line, idx) => ctx.fillText(`• ${line}`, 505, 145 + idx * 36));
    }
    if (this.vrHudTexture) this.vrHudTexture.needsUpdate = true;
  }

  onVRSelectStart(controller) {
    if (this.vrHudPanel && this.hoveredVrButton) {
      const btn = this.vrButtons.find((b) => b.id === this.hoveredVrButton);
      if (btn?.action) { btn.action(); this.renderVRHudCanvas(); return; }
    }
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
    const intersects = this.raycaster.intersectObjects(this.model.root.children, true);
    if (intersects.length > 0) {
      let hitObj = intersects[0].object;
      let matchedPart = null, matchedKey = null;
      while (hitObj && hitObj !== this.model.root) {
        for (const key in this.model.parts) {
          if (this.model.parts[key].group === hitObj) { matchedPart = this.model.parts[key]; matchedKey = key; break; }
        }
        if (matchedPart) break;
        hitObj = hitObj.parent;
      }
      if (matchedPart) {
        this.selectedPart = matchedPart;
        this.app.showPartInspection(matchedPart);
        document.querySelectorAll('.component-item').forEach((item) => {
          item.classList.toggle('active', item.dataset.part === matchedKey);
        });
        this.app.audio.playMechanicalClick();
        this.renderVRHudCanvas();
      }
    }
  }

  onVRGripStart(controller) {
    this.activeGrabController = controller;
    this.grabStartMatrix.copy(controller.matrixWorld).invert();
    this.modelStartMatrix.copy(this.model.root.matrix);
  }
  onVRGripEnd(controller) {
    if (this.activeGrabController === controller) this.activeGrabController = null;
  }

  cleanupVRSession() {
    this.controllers.forEach((c) => this.scene.remove(c));
    this.controllerGrips.forEach((g) => this.scene.remove(g));
    this.controllers = [];
    this.controllerGrips = [];
    if (this.vrHudPanel) { this.scene.remove(this.vrHudPanel); this.vrHudPanel = null; }
  }

  update(frame) {
    if (this.isAR && frame) {
      const session = this.renderer.xr.getSession();
      if (!this.hitTestSourceRequested) {
        session.requestReferenceSpace('viewer').then((rs) => {
          session.requestHitTestSource({ space: rs }).then((source) => { this.hitTestSource = source; });
        });
        this.hitTestSourceRequested = true;
      }
      if (this.hitTestSource && !this.arPlaced) {
        const refSpace = this.renderer.xr.getReferenceSpace();
        const results = frame.getHitTestResults(this.hitTestSource);
        if (results.length > 0) {
          this.reticle.visible = true;
          this.reticle.matrix.fromArray(results[0].getPose(refSpace).transform.matrix);
        } else this.reticle.visible = false;
      }
    }
    if (this.isVR && this.controllers.length > 0) {
      if (this.activeGrabController) {
        const cur = this.activeGrabController.matrixWorld;
        const delta = new THREE.Matrix4().multiplyMatrices(cur, this.grabStartMatrix);
        const next = new THREE.Matrix4().multiplyMatrices(delta, this.modelStartMatrix);
        next.decompose(this.model.root.position, this.model.root.quaternion, this.model.root.scale);
      }
      const controller = this.controllers[0];
      this.tempMatrix.identity().extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
      let laserDist = 3.2;
      if (this.vrHudPanel) {
        const hits = this.raycaster.intersectObject(this.vrHudPanel);
        if (hits.length > 0) {
          laserDist = hits[0].distance;
          const uv = hits[0].uv;
          if (uv) {
            const cx = uv.x * 1024, cy = (1 - uv.y) * 512;
            let found = null;
            for (const b of this.vrButtons) {
              if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) { found = b.id; break; }
            }
            if (this.hoveredVrButton !== found) { this.hoveredVrButton = found; this.renderVRHudCanvas(); }
          }
        } else if (this.hoveredVrButton !== null) { this.hoveredVrButton = null; this.renderVRHudCanvas(); }
      }
      const partHits = this.raycaster.intersectObjects(this.model.root.children, true);
      if (partHits.length > 0 && partHits[0].distance < laserDist) laserDist = partHits[0].distance;
      const cursor = controller.getObjectByName('LaserCursor');
      if (cursor) cursor.position.set(0, 0, -laserDist);
    }
  }
}
