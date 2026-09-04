/**
 * 4-Stroke Engine Application Coordinator
 * Handles Scene, Lighting, Camera, User Controls, HUD Telemetry, and Raycast Inspection.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EngineKinematics } from './kinematics.js';
import { EngineModel } from './model.js';
import { EngineAudio } from './audio.js';
import { XRManager } from './xr.js';

class EngineApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.clock = new THREE.Clock();

    // Core systems
    this.kinematics = new EngineKinematics();
    this.audio = new EngineAudio();

    // Auto disassembly animation state
    this.isAutoDisassembling = false;
    this.disassemblyDirection = 1; // 1 = exploding, -1 = assembling
    this.disassemblySpeed = 0.40; // units/sec
    this.autoExplodePauseTimer = 0;
    this.targetExplode = null;

    // Initialize 3D Scene
    this.initScene();
    this.initLighting();
    this.initModel();
    this.initControls();
    this.initXR();
    this.initUI();
    this.initRaycasting();

    // Responsive resize
    window.addEventListener('resize', () => this.onWindowResize());

    // Default to clean White Studio background
    this.setAppTheme('white');

    // Start animation loop with WebXR renderer loop
    this.renderer.setAnimationLoop((time, frame) => this.render(time, frame));
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    // Radial studio floor (white-theme defaults)
    const floorGeom = new THREE.CircleGeometry(10, 64);
    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0xf0f3f7,
      roughness: 0.65,
      metalness: 0.2
    });
    this.floor = new THREE.Mesh(floorGeom, this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -1.2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    // Floor grid (white-theme defaults)
    this.grid = new THREE.GridHelper(16, 32, 0xc8cfdb, 0xc8cfdb);
    this.grid.position.y = -1.19;
    this.grid.material.opacity = 0.5;
    this.grid.material.transparent = true;
    this.scene.add(this.grid);

    // Camera - nicely framed to view full valvetrain to crankcase
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    this.camera.position.set(2.8, 1.8, 4.2);

    // WebGL Renderer with local clipping enabled
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.xr.enabled = true;

    this.container.appendChild(this.renderer.domElement);

    // Generate Studio Environment Map for realistic PBR metallic reflections
    this.setupEnvironment();
  }

  setupEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    // Create procedural high-contrast studio environment
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x181e28);

    // Add soft overhead white softbox
    const softbox1 = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    softbox1.position.set(0, 6, 2);
    softbox1.rotation.x = Math.PI / 2;
    envScene.add(softbox1);

    // Cyan / blue rim softbox
    const softbox2 = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ color: 0x88ccff, side: THREE.DoubleSide })
    );
    softbox2.position.set(-5, 2, -3);
    softbox2.rotation.y = Math.PI / 3;
    envScene.add(softbox2);

    // Warm amber fill softbox
    const softbox3 = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffaa66, side: THREE.DoubleSide })
    );
    softbox3.position.set(5, 1, 3);
    softbox3.rotation.y = -Math.PI / 3;
    envScene.add(softbox3);

    const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
    this.scene.environment = envMap;
    pmremGenerator.dispose();
  }

  initLighting() {
    // Ambient fill
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(this.ambientLight);

    // Main Studio Key Light (soft white directional)
    this.keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    this.keyLight.position.set(4, 7, 5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 25;
    this.keyLight.shadow.bias = -0.0003;
    this.scene.add(this.keyLight);

    // Cool Rim Light (accents metal bevels)
    const rimLight = new THREE.DirectionalLight(0x70b5ff, 2.5);
    rimLight.position.set(-5, 4, -4);
    this.scene.add(rimLight);

    // Valvetrain top spotlight
    const topLight = new THREE.DirectionalLight(0xffffff, 2.0);
    topLight.position.set(0, 6, 1);
    this.scene.add(topLight);

    // Crankcase interior fill light
    const crankLight = new THREE.PointLight(0xffecd0, 2.2, 5.0, 1.2);
    crankLight.position.set(0.5, 0.2, 1.2);
    this.scene.add(crankLight);
  }

  initModel() {
    this.engineModel = new EngineModel(this.kinematics);
    this.scene.add(this.engineModel.root);
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1.5, 0);
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 12.0;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.15; // Don't flip below floor
  }

  initXR() {
    this.xrManager = new XRManager(this);
  }

  initRaycasting() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      // Raycast only if clicking on canvas
      if (e.target !== this.renderer.domElement) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.engineModel.root.children, true);

      if (intersects.length > 0) {
        // Find which engine part group this mesh belongs to
        let hitObj = intersects[0].object;
        let matchedPart = null;

        while (hitObj && hitObj !== this.engineModel.root) {
          for (const key in this.engineModel.parts) {
            if (this.engineModel.parts[key].group === hitObj) {
              matchedPart = this.engineModel.parts[key];
              break;
            }
          }
          if (matchedPart) break;
          hitObj = hitObj.parent;
        }

        if (matchedPart) {
          this.showPartInspection(matchedPart);
          this.audio.playMechanicalClick();
        }
      }
    });
  }

  showPartInspection(part) {
    const card = document.getElementById('part-info-card');
    const title = document.getElementById('part-name');
    const specs = document.getElementById('part-specs');

    if (card && title && specs) {
      title.innerText = part.name;
      specs.innerText = part.specs;
      card.classList.remove('hidden');
    }
  }

  initUI() {
    // 1. Play / Pause Button (Icon only)
    const btnPlay = document.getElementById('btn-play');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        this.kinematics.isRunning = !this.kinematics.isRunning;
        btnPlay.innerHTML = this.kinematics.isRunning
          ? '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
          : '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
        btnPlay.classList.toggle('active', this.kinematics.isRunning);
      });
    }

    // 2. RPM Slider
    const rpmSlider = document.getElementById('rpm-slider');
    const rpmValue = document.getElementById('rpm-value');
    if (rpmSlider) {
      rpmSlider.addEventListener('input', (e) => {
        const rpm = parseInt(e.target.value, 10);
        this.kinematics.setRPM(rpm);
        if (rpmValue) rpmValue.innerText = rpm.toLocaleString() + ' RPM';
      });
    }

    // 3. Crank Angle Scrubber Slider (0 to 720)
    const angleSlider = document.getElementById('crank-slider');
    const angleValue = document.getElementById('crank-angle-value');
    if (angleSlider) {
      angleSlider.addEventListener('input', (e) => {
        const deg = parseFloat(e.target.value);
        this.kinematics.isRunning = false;
        if (btnPlay) {
          btnPlay.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
          btnPlay.classList.remove('active');
        }
        this.kinematics.setCrankAngleDeg(deg);
        if (angleValue) angleValue.innerText = Math.round(deg) + '°';
      });
    }

    // 4. Cross-Section Buttons
    const cutButtons = document.querySelectorAll('.cut-mode-btn');
    const sliceSliderContainer = document.getElementById('slice-slider-container');
    const sliceSlider = document.getElementById('slice-slider');

    cutButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        cutButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.dataset.mode;
        if (sliceSliderContainer) {
          sliceSliderContainer.style.display = mode === 'slice' ? 'flex' : 'none';
        }
        this.engineModel.setCrossSectionMode(mode, sliceSlider ? parseFloat(sliceSlider.value) : 0);
        this.audio.playMechanicalClick();
      });
    });

    if (sliceSlider) {
      sliceSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.engineModel.setCrossSectionMode('slice', val);
      });
    }

    // 5. Assemble / Disassemble (Exploded View) Controls
    const explodeSlider = document.getElementById('explode-slider');
    const explodeValue = document.getElementById('explode-value');
    const btnAutoExplode = document.getElementById('btn-auto-explode');
    const btnAssemble = document.getElementById('btn-assemble');
    const btnExplode = document.getElementById('btn-explode');

    if (explodeSlider) {
      explodeSlider.addEventListener('input', (e) => {
        this.isAutoDisassembling = false;
        this.targetExplode = null;
        if (btnAutoExplode) btnAutoExplode.classList.remove('active');
        const factor = parseFloat(e.target.value) / 100;
        this.engineModel.setExplodeFactor(factor);
        if (explodeValue) explodeValue.innerText = Math.round(factor * 100) + '%';
      });
    }

    if (btnAutoExplode) {
      btnAutoExplode.addEventListener('click', () => {
        this.targetExplode = null;
        this.isAutoDisassembling = !this.isAutoDisassembling;
        btnAutoExplode.classList.toggle('active', this.isAutoDisassembling);
        this.audio.playMechanicalClick();
      });
    }

    if (btnAssemble) {
      btnAssemble.addEventListener('click', () => {
        this.isAutoDisassembling = false;
        if (btnAutoExplode) btnAutoExplode.classList.remove('active');
        this.animateExplodeTo(0.0);
        this.audio.playMechanicalClick();
      });
    }

    if (btnExplode) {
      btnExplode.addEventListener('click', () => {
        this.isAutoDisassembling = false;
        if (btnAutoExplode) btnAutoExplode.classList.remove('active');
        this.animateExplodeTo(1.0);
        this.audio.playMechanicalClick();
      });
    }

    // 6. Camera View Preset Buttons
    const viewButtons = document.querySelectorAll('.cam-preset-btn');
    viewButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.setCameraPreset(view);
        this.audio.playMechanicalClick();
      });
    });

    // 7. Audio Mute Toggle (Icon only)
    const btnAudio = document.getElementById('btn-audio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const isMuted = this.audio.toggleMute();
        btnAudio.classList.toggle('active', !isMuted);
        btnAudio.innerHTML = !isMuted
          ? '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>'
          : '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
      });
    }

    // 8. AR / VR Buttons
    const btnVR = document.getElementById('btn-enter-vr');
    if (btnVR) {
      btnVR.addEventListener('click', () => this.xrManager.startVRSession());
    }

    const btnAR = document.getElementById('btn-enter-ar');
    if (btnAR) {
      btnAR.addEventListener('click', () => this.xrManager.startARSession());
    }

    // 9. Close Part Card Button
    const btnCloseCard = document.getElementById('btn-close-card');
    if (btnCloseCard) {
      btnCloseCard.addEventListener('click', () => {
        const card = document.getElementById('part-info-card');
        if (card) card.classList.add('hidden');
      });
    }

    // 10. Environment Theme Toggle (Two Themes: White & Black Only)
    const themeButtons = document.querySelectorAll('.theme-btn');
    themeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        themeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.dataset.theme;
        this.setAppTheme(theme);
        this.audio.playMechanicalClick();
      });
    });
  }

  setAppTheme(theme) {
    if (theme === 'black') {
      document.body.classList.add('theme-black');
      this.scene.background = new THREE.Color(0x0a0c10);
      this.floorMat.color.set(0x0e1219);
      this.floorMat.roughness = 0.85;
      if (this.grid) {
        this.grid.material.color.set(0x283244);
        this.grid.material.opacity = 0.6;
      }
      if (this.ambientLight) this.ambientLight.intensity = 1.1;
    } else { // 'white'
      document.body.classList.remove('theme-black');
      this.scene.background = new THREE.Color(0xffffff);
      this.floorMat.color.set(0xf0f3f7);
      this.floorMat.roughness = 0.65;
      if (this.grid) {
        this.grid.material.color.set(0xc8cfdb);
        this.grid.material.opacity = 0.5;
      }
      if (this.ambientLight) this.ambientLight.intensity = 1.6;
    }
  }

  setBackgroundTheme(themeOrColor) {
    if (themeOrColor === '#ffffff' || themeOrColor === 'white') {
      this.setAppTheme('white');
    } else {
      this.setAppTheme('black');
    }
  }

  setCameraPreset(preset) {
    if (preset === 'iso') {
      this.animateCamera(new THREE.Vector3(2.8, 2.2, 3.8), new THREE.Vector3(0, 1.5, 0));
    } else if (preset === 'cutaway') {
      this.animateCamera(new THREE.Vector3(0.0, 1.8, 4.2), new THREE.Vector3(0, 1.6, 0));
    } else if (preset === 'valvetrain') {
      this.animateCamera(new THREE.Vector3(0.5, 4.2, 2.0), new THREE.Vector3(0, 2.8, 0));
    } else if (preset === 'crankcase') {
      this.animateCamera(new THREE.Vector3(2.2, -0.4, 2.2), new THREE.Vector3(0, 0.4, 0));
    }
  }

  animateCamera(targetPos, targetLookAt) {
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 0.8;
    let elapsed = 0;

    const animStep = () => {
      elapsed += 0.025;
      const t = Math.min(1, elapsed / duration);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.controls.target.lerpVectors(startTarget, targetLookAt, ease);
      this.controls.update();

      if (t < 1) requestAnimationFrame(animStep);
    };
    animStep();
  }

  updateHUD(kinematicsState) {
    // 1. Update 4-stroke pill indicators
    const currentPhase = kinematicsState.strokePhase;
    ['INTAKE', 'COMPRESSION', 'POWER', 'EXHAUST'].forEach((phase) => {
      const pill = document.getElementById(`pill-${phase.toLowerCase()}`);
      if (pill) {
        pill.classList.toggle('active', currentPhase === phase);
      }
    });

    // 2. Stroke Progress Bar
    const progBar = document.getElementById('stroke-progress-fill');
    if (progBar) {
      progBar.style.width = Math.round(kinematicsState.strokeProgress * 100) + '%';
    }

    // 3. Telemetry values
    const txtPhase = document.getElementById('hud-phase');
    if (txtPhase) txtPhase.innerText = currentPhase;

    const txtPress = document.getElementById('hud-pressure');
    if (txtPress) txtPress.innerText = kinematicsState.cylinderPressure.toFixed(1) + ' bar';

    const txtTemp = document.getElementById('hud-temp');
    if (txtTemp) txtTemp.innerText = Math.round(kinematicsState.gasTemperature) + ' K';

    // 4. Update scrubber slider if running
    if (this.kinematics.isRunning) {
      const angleSlider = document.getElementById('crank-slider');
      const angleValue = document.getElementById('crank-angle-value');
      if (angleSlider) angleSlider.value = kinematicsState.cycleAngleDeg;
      if (angleValue) angleValue.innerText = Math.round(kinematicsState.cycleAngleDeg) + '°';
    }

    // 5. Tachometer needle rotation (0 to 6000 RPM -> -120deg to +120deg)
    const needle = document.getElementById('tacho-needle');
    if (needle) {
      const ratio = Math.min(1, this.kinematics.rpm / 6000);
      const deg = -120 + ratio * 240;
      needle.style.transform = `rotate(${deg}deg)`;
    }
  }

  animateExplodeTo(target) {
    this.targetExplode = Math.max(0, Math.min(1, target));
  }

  render(time, frame) {
    const delta = Math.min(this.clock.getDelta(), 0.1);

    // 1. Direct Target Explode / Assemble Animation (Button clicks)
    if (this.targetExplode !== null && this.targetExplode !== undefined) {
      const current = this.engineModel.explodeFactor;
      const dir = this.targetExplode > current ? 1 : -1;
      const step = 0.75 * delta; // Smooth ~1.3s full sweep
      let next = current + dir * step;
      if ((dir === 1 && next >= this.targetExplode) || (dir === -1 && next <= this.targetExplode)) {
        next = this.targetExplode;
        this.targetExplode = null;
      }
      this.engineModel.setExplodeFactor(next);

      const explodeSlider = document.getElementById('explode-slider');
      const explodeValue = document.getElementById('explode-value');
      if (explodeSlider) explodeSlider.value = Math.round(next * 100);
      if (explodeValue) explodeValue.innerText = Math.round(next * 100) + '%';
    } else if (this.isAutoDisassembling) {
      // 2. Auto Continuous Disassembly / Assembly Loop with End-State Pauses
      if (this.autoExplodePauseTimer > 0) {
        this.autoExplodePauseTimer -= delta;
      } else {
        let f = this.engineModel.explodeFactor + this.disassemblyDirection * this.disassemblySpeed * delta;
        if (f >= 1.0) {
          f = 1.0;
          this.disassemblyDirection = -1; // reverse to assemble
          this.autoExplodePauseTimer = 0.8; // pause 0.8s at 100%
        } else if (f <= 0.0) {
          f = 0.0;
          this.disassemblyDirection = 1; // reverse to explode
          this.autoExplodePauseTimer = 0.8; // pause 0.8s at 0%
        }
        this.engineModel.setExplodeFactor(f);

        const explodeSlider = document.getElementById('explode-slider');
        const explodeValue = document.getElementById('explode-value');
        if (explodeSlider) explodeSlider.value = Math.round(f * 100);
        if (explodeValue) explodeValue.innerText = Math.round(f * 100) + '%';
      }
    }

    // Update kinematics
    const state = this.kinematics.update(delta);

    // Update 3D model transforms
    this.engineModel.update(state);

    // Update audio synthesizer
    this.audio.update(state, this.kinematics.rpm, this.kinematics.isRunning);

    // Update HUD display
    this.updateHUD(state);

    // Update WebXR AR tracking
    this.xrManager.update(frame);

    // Update controls
    if (!this.renderer.xr.isPresenting) {
      this.controls.update();
    }

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Bootstrap application on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new EngineApp();
});
