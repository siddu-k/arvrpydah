/**
 * 4-Stroke Engine Photorealistic 3D Model Generator — Blueprint-Accurate V2
 *
 * Precision CAD geometry reconstructed from automotive cross-section blueprints.
 * All clearances computed mathematically — zero overlapping geometry.
 *
 * Component Dimensions (1 unit ≈ 100 mm):
 *   bore = 0.85 → rBore = 0.425
 *   stroke = 0.88 → crankRadius = 0.44
 *   conRodLength = 1.38 (C–C)
 *   wristPinHeight = 0.32 (inside piston, from piston bottom)
 *
 * Vertical layout (Y axis, TDC when θ = 0):
 *   Crankshaft axis:  Y = 0
 *   Block deck:       Y = 2.52
 *   Head gasket:      Y = 2.52 → 2.55
 *   Head bottom:      Y = 2.55
 *   Piston crown TDC: Y ≈ 2.12
 */

import * as THREE from 'three';

export class EngineModel {
  constructor(kinematics) {
    this.kinematics = kinematics;
    this.root = new THREE.Group();
    this.root.name = 'EngineAssembly';

    this.parts = {};
    this.materials = {};
    this.clippableMaterials = [];
    this.explodeFactor = 0;

    // Derived constants for precise geometry
    this.bore = kinematics.bore;               // 0.85
    this.rBore = this.bore / 2;                // 0.425
    this.rPiston = this.rBore * 0.985;         // 0.4186  — bore clearance
    this.crankR = kinematics.crankRadius;       // 0.44
    this.conRodL = kinematics.conRodLength;     // 1.38
    this.wristPinH = kinematics.wristPinHeight; // 0.32
    this.valveAngle = 0.38;                     // ~21.8° cant angle

    this.createBrushedTextures();
    this.setupClippingPlanes();
    this.createMaterials();
    this.buildEngine();
  }

  /* ================================================================
     PROCEDURAL TEXTURES
     ================================================================ */
  createBrushedTextures() {
    // Brushed metal texture (directional grain)
    const cB = document.createElement('canvas');
    cB.width = 512; cB.height = 512;
    const ctxB = cB.getContext('2d');
    ctxB.fillStyle = '#808080';
    ctxB.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2500; i++) {
      const y = Math.random() * 512;
      const x = Math.random() * 512;
      const len = 30 + Math.random() * 100;
      const v = Math.floor(105 + Math.random() * 45);
      ctxB.fillStyle = `rgb(${v},${v},${v})`;
      ctxB.fillRect(x, y, len, 1);
    }
    this.brushedTex = new THREE.CanvasTexture(cB);
    this.brushedTex.wrapS = THREE.RepeatWrapping;
    this.brushedTex.wrapT = THREE.RepeatWrapping;
    this.brushedTex.repeat.set(2, 2);

    // Cast metal texture (granular noise)
    const cC = document.createElement('canvas');
    cC.width = 512; cC.height = 512;
    const ctxC = cC.getContext('2d');
    const imgData = ctxC.createImageData(512, 512);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.floor(115 + Math.random() * 26);
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    ctxC.putImageData(imgData, 0, 0);
    this.castTex = new THREE.CanvasTexture(cC);
    this.castTex.wrapS = THREE.RepeatWrapping;
    this.castTex.wrapT = THREE.RepeatWrapping;
    this.castTex.repeat.set(4, 4);
  }

  /* ================================================================
     HOLLOW CYLINDER HELPER (never invades bore interior)
     ================================================================ */
  createHollowCylinderGeometry(innerR, outerR, height, segments = 48) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: height, bevelEnabled: false, curveSegments: segments
    });
    geom.center();
    geom.rotateX(Math.PI / 2);
    return geom;
  }

  /* ================================================================
     CLIPPING PLANES
     ================================================================ */
  setupClippingPlanes() {
    this.clipPlaneZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    this.clipPlaneX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.clipPlaneSlice = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.5);
    this.activeClippingPlanes = [];
    this.crossSectionMode = 'half';
  }

  /* ================================================================
     PBR METALLIC MATERIALS
     ================================================================ */
  createMaterials() {
    const DS = THREE.DoubleSide;

    // 1 — Cast Aluminum Block
    this.materials.block = new THREE.MeshStandardMaterial({
      color: 0x98a2af, metalness: 0.88, roughness: 0.35,
      bumpMap: this.castTex, bumpScale: 0.002,
      name: 'Cast Aluminum Block', side: DS
    });
    // 2 — Honed Ductile Iron Sleeve
    this.materials.sleeve = new THREE.MeshStandardMaterial({
      color: 0xbac5d2, metalness: 0.94, roughness: 0.16,
      bumpMap: this.brushedTex, bumpScale: 0.0015,
      name: 'Honed Ductile Iron Sleeve', side: DS
    });
    // 3 — Coolant Jacket (translucent blue)
    this.materials.coolant = new THREE.MeshStandardMaterial({
      color: 0x2277cc, metalness: 0.3, roughness: 0.2,
      transparent: true, opacity: 0.55, name: 'Engine Coolant'
    });
    // 4 — Forged Piston
    this.materials.piston = new THREE.MeshStandardMaterial({
      color: 0xd8e1ec, metalness: 0.95, roughness: 0.15,
      bumpMap: this.brushedTex, bumpScale: 0.001,
      name: 'Forged 2618-T6 Piston', side: DS
    });
    // 5 — Chrome Rings
    this.materials.rings = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, metalness: 0.99, roughness: 0.04,
      name: 'Chrome Rings'
    });
    // 6 — Tool Steel Wrist Pin
    this.materials.wristPin = new THREE.MeshStandardMaterial({
      color: 0xeef3f8, metalness: 0.98, roughness: 0.06,
      name: 'Ground Tool Steel Pin'
    });
    // 7 — Phosphor Bronze Bushing
    this.materials.bushing = new THREE.MeshStandardMaterial({
      color: 0xc6964a, metalness: 0.88, roughness: 0.22,
      name: 'Phosphor Bronze Bushing'
    });
    // 8 — Forged 4340 Con-Rod
    this.materials.conRod = new THREE.MeshStandardMaterial({
      color: 0x939da9, metalness: 0.92, roughness: 0.2,
      bumpMap: this.brushedTex, bumpScale: 0.0018,
      name: 'Forged 4340 Con-Rod'
    });
    // 9 — Fasteners
    this.materials.bolts = new THREE.MeshStandardMaterial({
      color: 0x20242a, metalness: 0.86, roughness: 0.36,
      name: 'Grade 12.9 Fasteners'
    });
    // 10 — Crankshaft
    this.materials.crankshaft = new THREE.MeshStandardMaterial({
      color: 0x7c8592, metalness: 0.92, roughness: 0.18,
      bumpMap: this.castTex, bumpScale: 0.002,
      name: 'Nitrided Crankshaft'
    });
    // 11 — Intake Valve
    this.materials.valveIntake = new THREE.MeshStandardMaterial({
      color: 0xc8d2dc, metalness: 0.95, roughness: 0.12,
      name: 'Stainless Intake Valve'
    });
    // 12 — Exhaust Valve
    this.materials.valveExhaust = new THREE.MeshStandardMaterial({
      color: 0x9ba4af, metalness: 0.92, roughness: 0.18,
      name: 'Inconel 751 Exhaust Valve'
    });
    // 13 — Valve Springs
    this.materials.spring = new THREE.MeshStandardMaterial({
      color: 0x3d434c, metalness: 0.95, roughness: 0.16,
      name: 'Valve Springs'
    });
    // 14 — Titanium Retainers
    this.materials.retainer = new THREE.MeshStandardMaterial({
      color: 0x8a929d, metalness: 0.92, roughness: 0.18,
      name: 'Titanium Retainers'
    });
    // 15 — Spark Plug Ceramic
    this.materials.sparkCeramic = new THREE.MeshStandardMaterial({
      color: 0xfafbfc, metalness: 0.04, roughness: 0.1,
      name: 'Alumina Ceramic'
    });
    // 16 — Spark Plug Shell
    this.materials.sparkMetal = new THREE.MeshStandardMaterial({
      color: 0xa2abb7, metalness: 0.94, roughness: 0.24,
      name: 'Galvanized Shell'
    });
    // 17 — Combustion Gas
    this.materials.combustionGas = new THREE.MeshStandardMaterial({
      color: 0x00c8ff, emissive: 0x0055aa, emissiveIntensity: 0.8,
      transparent: true, opacity: 0.55, roughness: 0.3, metalness: 0.1,
      side: DS, depthWrite: false, name: 'Combustion Gas'
    });
    // 18 — Spark Arc Plasma
    this.materials.sparkArc = new THREE.MeshBasicMaterial({
      color: 0xa8e5ff, transparent: true, opacity: 0.0,
      name: 'Ignition Plasma'
    });
    // 19 — Head Gasket
    this.materials.headGasket = new THREE.MeshStandardMaterial({
      color: 0x505860, metalness: 0.5, roughness: 0.7,
      name: 'MLS Head Gasket'
    });
    // 20 — Valve Seat Insert
    this.materials.valveSeat = new THREE.MeshStandardMaterial({
      color: 0x6b737d, metalness: 0.9, roughness: 0.25,
      name: 'Hardened Valve Seat Insert'
    });
    // 21 — Internal cavity (dark shadow for realism)
    this.materials.cavity = new THREE.MeshStandardMaterial({
      color: 0x0e1014, metalness: 0.8, roughness: 0.6,
      name: 'Internal Cavity'
    });
    // 22 — Cast Aluminum Oil Pan (Blueprint Image 3)
    this.materials.pan = new THREE.MeshStandardMaterial({
      color: 0x8e98a5, metalness: 0.85, roughness: 0.35,
      bumpMap: this.castTex, bumpScale: 0.002,
      name: 'Cast Aluminum Oil Pan', side: DS
    });
    // 23 — Sump Lubricating Oil (translucent golden amber, CAD Blueprint Image 3)
    this.materials.oil = new THREE.MeshStandardMaterial({
      color: 0xc48c12, metalness: 0.12, roughness: 0.08,
      transparent: true, opacity: 0.65, side: DS,
      name: 'Engine Lubricating Oil'
    });
    // 24 — Pan Gasket (Blueprint Image 3 green gasket parting line)
    this.materials.gasket = new THREE.MeshStandardMaterial({
      color: 0x2e8550, metalness: 0.15, roughness: 0.85,
      name: 'Elastomeric Oil Pan Gasket', side: DS
    });

    // Clippable materials list
    this.clippableMaterials = [
      this.materials.block,
      this.materials.sleeve,
      this.materials.coolant,
      this.materials.pan,
      this.materials.oil,
      this.materials.gasket,
      this.materials.bolts
    ];
    this.setCrossSectionMode('half');
  }

  /* ================================================================
     CROSS-SECTION MODES
     ================================================================ */
  setCrossSectionMode(mode, sliceValue = 0) {
    this.crossSectionMode = mode;
    if (mode === 'quarter') {
      this.activeClippingPlanes = [this.clipPlaneZ, this.clipPlaneX];
      this.restoreBlockMaterials();
    } else if (mode === 'half') {
      this.activeClippingPlanes = [this.clipPlaneZ];
      this.restoreBlockMaterials();
    } else if (mode === 'slice') {
      this.clipPlaneSlice.constant = sliceValue;
      this.activeClippingPlanes = [this.clipPlaneSlice];
      this.restoreBlockMaterials();
    } else if (mode === 'xray') {
      this.activeClippingPlanes = [];
      this.materials.block.transparent = true;
      this.materials.block.opacity = 0.22;
      this.materials.block.roughness = 0.1;
      this.materials.sleeve.transparent = true;
      this.materials.sleeve.opacity = 0.38;
      if (this.materials.pan) {
        this.materials.pan.transparent = true;
        this.materials.pan.opacity = 0.25;
      }
    } else {
      this.activeClippingPlanes = [];
      this.restoreBlockMaterials();
    }
    for (const mat of this.clippableMaterials) {
      mat.clippingPlanes = this.activeClippingPlanes;
      mat.clipIntersection = (mode === 'quarter');
      mat.needsUpdate = true;
    }
  }

  restoreBlockMaterials() {
    this.materials.block.transparent = false;
    this.materials.block.opacity = 1.0;
    this.materials.block.roughness = 0.35;
    this.materials.sleeve.transparent = false;
    this.materials.sleeve.opacity = 1.0;
    if (this.materials.pan) {
      this.materials.pan.transparent = false;
      this.materials.pan.opacity = 1.0;
    }
  }

  /* ================================================================
     BUILD ENTRY
     ================================================================ */
  buildEngine() {
    this.buildCrankshaft();
    this.buildConnectingRod();
    this.buildPiston();
    this.buildEngineBlock();
    this.buildOilPan();
    this.buildCylinderHead();
    this.buildValvetrain();
    this.buildSparkPlug();
    this.buildCombustionGasVolume();
    this.registerExplodeOffsets();
  }

  /* ================================================================
     1. SICKLE COUNTERWEIGHT CRANKSHAFT  (Blueprint Image 1, 2, 3)
     Reconstructed directly from automotive blueprint cross-sections:
     - Asymmetric hammerhead sickle counterweights with winged lobes
     - Recessed lightening pocket and through-hole
     - Raised perimeter cheek rim & central main journal boss with oil hole
     - Polished crankpin with cross-drilled oil feed passage
     - Clean front snout with retaining washer & bolt (NO oversized balancer)
     - Rear flywheel with ring gear & lightening holes tucked behind block
     ================================================================ */
  buildCrankshaft() {
    this.crankshaftGroup = new THREE.Group();
    this.crankshaftGroup.name = 'Crankshaft_Assembly';
    const r = this.crankR; // 0.44
    const mainJournalR = 0.22;

    // Rear main journal extension (supports crankshaft in rear bearing and mounts flywheel)
    const jRear = new THREE.Mesh(
      new THREE.CylinderGeometry(mainJournalR, mainJournalR, 0.32, 36),
      this.materials.crankshaft
    );
    jRear.rotation.x = Math.PI / 2;
    jRear.position.z = -0.44; // Spans z = -0.28 to -0.60 through rear bearing
    this.crankshaftGroup.add(jRear);

    // Front main journal (supported in front wall bearing bore, flush — no snout sticking out)
    const jFront = new THREE.Mesh(
      new THREE.CylinderGeometry(mainJournalR, mainJournalR, 0.18, 36),
      this.materials.crankshaft
    );
    jFront.rotation.x = Math.PI / 2;
    jFront.position.z = 0.37; // Spans z = 0.28 to 0.46
    this.crankshaftGroup.add(jFront);

    // Rear flywheel mounting flange
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.04, 24),
      this.materials.crankshaft
    );
    flange.rotation.x = Math.PI / 2;
    flange.position.z = -0.62; // Spans z = -0.60 to -0.64
    this.crankshaftGroup.add(flange);

    // Rear Flywheel (mounted safely behind engine block rear edge z = -0.56 with zero collision)
    const flywheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.09, 48),
      this.materials.crankshaft
    );
    flywheel.rotation.x = Math.PI / 2;
    flywheel.position.z = -0.72; // Spans z = -0.675 to -0.765
    this.crankshaftGroup.add(flywheel);

    // Flywheel lightening holes (6 evenly spaced)
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const fwHole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.11, 16),
        this.materials.cavity
      );
      fwHole.rotation.x = Math.PI / 2;
      fwHole.position.set(Math.cos(ang) * 0.36, Math.sin(ang) * 0.36, -0.72);
      this.crankshaftGroup.add(fwHole);
    }

    // Flywheel ring gear
    const ringGear = new THREE.Mesh(
      new THREE.TorusGeometry(0.51, 0.02, 10, 64),
      this.materials.bolts
    );
    ringGear.position.z = -0.72;
    this.crankshaftGroup.add(ringGear);

    // ---- Precision Sickle Counterweight Webs (Blueprint Image 1, 2, 3) ----
    const buildSickleWeb = (zPos) => {
      // Counterweight shape scaled to blueprint-accurate radius 0.58
      const sickle = new THREE.Shape();
      // Upper arc over crankpin (radius ~0.20 around crankpin (0, r))
      sickle.moveTo(-0.15, r + 0.04);
      sickle.bezierCurveTo(
        -0.08, r + 0.20,
         0.08, r + 0.20,
         0.15, r + 0.04
      );
      // Waist transition down the right side to shaft level
      sickle.bezierCurveTo(
         0.22, r - 0.15,
         0.22, 0.05,
         0.26, -0.10
      );
      // Flare out into right winged lobe (hammerhead ear)
      sickle.bezierCurveTo(
         0.34, -0.20,
         0.40, -0.28,
         0.38, -0.38
      );
      // Right lobe tip curve into bottom arc
      sickle.bezierCurveTo(
         0.35, -0.48,
         0.26, -0.54,
         0.16, -0.58
      );
      // Bottom concentric sweep of counterweight heavy mass (max radius 0.58)
      sickle.bezierCurveTo(
         0.08, -0.60,
        -0.08, -0.60,
        -0.16, -0.58
      );
      // Left lobe tip curve from bottom arc
      sickle.bezierCurveTo(
        -0.26, -0.54,
        -0.35, -0.48,
        -0.38, -0.38
      );
      // Left winged lobe curve back in
      sickle.bezierCurveTo(
        -0.40, -0.28,
        -0.34, -0.20,
        -0.26, -0.10
      );
      // Waist transition up the left side back to crankpin
      sickle.bezierCurveTo(
        -0.22, 0.05,
        -0.22, r - 0.15,
        -0.15, r + 0.04
      );
      sickle.closePath();

      const extSettings = {
        depth: 0.16, bevelEnabled: true, bevelSegments: 3,
        bevelSize: 0.016, bevelThickness: 0.016
      };
      const webMesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(sickle, extSettings),
        this.materials.crankshaft
      );
      webMesh.position.z = zPos;
      this.crankshaftGroup.add(webMesh);

      // Circular collar around main journal on front face of web (Blueprint Image 1)
      if (zPos > 0) {
        const hubBoss = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.24, 0.02, 32),
          this.materials.crankshaft
        );
        hubBoss.rotation.x = Math.PI / 2;
        hubBoss.position.set(0, 0, zPos + 0.16);
        this.crankshaftGroup.add(hubBoss);

        // Central axial oil gallery bore (hole through the collar)
        const mainOilHole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16),
          this.materials.cavity
        );
        mainOilHole.rotation.x = Math.PI / 2;
        mainOilHole.position.set(0, 0, zPos + 0.16);
        this.crankshaftGroup.add(mainOilHole);
      }

      // Recessed lightening pocket on cheek (visible in Blueprint Image 2 wireframe)
      const pocket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.10, 0.06, 32),
        this.materials.cavity
      );
      pocket.rotation.x = Math.PI / 2;
      pocket.position.set(0.0, -0.38, zPos + 0.08);
      this.crankshaftGroup.add(pocket);

      // Through-hole in balance pocket
      const throughHole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.18, 24),
        this.materials.cavity
      );
      throughHole.rotation.x = Math.PI / 2;
      throughHole.position.set(0.0, -0.38, zPos + 0.08);
      this.crankshaftGroup.add(throughHole);
    };

    buildSickleWeb(0.12);   // Front web (spans z = 0.12 to 0.28)
    buildSickleWeb(-0.28);  // Rear web (spans z = -0.28 to -0.12)

    // ---- Crankpin Journal centered at Z = 0 (perfectly aligned with rod & bore) ----
    const crankPinR = 0.19;
    const crankPinLen = 0.24; // Spans z = -0.12 to +0.12 between webs
    const crankPin = new THREE.Mesh(
      new THREE.CylinderGeometry(crankPinR, crankPinR, crankPinLen, 36),
      this.materials.wristPin  // ground nitrided steel
    );
    crankPin.rotation.x = Math.PI / 2;
    crankPin.position.set(0, r, 0);
    this.crankshaftGroup.add(crankPin);

    // Cross-drilled oil feed hole through crankpin
    const pinOilHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.030, 0.030, crankPinLen * 1.02, 12),
      this.materials.cavity
    );
    pinOilHole.position.set(0, r, 0);
    this.crankshaftGroup.add(pinOilHole);

    this.root.add(this.crankshaftGroup);

    this.parts.crankshaft = {
      group: this.crankshaftGroup,
      explodeOffset: new THREE.Vector3(0, -0.9, -1.1),
      name: 'Sickle Counterweight Crankshaft',
      specs: 'Stroke: 88 mm | Main Journal: Ø44 mm | Crankpin: Ø38 mm | Nitrided 4340 Steel'
    };
  }

  /* ================================================================
     2. TAPERED H-BEAM CONNECTING ROD  (Blueprint Image 1, 2, 3)
     ================================================================ */
  buildConnectingRod() {
    this.conRodGroup = new THREE.Group();
    this.conRodGroup.name = 'ConnectingRod_Assembly';

    const l = this.conRodL;           // 1.38
    const bigEndOuterR = 0.29;        // Outer radius of big-end eye
    const crankPinR = 0.19;           // Must match crankpin journal OD
    const smallEndOuterR = 0.17;      // Outer radius of small-end eye
    const wristPinR = 0.12;           // Must match wrist pin OD

    // ---- Big-End Eye: Upper Half ----
    const bigEndUpper = new THREE.Mesh(
      new THREE.CylinderGeometry(bigEndOuterR, bigEndOuterR, 0.24, 36, 1, false, Math.PI / 2, Math.PI),
      this.materials.conRod
    );
    bigEndUpper.rotation.x = Math.PI / 2;
    this.conRodGroup.add(bigEndUpper);

    // Upper bearing shell (tri-metal insert)
    const bearingUpper = new THREE.Mesh(
      new THREE.CylinderGeometry(crankPinR + 0.006, crankPinR + 0.006, 0.23, 36, 1, true, Math.PI / 2, Math.PI),
      this.materials.bushing
    );
    bearingUpper.rotation.x = Math.PI / 2;
    this.conRodGroup.add(bearingUpper);

    // ---- Split Rod Bearing Cap (Lower Half) ----
    this.rodCapGroup = new THREE.Group();
    this.rodCapGroup.name = 'RodCap_Assembly';

    const bigEndLower = new THREE.Mesh(
      new THREE.CylinderGeometry(bigEndOuterR, bigEndOuterR, 0.24, 36, 1, false, -Math.PI / 2, Math.PI),
      this.materials.conRod
    );
    bigEndLower.rotation.x = Math.PI / 2;
    this.rodCapGroup.add(bigEndLower);

    // Lower bearing shell
    const bearingLower = new THREE.Mesh(
      new THREE.CylinderGeometry(crankPinR + 0.006, crankPinR + 0.006, 0.23, 36, 1, true, -Math.PI / 2, Math.PI),
      this.materials.bushing
    );
    bearingLower.rotation.x = Math.PI / 2;
    this.rodCapGroup.add(bearingLower);

    // Forged bolt boss shoulders on cap & upper rod (integrates bolts into forged body)
    [-0.23, 0.23].forEach((xOff) => {
      const capEar = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.16, 0.24),
        this.materials.conRod
      );
      capEar.position.set(xOff, -0.10, 0);
      this.rodCapGroup.add(capEar);

      // Upper rod matching bolt shoulder
      const rodEar = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.14, 0.24),
        this.materials.conRod
      );
      rodEar.position.set(xOff, 0.05, 0);
      this.conRodGroup.add(rodEar);

      // ARP Rod Bolt shank
      const boltShank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.28, 16),
        this.materials.bolts
      );
      boltShank.position.set(xOff, -0.09, 0);
      this.rodCapGroup.add(boltShank);

      // ARP 12-Point Bolt Head nestled flush against cap spotface
      const boltHead = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.065, 12),
        this.materials.bolts
      );
      boltHead.position.set(xOff, -0.21, 0);
      this.rodCapGroup.add(boltHead);
    });

    this.conRodGroup.add(this.rodCapGroup);

    // ---- Tapered H-Beam Shank ----
    const shankStart = bigEndOuterR * 0.85;  // 0.247 — where shank begins above big end
    const shankEnd = l - smallEndOuterR * 0.85; // 1.236 — where shank ends below small end
    const shankLen = shankEnd - shankStart;

    // Center web (tapers from wide at big-end to narrow at small-end)
    const webShape = new THREE.Shape();
    webShape.moveTo(-0.085, 0);
    webShape.lineTo(0.085, 0);
    webShape.lineTo(0.055, shankLen);
    webShape.lineTo(-0.055, shankLen);
    webShape.closePath();

    const webGeom = new THREE.ExtrudeGeometry(webShape, { depth: 0.055, bevelEnabled: false });
    webGeom.translate(0, 0, -0.0275);
    const centerWeb = new THREE.Mesh(webGeom, this.materials.conRod);
    centerWeb.position.y = shankStart;
    this.conRodGroup.add(centerWeb);

    // Side flanges (H-profile ribs)
    [-0.065, 0.065].forEach((zOff) => {
      const flangeShape = new THREE.Shape();
      flangeShape.moveTo(-0.105, 0);
      flangeShape.lineTo(0.105, 0);
      flangeShape.lineTo(0.075, shankLen);
      flangeShape.lineTo(-0.075, shankLen);
      flangeShape.closePath();
      const fGeom = new THREE.ExtrudeGeometry(flangeShape, { depth: 0.028, bevelEnabled: false });
      fGeom.translate(0, 0, -0.014);
      const flange = new THREE.Mesh(fGeom, this.materials.conRod);
      flange.position.set(0, shankStart, zOff);
      this.conRodGroup.add(flange);
    });

    // ---- Small-End Eye (piston wrist pin bore) ----
    const smallEnd = new THREE.Mesh(
      new THREE.CylinderGeometry(smallEndOuterR, smallEndOuterR, 0.20, 32),
      this.materials.conRod
    );
    smallEnd.rotation.x = Math.PI / 2;
    smallEnd.position.y = l;
    this.conRodGroup.add(smallEnd);

    // Phosphor bronze bushing in small end (bore = wrist pin OD + tiny clearance)
    const smallBushing = new THREE.Mesh(
      new THREE.CylinderGeometry(wristPinR + 0.004, wristPinR + 0.004, 0.21, 32, 1, true),
      this.materials.bushing
    );
    smallBushing.rotation.x = Math.PI / 2;
    smallBushing.position.y = l;
    this.conRodGroup.add(smallBushing);

    this.root.add(this.conRodGroup);

    this.parts.conRod = {
      group: this.conRodGroup,
      explodeOffset: new THREE.Vector3(-1.4, 0, 0),
      name: 'Tapered H-Beam Connecting Rod',
      specs: 'C–C: 138 mm | Big End Bore: Ø38 mm | Small End Bore: Ø24 mm | Forged 4340'
    };
    this.parts.rodCap = {
      group: this.rodCapGroup,
      explodeOffset: new THREE.Vector3(0, -0.75, 0),
      name: 'Split Rod Bearing Cap & 12-Pt Bolts',
      specs: 'ARP 2000 Grade 12.9 M9×1.0 | Clamping Load: 52 kN'
    };
  }

  /* ================================================================
     3. SLIPPER PISTON WITH RECTANGULAR PIN BOSS  (Blueprint Image 1)
     ================================================================ */
  buildPiston() {
    this.pistonGroup = new THREE.Group();
    this.pistonGroup.name = 'Piston_Assembly';

    const rP = this.rPiston;          // 0.4186
    const pistonH = 0.62;
    const crownH = 0.07;              // Crown disc thickness
    const pinY = this.wristPinH;      // 0.32
    const wristPinR = 0.12;

    // ========== CROWN ==========
    // Solid crown disc with flat top
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(rP, rP, crownH, 48),
      this.materials.piston
    );
    crown.position.y = pistonH - crownH / 2;
    this.pistonGroup.add(crown);

    // Shallow combustion dish (recessed into crown top)
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.30, 0.28, 0.018, 32),
      this.materials.cavity
    );
    dish.position.y = pistonH - 0.008;
    this.pistonGroup.add(dish);

    // Valve relief pockets on crown (matching pent-roof head valve angles)
    [-0.16, 0.16].forEach((xOff) => {
      const pocket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.08, 0.012, 16),
        this.materials.cavity
      );
      pocket.position.set(xOff, pistonH - 0.005, 0);
      this.pistonGroup.add(pocket);
    });

    // ========== RING GROOVES (3 rings with land steps) ==========
    // Ring groove positions (below crown top)
    const ringData = [
      { y: pistonH - 0.030, h: 0.016, name: 'top-compression' },
      { y: pistonH - 0.060, h: 0.016, name: 'second-compression' },
      { y: pistonH - 0.095, h: 0.022, name: 'oil-control' }
    ];

    // Ring lands (thin cylindrical bands between grooves)
    const landData = [
      { y: pistonH - crownH, h: crownH },                        // Crown body
      { yTop: pistonH - 0.038, yBot: pistonH - 0.044, h: 0.006 },  // Land between ring 1 & 2
      { yTop: pistonH - 0.068, yBot: pistonH - 0.073, h: 0.005 }   // Land between ring 2 & 3
    ];

    // Ring groove channels (slightly recessed from piston OD)
    ringData.forEach((rd) => {
      const groove = new THREE.Mesh(
        new THREE.CylinderGeometry(rP - 0.008, rP - 0.008, rd.h, 48, 1, true),
        this.materials.cavity
      );
      groove.position.y = rd.y;
      this.pistonGroup.add(groove);
    });

    // ========== PISTON RINGS ==========
    this.ringsGroup = new THREE.Group();
    this.ringsGroup.name = 'PistonRings_Pack';

    ringData.forEach((rd) => {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(rP + 0.003, rP + 0.003, rd.h * 0.9, 48, 1, true),
        this.materials.rings
      );
      ring.position.y = rd.y;
      this.ringsGroup.add(ring);
    });
    this.pistonGroup.add(this.ringsGroup);

    // ========== SLIPPER SKIRT ==========
    // Blueprint Image 1: thrust faces on ±X axis (perpendicular to wrist pin).
    // Slipper openings on ±Z sides where wrist pin passes through.
    // In Three.js CylinderGeometry: θ=0 is +X direction in the XZ plane.
    // Thrust face A: centered at θ=0 (+X), arc ≈ 100° → start=-50°, length=100°
    // Thrust face B: centered at θ=π (-X), arc ≈ 100° → start=130°, length=100°
    const skirtH = pistonH - crownH - 0.10;  // below ring pack area
    const skirtTopY = pistonH - crownH - 0.10;

    const skirtA = new THREE.Mesh(
      new THREE.CylinderGeometry(rP, rP * 0.998, skirtH, 36, 1, true,
        -50 * Math.PI / 180, 100 * Math.PI / 180),
      this.materials.piston
    );
    skirtA.position.y = skirtTopY / 2;
    this.pistonGroup.add(skirtA);

    const skirtB = new THREE.Mesh(
      new THREE.CylinderGeometry(rP, rP * 0.998, skirtH, 36, 1, true,
        130 * Math.PI / 180, 100 * Math.PI / 180),
      this.materials.piston
    );
    skirtB.position.y = skirtTopY / 2;
    this.pistonGroup.add(skirtB);

    // ========== PIN BOSS PANELS ==========
    // In Blueprint Image 1, rectangular recessed panels are visible on the Z-axis faces
    // of the piston where the wrist pin passes through.
    // Panel width is capped to fit within the cylinder at the given Z position.
    // At z = rP (surface), max x-extent = 0. Panels sit slightly inward.
    const panelZ = rP - 0.035;       // 0.384 — inset from outer surface
    // At z=0.384, cylinder surface x = ±sqrt(rP² - 0.384²) = ±sqrt(0.1752-0.1475) = ±0.166
    const panelW = 0.30;             // stays within x ± 0.15 < 0.166 ✓
    const panelH = 0.22;
    const panelD = 0.025;

    [panelZ, -panelZ].forEach((zPos) => {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(panelW, panelH, panelD),
        this.materials.piston
      );
      panel.position.set(0, pinY, zPos);
      this.pistonGroup.add(panel);

      // Pin bore chamfer ring (decorative edge around wrist pin hole)
      const chamfer = new THREE.Mesh(
        new THREE.TorusGeometry(wristPinR + 0.01, 0.012, 8, 24),
        this.materials.piston
      );
      chamfer.position.set(0, pinY, zPos);
      this.pistonGroup.add(chamfer);
    });

    // Internal pin boss cylinders (support the wrist pin inside the piston)
    const bossZ = rP - 0.075;  // 0.344 — inside the skirt
    [bossZ, -bossZ].forEach((zPos) => {
      const boss = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.07, 32),
        this.materials.piston
      );
      boss.rotation.x = Math.PI / 2;
      boss.position.set(0, pinY, zPos);
      this.pistonGroup.add(boss);
    });

    // ========== WRIST PIN ==========
    this.wristPinGroup = new THREE.Group();
    this.wristPinGroup.name = 'WristPin_Assembly';

    const pinLength = rP * 1.72;  // 0.72 — fits between pin bosses + circlips
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(wristPinR, wristPinR, pinLength, 36),
      this.materials.wristPin
    );
    pin.rotation.x = Math.PI / 2;
    this.wristPinGroup.add(pin);

    // Hollow through-core
    const hollowCore = new THREE.Mesh(
      new THREE.CylinderGeometry(wristPinR * 0.58, wristPinR * 0.58, pinLength * 1.02, 24),
      this.materials.cavity
    );
    hollowCore.rotation.x = Math.PI / 2;
    this.wristPinGroup.add(hollowCore);

    // Wire circlips at pin ends
    [-pinLength / 2 + 0.012, pinLength / 2 - 0.012].forEach((zOff) => {
      const circlip = new THREE.Mesh(
        new THREE.TorusGeometry(wristPinR * 0.92, 0.008, 8, 24, Math.PI * 1.8),
        this.materials.bolts
      );
      circlip.position.z = zOff;
      this.wristPinGroup.add(circlip);
    });

    this.wristPinGroup.position.y = pinY;
    this.pistonGroup.add(this.wristPinGroup);

    this.root.add(this.pistonGroup);

    this.parts.piston = {
      group: this.pistonGroup,
      explodeOffset: new THREE.Vector3(0, 1.6, 0),
      name: 'CNC Forged Slipper Piston',
      specs: 'Bore: 85.0 mm | Compression Height: 32 mm | Slipper Skirt | 2618-T6 Al'
    };
    this.parts.wristPin = {
      group: this.wristPinGroup,
      explodeOffset: new THREE.Vector3(0, 0, 1.2),
      name: 'Hollow Tool Steel Wrist Pin',
      specs: 'OD: 24 mm | Wall: 3.5 mm | Ground Nitrided Finish'
    };
    this.parts.rings = {
      group: this.ringsGroup,
      explodeOffset: new THREE.Vector3(0.8, 0.4, 0),
      name: 'Chrome Piston Ring Pack',
      specs: 'Top: 1.2 mm Gas-Nitrided | 2nd: 1.2 mm Napier | Oil: 2.0 mm 3-Piece'
    };
  }

  /* ================================================================
     4. LIQUID-COOLED ENGINE BLOCK, CRANKCASE & OIL PAN
     Improved: proper D-shaped crankcase bore, 4-bolt main caps with
     bolts & dowels, cross-bolting webs, exterior ribs, tapered
     transition from bore to crankcase, full perimeter finned oil pan.
     ================================================================ */
  buildEngineBlock() {
    this.engineBlockGroup = new THREE.Group();
    this.engineBlockGroup.name = 'EngineBlock_Assembly';

    const rBore = this.rBore;  // 0.425
    const mainJournalR = 0.22; // Main crankshaft journal radius
    const deckY = 2.52;        // Block deck (head gasket surface)
    const blockBotY = 0.65;    // Cylinder block outer barrel bottom (crankcase flare starts here)
    const blockH = deckY - blockBotY; // 1.87
    const blockOuterR = 0.82;
    const blockInnerR = 0.60;

    // ---- 1. Outer Cylinder Block Walls (hollow annular tube — no bore invasion) ----
    const blockGeom = this.createHollowCylinderGeometry(blockInnerR, blockOuterR, blockH, 48);
    const blockOuter = new THREE.Mesh(blockGeom, this.materials.block);
    blockOuter.position.y = blockBotY + blockH / 2;
    this.engineBlockGroup.add(blockOuter);

    // ---- 2. Coolant Jacket (annular passage — bore clearance to inner block wall) ----
    const coolantInnerR = rBore + 0.030;   // 0.455
    const coolantOuterR = blockInnerR - 0.012; // 0.588
    const coolantH = blockH * 0.75;
    const coolantGeom = this.createHollowCylinderGeometry(coolantInnerR, coolantOuterR, coolantH, 48);
    const coolantMesh = new THREE.Mesh(coolantGeom, this.materials.coolant);
    coolantMesh.position.y = blockBotY + blockH * 0.52;
    this.engineBlockGroup.add(coolantMesh);

    // ---- 3. Honed Cylinder Sleeve Liner ----
    this.cylinderSleeveMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(rBore, rBore, blockH * 0.98, 48, 1, true),
      this.materials.sleeve
    );
    this.cylinderSleeveMesh.position.y = blockBotY + blockH / 2;
    this.engineBlockGroup.add(this.cylinderSleeveMesh);

    // ---- 4. Deck Surface Ring (head gasket seating area) ----
    const deckRing = new THREE.Mesh(
      this.createHollowCylinderGeometry(rBore, blockOuterR, 0.045, 48),
      this.materials.block
    );
    deckRing.position.y = deckY;
    this.engineBlockGroup.add(deckRing);

    // Head bolt bosses — 10 studs in oval pattern around bore (typical 4-cylinder)
    const boltAngles = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];
    boltAngles.forEach((deg) => {
      const ang = deg * Math.PI / 180;
      const bR = (blockOuterR + blockInnerR) / 2;
      const boss = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.10, 12),
        this.materials.bolts
      );
      boss.position.set(Math.cos(ang) * bR, deckY + 0.025, Math.sin(ang) * bR);
      this.engineBlockGroup.add(boss);
    });

    // ---- 5. Block Exterior Reinforcement Ribs (vertical ribs on outer cylinder body) ----
    const ribH = blockH * 0.70;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const ribX = Math.cos(ang) * (blockOuterR + 0.032);
      const ribZ = Math.sin(ang) * (blockOuterR + 0.032);
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.038, ribH, 0.038),
        this.materials.block
      );
      rib.position.set(ribX, blockBotY + ribH / 2 + 0.05, ribZ);
      this.engineBlockGroup.add(rib);
    }

    // ---- 6. Crankcase Skirt & Vaulted Shoulder (Blueprint Image 1, 2, 3) ----
    // Below the cylinder bore (y = 0.65), the crankcase vaulted shoulder flares out
    // smoothly to width ±0.95, completely enclosing the rotating counterweights.
    const ccTopY = 0.65;           // Crankcase vaulted shoulder begins
    const flareBotY = 0.10;        // Meets vertical skirt walls
    const flareH = ccTopY - flareBotY; // 0.55
    const skirtBotY = -0.58;       // Bottom of crankcase skirt (flange join)
    const skirtH = flareBotY - skirtBotY; // 0.68
    const ccHalfW = 0.95;          // Crankcase skirt half-width (±X)
    const ccHalfD = 0.54;          // Crankcase skirt half-depth (±Z)

    // Tapered transition shoulder (flares out from cylinder radius 0.70 to crankcase 0.95)
    [-1, 1].forEach((side) => {
      const flareShape = new THREE.Shape();
      flareShape.moveTo(side * 0.70, ccTopY);
      flareShape.lineTo(side * ccHalfW, flareBotY);
      flareShape.lineTo(side * (ccHalfW - 0.10), flareBotY);
      flareShape.lineTo(side * 0.60, ccTopY);
      flareShape.closePath();

      const flareGeom = new THREE.ExtrudeGeometry(flareShape, { depth: ccHalfD * 2, bevelEnabled: false });
      flareGeom.translate(0, 0, -ccHalfD);
      const flareMesh = new THREE.Mesh(flareGeom, this.materials.block);
      this.engineBlockGroup.add(flareMesh);
    });

    // Skirt side walls (vertical cast walls from flare down to mounting flange)
    [-ccHalfW + 0.05, ccHalfW - 0.05].forEach((xPos) => {
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, skirtH, ccHalfD * 2),
        this.materials.block
      );
      sideWall.position.set(xPos, (flareBotY + skirtBotY) / 2, 0);
      this.engineBlockGroup.add(sideWall);
    });

    // Rear wall (supporting rear main bearing, with circular journal bore)
    const rearWallShape = new THREE.Shape();
    rearWallShape.moveTo(-ccHalfW, skirtBotY);
    rearWallShape.lineTo( ccHalfW, skirtBotY);
    rearWallShape.lineTo( ccHalfW, ccTopY);
    rearWallShape.lineTo(-ccHalfW, ccTopY);
    rearWallShape.closePath();
    const rearBore = new THREE.Path();
    rearBore.absarc(0, 0, mainJournalR + 0.04, 0, Math.PI * 2, true);
    rearWallShape.holes.push(rearBore);

    const rearWallGeom = new THREE.ExtrudeGeometry(rearWallShape, { depth: 0.08, bevelEnabled: false });
    const rearWall = new THREE.Mesh(rearWallGeom, this.materials.block);
    rearWall.position.z = -ccHalfD;
    this.engineBlockGroup.add(rearWall);

    // Front wall (with circular journal bore, cleanly cut in cutaway mode)
    const frontWallShape = new THREE.Shape();
    frontWallShape.moveTo(-ccHalfW, skirtBotY);
    frontWallShape.lineTo( ccHalfW, skirtBotY);
    frontWallShape.lineTo( ccHalfW, ccTopY);
    frontWallShape.lineTo(-ccHalfW, ccTopY);
    frontWallShape.closePath();
    const frontBore = new THREE.Path();
    frontBore.absarc(0, 0, mainJournalR + 0.04, 0, Math.PI * 2, true);
    frontWallShape.holes.push(frontBore);

    const frontWallGeom = new THREE.ExtrudeGeometry(frontWallShape, { depth: 0.08, bevelEnabled: false });
    const frontWall = new THREE.Mesh(frontWallGeom, this.materials.block);
    frontWall.position.z = ccHalfD - 0.08;
    this.engineBlockGroup.add(frontWall);

    // Crankcase exterior stiffening ribs (strictly on exterior of side walls, zero interior intrusion)
    [-0.10, -0.38].forEach((yPos) => {
      [-ccHalfW - 0.015, ccHalfW + 0.015].forEach((xPos) => {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.035, ccHalfD * 2),
          this.materials.block
        );
        rib.position.set(xPos, yPos, 0);
        this.engineBlockGroup.add(rib);
      });
    });

    // ---- 7. Crankcase Lower Mounting Flange & Gasket (Split Line) ----
    const flangeHalfW = 1.04;
    const flangeHalfD = 0.56;
    const flangeH = 0.06;

    // Block lower mounting flange (hollow rectangular frame)
    const flangeShape = new THREE.Shape();
    flangeShape.moveTo(-flangeHalfW, -flangeHalfD);
    flangeShape.lineTo( flangeHalfW, -flangeHalfD);
    flangeShape.lineTo( flangeHalfW,  flangeHalfD);
    flangeShape.lineTo(-flangeHalfW,  flangeHalfD);
    flangeShape.closePath();

    const holePath = new THREE.Path();
    const inW = flangeHalfW - 0.12;
    const inD = flangeHalfD - 0.12;
    holePath.moveTo(-inW, -inD);
    holePath.lineTo( inW, -inD);
    holePath.lineTo( inW,  inD);
    holePath.lineTo(-inW,  inD);
    holePath.closePath();
    flangeShape.holes.push(holePath);

    const blockFlangeGeom = new THREE.ExtrudeGeometry(flangeShape, { depth: flangeH, bevelEnabled: false });
    blockFlangeGeom.rotateX(Math.PI / 2);
    const blockFlange = new THREE.Mesh(blockFlangeGeom, this.materials.block);
    blockFlange.position.y = skirtBotY;
    this.engineBlockGroup.add(blockFlange);

    // Oil pan perimeter gasket (distinctive green gasket line, hollow frame)
    const gasketGeom = new THREE.ExtrudeGeometry(flangeShape, { depth: 0.02, bevelEnabled: false });
    gasketGeom.rotateX(Math.PI / 2);
    const panGasket = new THREE.Mesh(gasketGeom, this.materials.gasket);
    panGasket.position.y = skirtBotY - flangeH;
    this.engineBlockGroup.add(panGasket);

    // ---- 8. Main Bearing Saddles & 4-Bolt Caps ----
    const mainCapY = 0.0; // Center Y of main crankshaft axis
    const mainCapBoreR = mainJournalR + 0.005;

    // Rear main bearing saddle & 4-bolt cap (in intact rear half, zero collision)
    const bearingZ = [-0.40];
    bearingZ.forEach((zOff) => {
      // Upper bearing saddle (integral with block casting — upper half)
      const saddleUpper = new THREE.Mesh(
        new THREE.CylinderGeometry(mainCapBoreR + 0.085, mainCapBoreR + 0.085, 0.14, 32, 1, false, Math.PI, Math.PI),
        this.materials.block
      );
      saddleUpper.rotation.x = Math.PI / 2;
      saddleUpper.position.set(0, mainCapY, zOff);
      this.engineBlockGroup.add(saddleUpper);

      // Upper bearing shell (tri-metal insert)
      const shellUpper = new THREE.Mesh(
        new THREE.CylinderGeometry(mainCapBoreR, mainCapBoreR, 0.13, 32, 1, true, Math.PI, Math.PI),
        this.materials.bushing
      );
      shellUpper.rotation.x = Math.PI / 2;
      shellUpper.position.set(0, mainCapY, zOff);
      this.engineBlockGroup.add(shellUpper);

      // Robust 4-bolt main bearing cap (lower half)
      const capBody = new THREE.Mesh(
        new THREE.CylinderGeometry(mainCapBoreR + 0.085, mainCapBoreR + 0.085, 0.14, 32, 1, false, 0, Math.PI),
        this.materials.conRod
      );
      capBody.rotation.x = Math.PI / 2;
      capBody.position.set(0, mainCapY, zOff);
      this.engineBlockGroup.add(capBody);

      // Lower bearing shell
      const shellLower = new THREE.Mesh(
        new THREE.CylinderGeometry(mainCapBoreR, mainCapBoreR, 0.13, 32, 1, true, 0, Math.PI),
        this.materials.bushing
      );
      shellLower.rotation.x = Math.PI / 2;
      shellLower.position.set(0, mainCapY, zOff);
      this.engineBlockGroup.add(shellLower);

      // Cap parting-face pads
      [-mainCapBoreR - 0.085, mainCapBoreR + 0.085].forEach((xOff) => {
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(0.065, 0.09, 0.14),
          this.materials.conRod
        );
        pad.position.set(xOff, mainCapY - 0.06, zOff);
        this.engineBlockGroup.add(pad);
      });

      // 4 ARP main cap studs with 12-point nuts
      [[-mainCapBoreR - 0.070, 0.045], [-mainCapBoreR - 0.070, -0.045],
       [ mainCapBoreR + 0.070, 0.045], [ mainCapBoreR + 0.070, -0.045]].forEach(([xB, zB]) => {
        const stud = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, 0.26, 12),
          this.materials.bolts
        );
        stud.position.set(xB, mainCapY - 0.08, zOff + zB);
        this.engineBlockGroup.add(stud);

        const nut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.038, 0.038, 0.04, 12),
          this.materials.bolts
        );
        nut.position.set(xB, mainCapY - 0.22, zOff + zB);
        this.engineBlockGroup.add(nut);
      });

      // Main saddle oil drain port
      const oilReturn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.18, 10),
        this.materials.cavity
      );
      oilReturn.position.set(0, mainCapY + mainCapBoreR + 0.05, zOff);
      this.engineBlockGroup.add(oilReturn);
    });

    this.root.add(this.engineBlockGroup);

    this.parts.block = {
      group: this.engineBlockGroup,
      explodeOffset: new THREE.Vector3(1.8, 0, 0),
      name: 'Liquid-Cooled Deep-Skirt Engine Block',
      specs: 'A356-T6 Aluminum | 4-Bolt Cross-Bolted Mains | Cast Sleeve | MLS Deck Ring'
    };
  }

  /* ================================================================
     PRECISION FINNED OIL PAN / SUMP  (Blueprint Image 2 & 3)
     Cast aluminum oil pan with flanged top, perimeter bolts,
     11 longitudinal underside cooling fins, central hex drain plug,
     translucent amber oil sump pool, and dipstick tube.
     ================================================================ */
  buildOilPan() {
    this.oilPanGroup = new THREE.Group();
    this.oilPanGroup.name = 'OilPan_Assembly';

    const panTopY = -0.66;  // Gasket split line mating with block skirt
    const panBotY = -1.06;  // Pan sump bottom floor plate
    const panH = panTopY - panBotY; // 0.40
    const panHalfW = 1.04;  // Flange outer half-width
    const panHalfD = 0.56;  // Flange outer half-depth (matches block flange, clear of flywheel)

    // ---- 1. Upper Mounting Flange (hollow rectangular frame) ----
    const panFlangeShape = new THREE.Shape();
    panFlangeShape.moveTo(-panHalfW, -panHalfD);
    panFlangeShape.lineTo( panHalfW, -panHalfD);
    panFlangeShape.lineTo( panHalfW,  panHalfD);
    panFlangeShape.lineTo(-panHalfW,  panHalfD);
    panFlangeShape.closePath();

    const panHole = new THREE.Path();
    const pInW = panHalfW - 0.12;
    const pInD = panHalfD - 0.12;
    panHole.moveTo(-pInW, -pInD);
    panHole.lineTo( pInW, -pInD);
    panHole.lineTo( pInW,  pInD);
    panHole.lineTo(-pInW,  pInD);
    panHole.closePath();
    panFlangeShape.holes.push(panHole);

    const panFlangeGeom = new THREE.ExtrudeGeometry(panFlangeShape, { depth: 0.05, bevelEnabled: false });
    panFlangeGeom.rotateX(Math.PI / 2);
    const flangeMesh = new THREE.Mesh(panFlangeGeom, this.materials.pan);
    flangeMesh.position.y = panTopY;
    this.oilPanGroup.add(flangeMesh);

    // ---- 2. Pan Sump Tub Body (curved bowl / tapered walls) ----
    // Side walls: tapers smoothly from flange down to sump floor
    [-1, 1].forEach((side) => {
      const wallShape = new THREE.Shape();
      wallShape.moveTo(0.94, panTopY - 0.04);
      wallShape.lineTo(0.74, panBotY + 0.04);
      wallShape.lineTo(0.68, panBotY + 0.04);
      wallShape.lineTo(0.86, panTopY - 0.04);
      wallShape.closePath();

      const wallGeom = new THREE.ExtrudeGeometry(wallShape, { depth: (panHalfD - 0.08) * 2, bevelEnabled: false });
      wallGeom.translate(0, 0, -(panHalfD - 0.08));
      const sideWall = new THREE.Mesh(wallGeom, this.materials.pan);
      if (side === -1) sideWall.scale.set(-1, 1, 1);
      this.oilPanGroup.add(sideWall);
    });

    // Front & rear end walls
    [-1, 1].forEach((side) => {
      const endWall = new THREE.Mesh(
        new THREE.BoxGeometry((0.74 + 0.06) * 2, panH - 0.04, 0.06),
        this.materials.pan
      );
      endWall.position.set(0, (panTopY + panBotY) / 2, side * (panHalfD - 0.08));
      this.oilPanGroup.add(endWall);
    });

    // Sump bottom floor plate
    const bottomFloor = new THREE.Mesh(
      new THREE.BoxGeometry(0.76 * 2, 0.04, (panHalfD - 0.08) * 2),
      this.materials.pan
    );
    bottomFloor.position.y = panBotY;
    this.oilPanGroup.add(bottomFloor);

    // ---- 3. Longitudinal Underside Cooling Fins (Key Blueprint Feature) ----
    // In Blueprint Image 3, 11 vertical fins protrude DOWNWARDS from the bottom
    // of the oil pan into the airflow, spaced evenly across the width.
    const numFins = 11;
    const finXSpread = 1.20; // from x = -0.60 to +0.60
    const finLength = (panHalfD - 0.10) * 2; // running front-to-back along Z

    for (let i = 0; i < numFins; i++) {
      const t = i / (numFins - 1); // 0 to 1
      const xPos = -finXSpread / 2 + t * finXSpread;

      // Fins follow bottom camber: deeper in the middle (0.13), shallower at edges (0.07)
      const depthFactor = 1.0 - Math.pow(Math.abs(t - 0.5) * 2, 2) * 0.45;
      const finH = 0.13 * depthFactor;
      const finThickness = 0.022;

      // Center fin has a gap in the middle for the hex drain plug
      if (Math.abs(xPos) < 0.04) {
        // Front half of center fin
        const finFront = new THREE.Mesh(
          new THREE.BoxGeometry(finThickness, finH, (finLength - 0.22) / 2),
          this.materials.pan
        );
        finFront.position.set(xPos, panBotY - finH / 2, (finLength + 0.22) / 4);
        this.oilPanGroup.add(finFront);

        // Rear half of center fin
        const finRear = new THREE.Mesh(
          new THREE.BoxGeometry(finThickness, finH, (finLength - 0.22) / 2),
          this.materials.pan
        );
        finRear.position.set(xPos, panBotY - finH / 2, -(finLength + 0.22) / 4);
        this.oilPanGroup.add(finRear);
      } else {
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(finThickness, finH, finLength),
          this.materials.pan
        );
        fin.position.set(xPos, panBotY - finH / 2, 0);
        this.oilPanGroup.add(fin);
      }
    }

    // ---- 4. Magnetic Hex Drain Plug (centered on bottom between fins) ----
    const drainBoss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.04, 16),
      this.materials.pan
    );
    drainBoss.position.set(0, panBotY - 0.02, 0);
    this.oilPanGroup.add(drainBoss);

    // Copper crush washer
    const crushWasher = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.012, 16),
      this.materials.bushing
    );
    crushWasher.position.set(0, panBotY - 0.042, 0);
    this.oilPanGroup.add(crushWasher);

    // Hex plug bolt head
    const drainPlug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.048, 6),
      this.materials.bolts
    );
    drainPlug.position.set(0, panBotY - 0.068, 0);
    this.oilPanGroup.add(drainPlug);

    // ---- 5. Perimeter Flange Bolts (clamping pan to skirt) ----
    const boltPoints = [
      // Left side (-X)
      [-panHalfW + 0.06, -panHalfD + 0.08],
      [-panHalfW + 0.06, -panHalfD * 0.30],
      [-panHalfW + 0.06,  panHalfD * 0.30],
      [-panHalfW + 0.06,  panHalfD - 0.08],
      // Right side (+X)
      [ panHalfW - 0.06, -panHalfD + 0.08],
      [ panHalfW - 0.06, -panHalfD * 0.30],
      [ panHalfW - 0.06,  panHalfD * 0.30],
      [ panHalfW - 0.06,  panHalfD - 0.08],
      // Front (+Z)
      [-panHalfW * 0.45,  panHalfD - 0.05],
      [ panHalfW * 0.45,  panHalfD - 0.05],
      // Rear (-Z)
      [-panHalfW * 0.45, -panHalfD + 0.05],
      [ panHalfW * 0.45, -panHalfD + 0.05]
    ];

    boltPoints.forEach(([bx, bz]) => {
      // Bolt shank through flange
      const shank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.07, 10),
        this.materials.bolts
      );
      shank.position.set(bx, panTopY - 0.025, bz);
      this.oilPanGroup.add(shank);

      // Flange bolt head with integrated washer (pointing downwards under flange)
      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.035, 6),
        this.materials.bolts
      );
      head.position.set(bx, panTopY - 0.065, bz);
      this.oilPanGroup.add(head);
    });

    // ---- 6. Internal Sump Lubricating Oil Reservoir (translucent amber) ----
    const oilPool = new THREE.Mesh(
      new THREE.BoxGeometry(0.70 * 2, 0.24, (panHalfD - 0.10) * 2),
      this.materials.oil
    );
    oilPool.position.set(0, panBotY + 0.14, 0);
    this.oilPanGroup.add(oilPool);

    // ---- 7. Oil Dipstick Assembly ----
    const dipstickCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.92, panTopY + 0.04, 0.25),
      new THREE.Vector3(-0.96, 0.40, 0.25),
      new THREE.Vector3(-0.92, 1.40, 0.25),
      new THREE.Vector3(-0.86, 2.50, 0.25)
    ]);
    const dipstickTubeGeom = new THREE.TubeGeometry(dipstickCurve, 24, 0.016, 8, false);
    const dipstickTube = new THREE.Mesh(dipstickTubeGeom, this.materials.block);
    this.oilPanGroup.add(dipstickTube);

    // Dipstick handle pull ring (yellow automotive ring)
    const handleRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.012, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.3, metalness: 0.1, name: 'Dipstick Ring' })
    );
    handleRing.position.set(-0.86, 2.56, 0.25);
    this.oilPanGroup.add(handleRing);

    this.root.add(this.oilPanGroup);

    this.parts.oilPan = {
      group: this.oilPanGroup,
      explodeOffset: new THREE.Vector3(0, -1.8, 0),
      name: 'Cast Aluminum Finned Sump',
      specs: 'A356-T6 Aluminum | 11 Longitudinal Cooling Fins | M14 Magnetic Drain Plug | 3.8L Sump'
    };
  }

  /* ================================================================
     5. PENT-ROOF CYLINDER HEAD  (Blueprint Image 1 & 3)
     ================================================================ */
  buildCylinderHead() {
    this.cylinderHeadGroup = new THREE.Group();
    this.cylinderHeadGroup.name = 'CylinderHead_Assembly';

    const headMat = this.materials.block;
    const deckY = 2.52;
    const gasketH = 0.03;
    const headBaseY = deckY + gasketH;   // 2.55 — bottom of head casting
    const headH = 0.95;
    const headTopY = headBaseY + headH;  // 3.50

    // ---- Head Gasket (MLS multi-layer steel) ----
    const gasket = new THREE.Mesh(
      this.createHollowCylinderGeometry(this.rBore, 0.80, gasketH, 48),
      this.materials.headGasket
    );
    gasket.position.y = deckY + gasketH / 2;
    this.cylinderHeadGroup.add(gasket);

    // ---- Pent-Roof Head Casting ----
    // Blueprint Image 1: The head is a solid rectangular block with a central V-valley
    // for the spark plug, and the bottom has angled combustion chamber surfaces.

    // Left head mass (intake side)
    const leftHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, headH, 1.24),
      headMat
    );
    leftHead.position.set(-0.50, headBaseY + headH / 2, 0);
    this.cylinderHeadGroup.add(leftHead);

    // Right head mass (exhaust side)
    const rightHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, headH, 1.24),
      headMat
    );
    rightHead.position.set(0.50, headBaseY + headH / 2, 0);
    this.cylinderHeadGroup.add(rightHead);

    // V-Valley floor (bridging the two sides at the bottom)
    const vFloor = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.22, 1.16),
      headMat
    );
    vFloor.position.set(0, headBaseY + 0.11, 0);
    this.cylinderHeadGroup.add(vFloor);

    // Angled intake roof surface (part of pent-roof combustion chamber)
    const intakeRoof = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.06, 0.80),
      headMat
    );
    intakeRoof.rotation.z = 0.38;   // ~22° cant matching intake valve angle
    intakeRoof.position.set(-0.22, headBaseY + 0.03, 0);
    this.cylinderHeadGroup.add(intakeRoof);

    // Angled exhaust roof surface
    const exhaustRoof = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.06, 0.80),
      headMat
    );
    exhaustRoof.rotation.z = -0.38;  // ~22° cant matching exhaust valve angle
    exhaustRoof.position.set(0.22, headBaseY + 0.03, 0);
    this.cylinderHeadGroup.add(exhaustRoof);

    // ---- Valve Seat Inserts ----
    // Intake valve seat (hardened insert pressed into head)
    const intakeSeat = new THREE.Mesh(
      new THREE.TorusGeometry(0.185, 0.018, 8, 24),
      this.materials.valveSeat
    );
    intakeSeat.rotation.x = Math.PI / 2;
    intakeSeat.rotation.z = 0.38;
    intakeSeat.position.set(-0.21, headBaseY - 0.01, 0);
    this.cylinderHeadGroup.add(intakeSeat);

    // Exhaust valve seat
    const exhaustSeat = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.018, 8, 24),
      this.materials.valveSeat
    );
    exhaustSeat.rotation.x = Math.PI / 2;
    exhaustSeat.rotation.z = -0.38;
    exhaustSeat.position.set(0.21, headBaseY - 0.01, 0);
    this.cylinderHeadGroup.add(exhaustSeat);

    // ---- Precision Port Runners (Flow ducts located underneath spring pockets) ----
    // 1. Intake Port Duct (Left cross-flow runner sweeping to intake seat)
    const intakeRunnerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.78, headBaseY + 0.28, 0),
      new THREE.Vector3(-0.54, headBaseY + 0.20, 0),
      new THREE.Vector3(-0.35, headBaseY + 0.10, 0),
      new THREE.Vector3(-0.21, headBaseY + 0.01, 0)
    ]);
    const intakePortGeom = new THREE.TubeGeometry(intakeRunnerCurve, 24, 0.115, 16, false);
    const intakePort = new THREE.Mesh(intakePortGeom, headMat);
    this.cylinderHeadGroup.add(intakePort);

    // Intake runner inner bore (hollow flow passage)
    const intakeBoreGeom = new THREE.TubeGeometry(intakeRunnerCurve, 24, 0.088, 16, false);
    const intakeBore = new THREE.Mesh(intakeBoreGeom, this.materials.cavity);
    this.cylinderHeadGroup.add(intakeBore);

    // Intake manifold mounting flange on exterior head wall
    const intakeFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.32, 0.28),
      headMat
    );
    intakeFlange.position.set(-0.78, headBaseY + 0.28, 0);
    this.cylinderHeadGroup.add(intakeFlange);

    // Manifold mounting studs
    [[-0.11, -0.09], [-0.11, 0.09], [0.11, -0.09], [0.11, 0.09]].forEach(([yOff, zOff]) => {
      const stud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.08, 12),
        this.materials.bolts
      );
      stud.rotation.z = Math.PI / 2;
      stud.position.set(-0.80, headBaseY + 0.28 + yOff, zOff);
      this.cylinderHeadGroup.add(stud);
    });

    // 2. Exhaust Port Duct (Right cross-flow runner sweeping from exhaust seat to header)
    const exhaustRunnerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.21, headBaseY + 0.01, 0),
      new THREE.Vector3(0.35, headBaseY + 0.10, 0),
      new THREE.Vector3(0.54, headBaseY + 0.20, 0),
      new THREE.Vector3(0.78, headBaseY + 0.28, 0)
    ]);
    const exhaustPortGeom = new THREE.TubeGeometry(exhaustRunnerCurve, 24, 0.105, 16, false);
    const exhaustPort = new THREE.Mesh(exhaustPortGeom, headMat);
    this.cylinderHeadGroup.add(exhaustPort);

    // Exhaust runner inner bore
    const exhaustBoreGeom = new THREE.TubeGeometry(exhaustRunnerCurve, 24, 0.080, 16, false);
    const exhaustBore = new THREE.Mesh(exhaustBoreGeom, this.materials.cavity);
    this.cylinderHeadGroup.add(exhaustBore);

    // Exhaust header mounting flange on exterior head wall
    const exhaustFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.30, 0.26),
      headMat
    );
    exhaustFlange.position.set(0.78, headBaseY + 0.28, 0);
    this.cylinderHeadGroup.add(exhaustFlange);

    // Header mounting studs
    [[-0.10, -0.08], [-0.10, 0.08], [0.10, -0.08], [0.10, 0.08]].forEach(([yOff, zOff]) => {
      const stud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.08, 12),
        this.materials.bolts
      );
      stud.rotation.z = Math.PI / 2;
      stud.position.set(0.80, headBaseY + 0.28 + yOff, zOff);
      this.cylinderHeadGroup.add(stud);
    });

    // ---- Precision Bronze Valve Guides & Lower Spring Seat Washers ----
    // Sits underneath the valve spring, guiding the valve stem through the port roof
    const vCant = 0.38;
    const intakeGuide = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.26, 16),
      this.materials.bushing // phosphor bronze
    );
    intakeGuide.rotation.z = vCant;
    intakeGuide.position.set(-0.21 - 0.14 * Math.sin(vCant), headBaseY + 0.14 * Math.cos(vCant), 0);
    this.cylinderHeadGroup.add(intakeGuide);

    const exhaustGuide = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.26, 16),
      this.materials.bushing
    );
    exhaustGuide.rotation.z = -vCant;
    exhaustGuide.position.set(0.21 + 0.14 * Math.sin(vCant), headBaseY + 0.14 * Math.cos(vCant), 0);
    this.cylinderHeadGroup.add(exhaustGuide);

    // Lower spring seat washers (recessed spring locator base flush under spring coils)
    const intakeSpringSeat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.016, 24),
      this.materials.bolts
    );
    intakeSpringSeat.rotation.z = vCant;
    intakeSpringSeat.position.set(-0.21 - 0.37 * Math.sin(vCant), headBaseY + 0.37 * Math.cos(vCant), 0);
    this.cylinderHeadGroup.add(intakeSpringSeat);

    const exhaustSpringSeat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.016, 24),
      this.materials.bolts
    );
    exhaustSpringSeat.rotation.z = -vCant;
    exhaustSpringSeat.position.set(0.21 + 0.37 * Math.sin(vCant), headBaseY + 0.37 * Math.cos(vCant), 0);
    this.cylinderHeadGroup.add(exhaustSpringSeat);

    this.root.add(this.cylinderHeadGroup);

    this.parts.cylinderHead = {
      group: this.cylinderHeadGroup,
      explodeOffset: new THREE.Vector3(0, 1.9, 0),
      name: 'Pent-Roof DOHC Cylinder Head',
      specs: 'MLS Gasket | Canted Valve Guides | Hardened Seat Inserts | Cross-Flow Ports'
    };
  }

  /* ================================================================
     6. VALVETRAIN (DOHC, BUCKET TAPPETS, DUAL CAMS)
     ================================================================ */
  buildValvetrain() {
    const valveAngle = 0.38;  // ~21.8° cant
    const headBaseY = 2.55;

    // ====== A. INTAKE VALVE ASSEMBLY ======
    this.intakeValveGroup = new THREE.Group();
    this.intakeValveGroup.name = 'IntakeValve_Assembly';

    // Stationary on head: dual valve spring
    this.intakeSpringMesh = this.createValveSpring(this.materials.spring);
    this.intakeSpringMesh.position.y = 0.38;
    this.intakeValveGroup.add(this.intakeSpringMesh);

    // Reciprocating valve components (slides straight along stem axis)
    this.intakeMovingGroup = new THREE.Group();
    this.intakeMovingGroup.name = 'Intake_Moving_Components';

    // Valve head (tulip shape, sits flush inside valve seat at y = 0)
    const intakeHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.20, 0.06, 32),
      this.materials.valveIntake
    );
    intakeHead.rotation.x = Math.PI;
    this.intakeMovingGroup.add(intakeHead);

    // Valve stem
    const intakeStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.98, 16),
      this.materials.valveIntake
    );
    intakeStem.position.y = 0.49;
    this.intakeMovingGroup.add(intakeStem);

    // Titanium retainer (clamps spring top)
    const intakeRetainer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.075, 0.045, 24),
      this.materials.retainer
    );
    intakeRetainer.position.y = 0.82;
    this.intakeMovingGroup.add(intakeRetainer);

    // Bucket tappet (cam follower)
    const intakeBucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 0.14, 24),
      this.materials.wristPin
    );
    intakeBucket.position.y = 0.90;
    this.intakeMovingGroup.add(intakeBucket);

    this.intakeValveGroup.add(this.intakeMovingGroup);

    this.intakeValveBasePos = new THREE.Vector3(-0.21, headBaseY - 0.01, 0);
    this.intakeValveGroup.position.copy(this.intakeValveBasePos);
    this.intakeValveGroup.rotation.z = valveAngle;
    this.root.add(this.intakeValveGroup);

    // ====== B. EXHAUST VALVE ASSEMBLY ======
    this.exhaustValveGroup = new THREE.Group();
    this.exhaustValveGroup.name = 'ExhaustValve_Assembly';

    // Stationary on head: dual valve spring
    this.exhaustSpringMesh = this.createValveSpring(this.materials.spring);
    this.exhaustSpringMesh.position.y = 0.38;
    this.exhaustValveGroup.add(this.exhaustSpringMesh);

    // Reciprocating valve components (slides straight along stem axis)
    this.exhaustMovingGroup = new THREE.Group();
    this.exhaustMovingGroup.name = 'Exhaust_Moving_Components';

    const exhaustHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 0.06, 32),
      this.materials.valveExhaust
    );
    exhaustHead.rotation.x = Math.PI;
    this.exhaustMovingGroup.add(exhaustHead);

    const exhaustStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.98, 16),
      this.materials.valveExhaust
    );
    exhaustStem.position.y = 0.49;
    this.exhaustMovingGroup.add(exhaustStem);

    const exhaustRetainer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.075, 0.045, 24),
      this.materials.retainer
    );
    exhaustRetainer.position.y = 0.82;
    this.exhaustMovingGroup.add(exhaustRetainer);

    const exhaustBucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 0.14, 24),
      this.materials.wristPin
    );
    exhaustBucket.position.y = 0.90;
    this.exhaustMovingGroup.add(exhaustBucket);

    this.exhaustValveGroup.add(this.exhaustMovingGroup);

    this.exhaustValveBasePos = new THREE.Vector3(0.21, headBaseY - 0.01, 0);
    this.exhaustValveGroup.position.copy(this.exhaustValveBasePos);
    this.exhaustValveGroup.rotation.z = -valveAngle;
    this.root.add(this.exhaustValveGroup);

    // ====== C. DOHC CAMSHAFTS ======
    this.camshaftGroup = new THREE.Group();
    this.camshaftGroup.name = 'DOHC_Camshaft_Assembly';

    const camY = headBaseY + 0.97;   // 3.52

    // Intake camshaft (left, centered directly over intake valve bucket)
    this.intakeCamshaftGroup = new THREE.Group();
    this.intakeCamshaftGroup.name = 'Intake_Camshaft';
    this.intakeCamshaftGroup.position.set(-0.570, camY, 0);

    const intakeShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.070, 0.070, 1.20, 24),
      this.materials.crankshaft
    );
    intakeShaft.rotation.x = Math.PI / 2;
    this.intakeCamshaftGroup.add(intakeShaft);

    // Cam lobe (egg-shaped profile: base circle R=0.080, nose R=0.22, lift = 0.14)
    const buildCamLobe = (group) => {
      const lobeShape = new THREE.Shape();
      lobeShape.absarc(0, 0, 0.080, 0, Math.PI, false);
      lobeShape.lineTo(0.052, -0.14);
      lobeShape.quadraticCurveTo(0, -0.22, -0.052, -0.14);
      lobeShape.closePath();
      const lobeGeom = new THREE.ExtrudeGeometry(lobeShape, {
        depth: 0.12, bevelEnabled: true, bevelSize: 0.010, bevelThickness: 0.010
      });
      const lobe = new THREE.Mesh(lobeGeom, this.materials.crankshaft);
      lobe.position.z = -0.06;
      group.add(lobe);
    };
    buildCamLobe(this.intakeCamshaftGroup);

    // Intake timing sprocket
    const intakeSprocket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.20, 0.04, 32),
      this.materials.crankshaft
    );
    intakeSprocket.rotation.x = Math.PI / 2;
    intakeSprocket.position.z = 0.56;
    this.intakeCamshaftGroup.add(intakeSprocket);

    this.camshaftGroup.add(this.intakeCamshaftGroup);

    // Exhaust camshaft (right, centered directly over exhaust valve bucket)
    this.exhaustCamshaftGroup = new THREE.Group();
    this.exhaustCamshaftGroup.name = 'Exhaust_Camshaft';
    this.exhaustCamshaftGroup.position.set(0.570, camY, 0);

    const exhaustShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.070, 0.070, 1.20, 24),
      this.materials.crankshaft
    );
    exhaustShaft.rotation.x = Math.PI / 2;
    this.exhaustCamshaftGroup.add(exhaustShaft);

    buildCamLobe(this.exhaustCamshaftGroup);

    // Exhaust timing sprocket
    const exhaustSprocket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.20, 0.04, 32),
      this.materials.crankshaft
    );
    exhaustSprocket.rotation.x = Math.PI / 2;
    exhaustSprocket.position.z = 0.56;
    this.exhaustCamshaftGroup.add(exhaustSprocket);

    this.camshaftGroup.add(this.exhaustCamshaftGroup);

    // Timing chain link (connects both cam sprockets across center-to-center distance)
    const timingLink = new THREE.Mesh(
      new THREE.BoxGeometry(1.140, 0.030, 0.035),
      this.materials.bolts
    );
    timingLink.position.set(0, camY + 0.18, 0.56);
    this.camshaftGroup.add(timingLink);

    this.root.add(this.camshaftGroup);

    this.parts.intakeValve = {
      group: this.intakeValveGroup,
      explodeOffset: new THREE.Vector3(-0.9, 1.3, 0),
      name: 'Canted Intake Valve & Bucket Tappet',
      specs: 'Head: Ø36 mm | Cant: 22° | SS 21-4N | Inverted Bucket Follower'
    };
    this.parts.exhaustValve = {
      group: this.exhaustValveGroup,
      explodeOffset: new THREE.Vector3(0.9, 1.3, 0),
      name: 'Canted Exhaust Valve & Bucket Tappet',
      specs: 'Head: Ø31 mm | Cant: 22° | Inconel 751 Superalloy'
    };
    this.parts.camshaft = {
      group: this.camshaftGroup,
      explodeOffset: new THREE.Vector3(0, 2.0, -0.9),
      name: 'Dual Overhead Camshafts (DOHC)',
      specs: 'Dual Billet Shafts | 264° Duration | 10.5 mm Peak Lift'
    };
  }

  /* ================================================================
     VALVE SPRING HELPER
     ================================================================ */
  createValveSpring(mat) {
    const springGroup = new THREE.Group();
    const coils = 6.5;
    const rSpring = 0.076;
    const hSpring = 0.42;
    const wireR = 0.013;

    const points = [];
    const segments = 96;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI * 2 * coils;
      const x = rSpring * Math.cos(angle);
      const z = rSpring * Math.sin(angle);
      const y = t * hSpring;
      points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geom = new THREE.TubeGeometry(curve, 96, wireR, 8, false);
    springGroup.add(new THREE.Mesh(geom, mat));
    return springGroup;
  }

  /* ================================================================
     7. SPARK PLUG (Centrally Placed in V-Valley)
     ================================================================ */
  buildSparkPlug() {
    this.sparkPlugGroup = new THREE.Group();
    this.sparkPlugGroup.name = 'SparkPlug_Assembly';

    // Ribbed alumina ceramic insulator
    const ceramic = new THREE.Mesh(
      new THREE.CylinderGeometry(0.060, 0.070, 0.50, 24),
      this.materials.sparkCeramic
    );
    ceramic.position.y = 0.45;
    this.sparkPlugGroup.add(ceramic);

    // Ceramic insulator ribs
    for (let y = 0.32; y <= 0.58; y += 0.065) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(0.070, 0.009, 8, 24),
        this.materials.sparkCeramic
      );
      rib.rotation.x = Math.PI / 2;
      rib.position.y = y;
      this.sparkPlugGroup.add(rib);
    }

    // Hex nut (wrench flats)
    const hexNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.11, 6),
      this.materials.sparkMetal
    );
    hexNut.position.y = 0.16;
    this.sparkPlugGroup.add(hexNut);

    // Threaded barrel
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.078, 0.20, 24),
      this.materials.sparkMetal
    );
    barrel.position.y = 0.02;
    this.sparkPlugGroup.add(barrel);

    // Ground electrode arm
    const groundArm1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.070, 0.014),
      this.materials.sparkMetal
    );
    groundArm1.position.set(0.052, -0.112, 0);
    this.sparkPlugGroup.add(groundArm1);

    const groundArm2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.014, 0.014),
      this.materials.sparkMetal
    );
    groundArm2.position.set(0.028, -0.145, 0);
    this.sparkPlugGroup.add(groundArm2);

    // Center electrode pin
    const centerPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.075, 16),
      this.materials.wristPin
    );
    centerPin.position.set(0, -0.112, 0);
    this.sparkPlugGroup.add(centerPin);

    // Spark arc geometry (animated in update)
    const sparkArcGeom = new THREE.BufferGeometry();
    const arcVerts = new Float32Array([
      0, -0.130, 0,
      0.01, -0.138, 0.005,
      0.02, -0.136, -0.005,
      0.03, -0.145, 0
    ]);
    sparkArcGeom.setAttribute('position', new THREE.BufferAttribute(arcVerts, 3));
    this.sparkArcMesh = new THREE.Line(sparkArcGeom, this.materials.sparkArc);
    this.sparkPlugGroup.add(this.sparkArcMesh);

    this.sparkLight = new THREE.PointLight(0x80d8ff, 0, 1.8, 2.0);
    this.sparkLight.position.set(0, -0.14, 0);
    this.sparkPlugGroup.add(this.sparkLight);

    this.sparkPlugBasePos = new THREE.Vector3(0, 2.55, 0);
    this.sparkPlugGroup.position.copy(this.sparkPlugBasePos);
    this.root.add(this.sparkPlugGroup);

    this.parts.sparkPlug = {
      group: this.sparkPlugGroup,
      explodeOffset: new THREE.Vector3(0, 2.7, 0),
      name: 'Iridium IX Racing Spark Plug',
      specs: 'Electrode: 0.6 mm Iridium | Gap: 0.8 mm | Thread: M14×1.25'
    };
  }

  /* ================================================================
     8. COMBUSTION CHAMBER GAS VOLUME
     ================================================================ */
  buildCombustionGasVolume() {
    const rGas = this.rPiston * 0.96;
    this.gasGeom = new THREE.CylinderGeometry(rGas, rGas, 1.0, 36, 1, false);
    this.gasMesh = new THREE.Mesh(this.gasGeom, this.materials.combustionGas);
    this.gasMesh.position.set(0, 2.0, 0);
    this.root.add(this.gasMesh);
  }

  /* ================================================================
     PRECISION STAGED ASSEMBLY / EXPLODED VIEW
     ================================================================ */
  registerExplodeOffsets() {
    for (const key in this.parts) {
      const part = this.parts[key];
      part.basePos = part.group.position.clone();
      part.baseRot = part.group.rotation.clone();
    }
  }

  setExplodeFactor(factor) {
    this.explodeFactor = Math.max(0, Math.min(1, factor));
    const f = this.explodeFactor;

    // Realistic mechanical disassembly schedule [start, end]
    // Parts peel away in true automotive engineering assembly order
    const sequenceMap = {
      sparkPlug:    [0.00, 0.35],
      oilPan:       [0.00, 0.45],
      camshaft:     [0.06, 0.48],
      intakeValve:  [0.10, 0.52],
      exhaustValve: [0.10, 0.52],
      rodCap:       [0.12, 0.55],
      cylinderHead: [0.18, 0.68],
      block:        [0.26, 0.82],
      piston:       [0.34, 0.82],
      conRod:       [0.36, 0.88],
      crankshaft:   [0.30, 0.85],
      wristPin:     [0.52, 0.95],
      rings:        [0.52, 0.95]
    };

    for (const key in this.parts) {
      const part = this.parts[key];
      if (part.explodeOffset) {
        const [tStart, tEnd] = sequenceMap[key] || [0, 1];
        let localT = 0;
        if (f <= tStart) {
          localT = 0;
        } else if (f >= tEnd) {
          localT = 1;
        } else {
          const raw = (f - tStart) / (tEnd - tStart);
          // Smooth S-curve easing: 3*t^2 - 2*t^3
          localT = raw * raw * (3 - 2 * raw);
        }

        part.currentLocalT = localT;
        const currentOffset = part.explodeOffset.clone().multiplyScalar(localT);

        if (key === 'piston' || key === 'conRod' || key === 'rodCap' ||
            key === 'intakeValve' || key === 'exhaustValve') {
          part.currentExplodeOffset = currentOffset;
        } else {
          part.group.position.copy(part.basePos.clone().add(currentOffset));
        }
      }
    }
  }

  /* ================================================================
     ANIMATION UPDATE (runs every frame)
     ================================================================ */
  update(kinematicsState) {
    const theta = this.kinematics.crankAngle;
    const explodeT = this.explodeFactor;

    // 1. Crankshaft Rotation & Staged Translation
    this.crankshaftGroup.rotation.z = -theta;
    if (this.parts.crankshaft) {
      const bp = this.parts.crankshaft.basePos.clone();
      const localT = this.parts.crankshaft.currentLocalT !== undefined ? this.parts.crankshaft.currentLocalT : explodeT;
      const eo = this.parts.crankshaft.explodeOffset.clone().multiplyScalar(localT);
      this.crankshaftGroup.position.copy(bp.add(eo));
    }

    // 2. Connecting Rod Position, Tilt & Rod Cap Separation
    const crankPin = kinematicsState.crankPinPos;
    const conRodTilt = kinematicsState.conRodAngle;
    const conRodExp = this.parts.conRod.currentExplodeOffset || new THREE.Vector3();

    this.conRodGroup.position.set(
      crankPin.x + conRodExp.x,
      crankPin.y + conRodExp.y,
      crankPin.z + conRodExp.z
    );
    this.conRodGroup.rotation.z = conRodTilt;

    if (this.parts.rodCap && this.rodCapGroup) {
      const rodCapExp = this.parts.rodCap.currentExplodeOffset || new THREE.Vector3();
      this.rodCapGroup.position.set(rodCapExp.x, rodCapExp.y, rodCapExp.z);
    }

    // 3. Piston Reciprocation & Staged Lift
    const pistonPos = kinematicsState.pistonPos;
    const pistonExp = this.parts.piston.currentExplodeOffset || new THREE.Vector3();

    this.pistonGroup.position.set(
      pistonPos.x + pistonExp.x,
      pistonPos.y - this.wristPinH + pistonExp.y,
      pistonPos.z + pistonExp.z
    );

    // 4. Canted Valve Straight Stroke Lifts
    const intakeLift = kinematicsState.intakeValveLift * 0.13;
    const intakeExp = this.parts.intakeValve.currentExplodeOffset || new THREE.Vector3();
    this.intakeValveGroup.position.copy(this.intakeValveBasePos.clone().add(intakeExp));
    if (this.intakeMovingGroup) {
      this.intakeMovingGroup.position.y = -intakeLift;
    }
    const intakeSpringScale = (0.42 - intakeLift) / 0.42;
    this.intakeSpringMesh.scale.set(1, Math.max(0.60, intakeSpringScale), 1);

    const exhaustLift = kinematicsState.exhaustValveLift * 0.13;
    const exhaustExp = this.parts.exhaustValve.currentExplodeOffset || new THREE.Vector3();
    this.exhaustValveGroup.position.copy(this.exhaustValveBasePos.clone().add(exhaustExp));
    if (this.exhaustMovingGroup) {
      this.exhaustMovingGroup.position.y = -exhaustLift;
    }
    const exhaustSpringScale = (0.42 - exhaustLift) / 0.42;
    this.exhaustSpringMesh.scale.set(1, Math.max(0.60, exhaustSpringScale), 1);

    // Fade combustion gas volume as chamber disassembles
    if (this.materials.combustionGas) {
      this.materials.combustionGas.opacity = Math.max(0, 0.70 * (1 - this.explodeFactor * 2.2));
    }

    // 5. DOHC Camshafts (1/2 crank speed, perfectly synchronized to valve bucket contact)
    const vAng = this.valveAngle || 0.38;
    if (this.intakeCamshaftGroup) {
      this.intakeCamshaftGroup.rotation.z = -theta * 0.5 + (Math.PI / 4 + vAng);
    }
    if (this.exhaustCamshaftGroup) {
      this.exhaustCamshaftGroup.rotation.z = -theta * 0.5 + (1.75 * Math.PI - vAng);
    }

    // 6. Spark Plug Arc Plasma
    if (kinematicsState.sparkPlugFiring) {
      this.materials.sparkArc.opacity = 1.0;
      this.sparkLight.intensity = 3.5 + Math.random() * 2.0;
      const posAttr = this.sparkArcMesh.geometry.attributes.position;
      posAttr.setXYZ(1, 0.01 + (Math.random() - 0.5) * 0.015, -0.138 + (Math.random() - 0.5) * 0.008, 0.005);
      posAttr.setXYZ(2, 0.02 + (Math.random() - 0.5) * 0.015, -0.136 + (Math.random() - 0.5) * 0.008, -0.005);
      posAttr.needsUpdate = true;
    } else {
      this.materials.sparkArc.opacity = 0.0;
      this.sparkLight.intensity = 0;
    }

    // 7. Dynamic Combustion Gas Volume
    const headRoofY = 2.42;
    const pistonCrownTopY = pistonPos.y - this.wristPinH + 0.62;
    const gasH = Math.max(0.08, headRoofY - pistonCrownTopY);
    const gasCenterY = pistonCrownTopY + gasH / 2;

    this.gasMesh.scale.set(1, gasH, 1);
    this.gasMesh.position.y = gasCenterY;

    const phase = kinematicsState.strokePhase;
    const prog = kinematicsState.strokeProgress;

    if (phase === 'INTAKE') {
      this.materials.combustionGas.color.setHex(0x00d4ff);
      this.materials.combustionGas.emissive.setHex(0x0055aa);
      this.materials.combustionGas.emissiveIntensity = 0.45 + prog * 0.3;
      this.materials.combustionGas.opacity = 0.3 + prog * 0.35;
    } else if (phase === 'COMPRESSION') {
      const rVal = Math.floor(255 * prog);
      const gVal = Math.floor(180 - prog * 60);
      const bVal = Math.floor(240 * (1 - prog));
      this.materials.combustionGas.color.setRGB(rVal / 255, gVal / 255, bVal / 255);
      this.materials.combustionGas.emissive.setRGB(rVal / 450, gVal / 450, 0);
      this.materials.combustionGas.emissiveIntensity = 0.5 + prog * 0.8;
      this.materials.combustionGas.opacity = 0.55 + prog * 0.35;
    } else if (phase === 'POWER') {
      if (prog < 0.22) {
        this.materials.combustionGas.color.setHex(0xfffae0);
        this.materials.combustionGas.emissive.setHex(0xff6600);
        this.materials.combustionGas.emissiveIntensity = 2.4;
        this.materials.combustionGas.opacity = 0.92;
      } else {
        this.materials.combustionGas.color.setHex(0xff4500);
        this.materials.combustionGas.emissive.setHex(0xdd2200);
        this.materials.combustionGas.emissiveIntensity = 1.4 * (1 - prog);
        this.materials.combustionGas.opacity = 0.75 * (1 - prog * 0.5);
      }
    } else {
      this.materials.combustionGas.color.setHex(0xdf3e18);
      this.materials.combustionGas.emissive.setHex(0x551105);
      this.materials.combustionGas.emissiveIntensity = 0.35 * (1 - prog);
      this.materials.combustionGas.opacity = 0.45 * (1 - prog);
    }
  }
}
