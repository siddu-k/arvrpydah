/**
 * 4-Stroke Engine WebXR Integration Manager
 * Manages Immersive AR (tabletop surface placement & hit testing) and Immersive VR sessions.
 */

import * as THREE from 'three';

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

    // Reticle for AR tabletop placement
    this.reticle = null;
    this.arPlaced = false;

    // VR Controllers
    this.controllers = [];

    this.checkSupport();
    this.setupARReticle();
  }

  async checkSupport() {
    this.supportsAR = false;
    this.supportsVR = false;

    if ('xr' in navigator) {
      try {
        this.supportsVR = await navigator.xr.isSessionSupported('immersive-vr');
      } catch (_) {}
      try {
        this.supportsAR = await navigator.xr.isSessionSupported('immersive-ar');
      } catch (_) {}
    }

    // Update UI buttons
    const btnVR = document.getElementById('btn-enter-vr');
    const btnAR = document.getElementById('btn-enter-ar');

    if (btnVR) {
      btnVR.disabled = !this.supportsVR;
      btnVR.title = this.supportsVR ? 'Enter Immersive VR' : 'WebXR VR not detected on this browser/device';
    }
    if (btnAR) {
      btnAR.disabled = !this.supportsAR;
      btnAR.title = this.supportsAR ? 'Enter Pass-Through AR' : 'WebXR AR requires mobile ARCore or XR headset';
    }
  }

  setupARReticle() {
    // Ring reticle for targeting surfaces
    const ringGeom = new THREE.RingGeometry(0.12, 0.14, 32).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide });
    this.reticle = new THREE.Mesh(ringGeom, ringMat);
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    // Inner dot
    const dotGeom = new THREE.CircleGeometry(0.025, 16).rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dot = new THREE.Mesh(dotGeom, dotMat);
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

      // Position engine at comfortable workbench viewing height in VR
      this.app.engineModel.root.position.set(0, 1.1, -1.2);
      this.app.engineModel.root.scale.set(0.6, 0.6, 0.6);

      session.addEventListener('end', () => {
        this.isVR = false;
        document.body.classList.remove('in-xr-mode');
        // Reset engine position
        this.app.engineModel.root.position.set(0, 0, 0);
        this.app.engineModel.root.scale.set(1, 1, 1);
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
        domOverlay: { root: document.getElementById('xr-overlay') || document.body }
      });

      this.renderer.xr.setSession(session);
      this.isAR = true;
      this.arPlaced = false;
      this.hitTestSourceRequested = false;
      document.body.classList.add('in-xr-mode', 'in-ar-mode');

      // Hide engine until user places on tabletop
      this.app.engineModel.root.visible = false;

      // Handle tap on screen / controller select to anchor engine
      const controller = this.renderer.xr.getController(0);
      const onSelect = () => {
        if (this.reticle.visible && !this.arPlaced) {
          this.app.engineModel.root.position.setFromMatrixPosition(this.reticle.matrix);
          // Scale to realistic desktop model scale (1:4 scale)
          this.app.engineModel.root.scale.set(0.35, 0.35, 0.35);
          this.app.engineModel.root.visible = true;
          this.arPlaced = true;
          this.reticle.visible = false;

          const toast = document.getElementById('ar-toast');
          if (toast) toast.innerText = 'Engine placed! Walk around or inspect cross-section.';
        } else if (this.arPlaced) {
          // Tap again to reposition
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
        this.app.engineModel.root.visible = true;
        this.app.engineModel.root.position.set(0, 0, 0);
        this.app.engineModel.root.scale.set(1, 1, 1);
        document.body.classList.remove('in-xr-mode', 'in-ar-mode');
        controller.removeEventListener('select', onSelect);
      });
    } catch (e) {
      console.error('Failed to start AR Session:', e);
      alert('Unable to start AR session: ' + e.message);
    }
  }

  setupVRControllers() {
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);

      // Add laser ray
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -2.5)
      ]);
      const ray = new THREE.Line(geom, new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 }));
      controller.add(ray);
      this.scene.add(controller);
      this.controllers.push(controller);
    }
  }

  update(frame) {
    if (!this.isAR || !frame) return;

    const session = this.renderer.xr.getSession();

    if (!this.hitTestSourceRequested) {
      session.requestReferenceSpace('viewer').then((referenceSpace) => {
        session.requestHitTestSource({ space: referenceSpace }).then((source) => {
          this.hitTestSource = source;
        });
      });
      session.addEventListener('end', () => {
        this.hitTestSourceRequested = false;
        this.hitTestSource = null;
      });
      this.hitTestSourceRequested = true;
    }

    if (this.hitTestSource && !this.arPlaced) {
      const referenceSpace = this.renderer.xr.getReferenceSpace();
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);

      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
        this.reticle.visible = true;
        this.reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        this.reticle.visible = false;
      }
    }
  }
}
