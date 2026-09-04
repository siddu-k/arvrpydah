/**
 * 4-Stroke Engine WebXR Integration Manager
 * Manages Immersive AR (tabletop surface placement & hit testing) and Immersive VR sessions.
 * Full 6-DoF VR controller laser raycasting, direct 3D component inspection,
 * floating in-VR 3D HUD control palette, trigger selection, and grip drag-to-rotate/scale.
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

    // Reticle for AR tabletop placement
    this.reticle = null;
    this.arPlaced = false;

    // VR Controllers & Tracking
    this.controllers = [];
    this.controllerGrips = [];
    this.controllerModelFactory = new XRControllerModelFactory();
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();

    // VR Interactivity state
    this.hoveredPart = null;
    this.selectedPart = null;
    this.activeGrabController = null;
    this.grabStartMatrix = new THREE.Matrix4();
    this.engineStartMatrix = new THREE.Matrix4();

    // In-VR 3D Floating HUD Canvas Panel
    this.vrHudPanel = null;
    this.vrHudCanvas = null;
    this.vrHudCtx = null;
    this.vrHudTexture = null;
    this.vrButtons = [];
    this.hoveredVrButton = null;

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
      btnVR.title = this.supportsVR ? 'Enter Immersive VR (Oculus/Meta Quest, Vive, Index, Pico)' : 'WebXR VR not detected on this browser/device';
    }
    if (btnAR) {
      btnAR.disabled = !this.supportsAR;
      btnAR.title = this.supportsAR ? 'Enter Pass-Through AR (WebXR ARCore / Vision Pro)' : 'WebXR AR requires mobile ARCore or XR headset';
    }
  }

  setupARReticle() {
    const ringGeom = new THREE.RingGeometry(0.12, 0.14, 32).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, side: THREE.DoubleSide });
    this.reticle = new THREE.Mesh(ringGeom, ringMat);
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

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
      this.createVRFloatingHUD();

      // Position engine at ergonomic workbench height in VR (~1.05m up, 0.9m in front)
      this.app.engineModel.root.position.set(0, 1.05, -0.9);
      this.app.engineModel.root.scale.set(0.7, 0.7, 0.7);

      session.addEventListener('end', () => {
        this.isVR = false;
        document.body.classList.remove('in-xr-mode');
        this.cleanupVRSession();
        this.app.engineModel.root.position.set(0, 0, 0);
        this.app.engineModel.root.scale.set(1, 1, 1);
        this.app.engineModel.root.rotation.set(0, 0, 0);
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

      // Hide engine until user anchors on tabletop surface
      this.app.engineModel.root.visible = false;

      const controller = this.renderer.xr.getController(0);
      const onSelect = () => {
        if (this.reticle.visible && !this.arPlaced) {
          this.app.engineModel.root.position.setFromMatrixPosition(this.reticle.matrix);
          this.app.engineModel.root.scale.set(0.38, 0.38, 0.38);
          this.app.engineModel.root.visible = true;
          this.arPlaced = true;
          this.reticle.visible = false;

          const toast = document.getElementById('ar-toast');
          if (toast) toast.innerText = 'Engine anchored! Walk around or tap to reposition.';
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
    this.controllers = [];
    this.controllerGrips = [];

    for (let i = 0; i < 2; i++) {
      // 1. Controller Pointer & Laser Ray
      const controller = this.renderer.xr.getController(i);
      controller.name = `VRController_${i}`;

      const rayGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -2.8)
      ]);
      const rayMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85
      });
      const ray = new THREE.Line(rayGeom, rayMat);
      ray.name = 'LaserRay';
      controller.add(ray);

      // Target cursor dot
      const cursorGeom = new THREE.SphereGeometry(0.008, 16, 16);
      const cursorMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
      const cursor = new THREE.Mesh(cursorGeom, cursorMat);
      cursor.name = 'LaserCursor';
      cursor.position.set(0, 0, -2.8);
      controller.add(cursor);

      // Trigger Click (Select)
      controller.addEventListener('selectstart', (e) => this.onVRSelectStart(e.target));
      // Grip Squeeze (Grab & Rotate Engine)
      controller.addEventListener('squeezestart', (e) => this.onVRGripStart(e.target));
      controller.addEventListener('squeezeend', (e) => this.onVRGripEnd(e.target));

      this.scene.add(controller);
      this.controllers.push(controller);

      // 2. Controller 3D Hardware Grip Model (Oculus Quest, Vive, Index)
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(this.controllerModelFactory.createControllerModel(grip));
      this.scene.add(grip);
      this.controllerGrips.push(grip);
    }
  }

  /* ================================================================
     FLOATING 3D IN-VR CONTROL PALETTE & HUD
     Renders live interactive CAD controls directly in the 3D space.
     ================================================================ */
  createVRFloatingHUD() {
    if (this.vrHudPanel) {
      this.scene.remove(this.vrHudPanel);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    this.vrHudCanvas = canvas;
    this.vrHudCtx = canvas.getContext('2d');

    this.vrHudTexture = new THREE.CanvasTexture(canvas);
    this.vrHudTexture.minFilter = THREE.LinearFilter;
    this.vrHudTexture.magFilter = THREE.LinearFilter;

    const panelGeom = new THREE.PlaneGeometry(0.65, 0.325);
    const panelMat = new THREE.MeshBasicMaterial({
      map: this.vrHudTexture,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.vrHudPanel = new THREE.Mesh(panelGeom, panelMat);
    this.vrHudPanel.name = 'VR_Floating_HUD';
    // Position floating slightly to the right of the engine, angled toward user
    this.vrHudPanel.position.set(0.55, 1.25, -0.75);
    this.vrHudPanel.rotation.y = -0.38;
    this.scene.add(this.vrHudPanel);

    this.initVRButtons();
    this.renderVRHudCanvas();
  }

  initVRButtons() {
    this.vrButtons = [
      { id: 'play', x: 40, y: 110, w: 200, h: 65, label: 'PLAY / PAUSE', action: () => {
        this.app.kinematics.isRunning = !this.app.kinematics.isRunning;
        this.app.audio.playMechanicalClick();
      }},
      { id: 'rpm_down', x: 260, y: 110, w: 90, h: 65, label: '- RPM', action: () => {
        this.app.kinematics.setRPM(this.app.kinematics.rpm - 300);
        this.app.audio.playMechanicalClick();
      }},
      { id: 'rpm_up', x: 365, y: 110, w: 90, h: 65, label: '+ RPM', action: () => {
        this.app.kinematics.setRPM(this.app.kinematics.rpm + 300);
        this.app.audio.playMechanicalClick();
      }},
      { id: 'cut_half', x: 40, y: 200, w: 135, h: 60, label: 'HALF CUT', action: () => {
        this.app.engineModel.setClippingMode('half');
        this.app.audio.playMechanicalClick();
      }},
      { id: 'cut_quarter', x: 190, y: 200, w: 135, h: 60, label: 'QUARTER', action: () => {
        this.app.engineModel.setClippingMode('quarter');
        this.app.audio.playMechanicalClick();
      }},
      { id: 'cut_xray', x: 340, y: 200, w: 115, h: 60, label: 'X-RAY', action: () => {
        this.app.engineModel.setClippingMode('xray');
        this.app.audio.playMechanicalClick();
      }},
      { id: 'explode_toggle', x: 40, y: 285, w: 200, h: 65, label: 'ASSEMBLE', action: () => {
        this.app.animateExplodeTo(0);
        this.app.audio.playMechanicalClick();
      }},
      { id: 'explode_full', x: 255, y: 285, w: 200, h: 65, label: 'EXPLODE', action: () => {
        this.app.animateExplodeTo(1.0);
        this.app.audio.playMechanicalClick();
      }},
      { id: 'reset_rot', x: 40, y: 375, w: 415, h: 60, label: 'RESET ENGINE ROTATION', action: () => {
        this.app.engineModel.root.rotation.set(0, 0, 0);
        this.app.audio.playMechanicalClick();
      }}
    ];
  }

  renderVRHudCanvas() {
    const ctx = this.vrHudCtx;
    if (!ctx) return;

    // Background Card
    ctx.fillStyle = 'rgba(10, 10, 14, 0.94)';
    ctx.roundRect(0, 0, 1024, 512, 24);
    ctx.fill();

    // 1px Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 4;
    ctx.roundRect(2, 2, 1020, 508, 24);
    ctx.stroke();

    // Title Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.fillText('AERO-4 | VR CONTROLS', 40, 56);

    ctx.fillStyle = '#71717a';
    ctx.font = '500 20px "JetBrains Mono", monospace';
    ctx.fillText(`RPM: ${Math.round(this.app.kinematics.rpm)}  |  STAGE: ${this.app.kinematics.state.strokePhase}`, 40, 88);

    // Render Buttons
    this.vrButtons.forEach((btn) => {
      const isHovered = this.hoveredVrButton === btn.id;
      ctx.fillStyle = isHovered ? '#ffffff' : '#18181b';
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 12);
      ctx.fill();

      ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = isHovered ? '#09090b' : '#f4f4f5';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
      ctx.textAlign = 'left';
    });

    // Right Side: Part Inspector Panel inside VR
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(480, 30);
    ctx.lineTo(480, 480);
    ctx.stroke();

    ctx.fillStyle = '#a1a1aa';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText('SELECTED COMPONENT:', 505, 60);

    const part = this.selectedPart || this.hoveredPart || this.app.engineModel.parts.piston;
    if (part) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px Inter, sans-serif';
      ctx.fillText(part.name || '4-Stroke Assembly', 505, 100);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '20px "JetBrains Mono", monospace';
      // Word wrap specs
      const words = (part.specs || 'High precision engineering CAD').split(' | ');
      words.forEach((line, idx) => {
        ctx.fillText(`• ${line}`, 505, 145 + idx * 36);
      });
    }

    ctx.fillStyle = '#52525b';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText('Aim laser & pull Trigger to click buttons / parts.', 505, 430);
    ctx.fillText('Hold Grip button to grab and rotate engine in 3D.', 505, 460);

    if (this.vrHudTexture) {
      this.vrHudTexture.needsUpdate = true;
    }
  }

  /* ================================================================
     VR CONTROLLER INTERACTIONS
     ================================================================ */
  onVRSelectStart(controller) {
    // 1. Check if clicking floating VR HUD button
    if (this.vrHudPanel && this.hoveredVrButton) {
      const btn = this.vrButtons.find((b) => b.id === this.hoveredVrButton);
      if (btn && btn.action) {
        btn.action();
        this.renderVRHudCanvas();
        return;
      }
    }

    // 2. Check if laser clicking an engine component
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

    const intersects = this.raycaster.intersectObjects(this.app.engineModel.root.children, true);
    if (intersects.length > 0) {
      let hitObj = intersects[0].object;
      let matchedPart = null;
      let matchedKey = null;

      while (hitObj && hitObj !== this.app.engineModel.root) {
        for (const key in this.app.engineModel.parts) {
          if (this.app.engineModel.parts[key].group === hitObj) {
            matchedPart = this.app.engineModel.parts[key];
            matchedKey = key;
            break;
          }
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
    this.engineStartMatrix.copy(this.app.engineModel.root.matrix);
  }

  onVRGripEnd(controller) {
    if (this.activeGrabController === controller) {
      this.activeGrabController = null;
    }
  }

  cleanupVRSession() {
    this.controllers.forEach((c) => this.scene.remove(c));
    this.controllerGrips.forEach((g) => this.scene.remove(g));
    this.controllers = [];
    this.controllerGrips = [];

    if (this.vrHudPanel) {
      this.scene.remove(this.vrHudPanel);
      this.vrHudPanel = null;
    }
  }

  /* ================================================================
     PER-FRAME XR UPDATE (RUNS EVERY FRAME IN RENDER LOOP)
     ================================================================ */
  update(frame) {
    // 1. AR Surface Hit-Testing & Reticle Placement
    if (this.isAR && frame) {
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

    // 2. VR Controllers Laser Tracking, HUD Raycast & Grip Drag
    if (this.isVR && this.controllers.length > 0) {
      // Check Grip Grab Rotation
      if (this.activeGrabController) {
        const currentMatrix = this.activeGrabController.matrixWorld;
        const deltaMatrix = new THREE.Matrix4().multiplyMatrices(currentMatrix, this.grabStartMatrix);
        const newEngineMatrix = new THREE.Matrix4().multiplyMatrices(deltaMatrix, this.engineStartMatrix);
        newEngineMatrix.decompose(
          this.app.engineModel.root.position,
          this.app.engineModel.root.quaternion,
          this.app.engineModel.root.scale
        );
      }

      // Laser Raycast from Primary Controller (Index 0)
      const controller = this.controllers[0];
      this.tempMatrix.identity().extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

      let laserHitDistance = 2.8;

      // Check Hover over In-VR 3D HUD Panel
      if (this.vrHudPanel) {
        const hudIntersects = this.raycaster.intersectObject(this.vrHudPanel);
        if (hudIntersects.length > 0) {
          laserHitDistance = hudIntersects[0].distance;
          const uv = hudIntersects[0].uv;
          if (uv) {
            const canvasX = uv.x * 1024;
            const canvasY = (1 - uv.y) * 512;
            let foundBtn = null;

            for (const btn of this.vrButtons) {
              if (canvasX >= btn.x && canvasX <= btn.x + btn.w &&
                  canvasY >= btn.y && canvasY <= btn.y + btn.h) {
                foundBtn = btn.id;
                break;
              }
            }

            if (this.hoveredVrButton !== foundBtn) {
              this.hoveredVrButton = foundBtn;
              this.renderVRHudCanvas();
            }
          }
        } else if (this.hoveredVrButton !== null) {
          this.hoveredVrButton = null;
          this.renderVRHudCanvas();
        }
      }

      // Check Hover over Engine 3D parts
      const partIntersects = this.raycaster.intersectObjects(this.app.engineModel.root.children, true);
      if (partIntersects.length > 0 && partIntersects[0].distance < laserHitDistance) {
        laserHitDistance = partIntersects[0].distance;
      }

      // Adjust controller cursor & ray endpoint to collision point
      const cursor = controller.getObjectByName('LaserCursor');
      if (cursor) {
        cursor.position.set(0, 0, -laserHitDistance);
      }
    }
  }
}
