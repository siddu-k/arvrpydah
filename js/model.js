/**
 * 4-Stroke Engine Photorealistic 3D Model Generator (High-Fidelity CAD Grade)
 * Features precision PBR materials, volumetric engine block, CNC forged piston,
 * H-beam con-rod, counterweighted crankshaft, DOHC valvetrain, and spark ignition.
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

    this.setupClippingPlanes();
    this.createMaterials();
    this.buildEngine();
  }

  createBrushedMetalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 2500; i++) {
      const y = Math.random() * 512;
      const len = 30 + Math.random() * 100;
      const x = Math.random() * 512;
      const val = Math.floor(105 + Math.random() * 45);
      ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
      ctx.fillRect(x, y, len, 1);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }

  createCastMetalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(512, 512);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const val = Math.floor(115 + Math.random() * 26);
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  }

  createHollowCylinderGeometry(innerRadius, outerRadius, height, segments = 48) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      curveSegments: segments
    });
    geom.center();
    geom.rotateX(Math.PI / 2);
    return geom;
  }

  setupClippingPlanes() {
    this.clipPlaneZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    this.clipPlaneX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.clipPlaneSlice = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.5);

    this.activeClippingPlanes = [];
    this.crossSectionMode = 'quarter';
  }

  createMaterials() {
    // Generate procedural metallic micro-textures for genuine metal feel
    const brushedTex = this.createBrushedMetalTexture();
    const castTex = this.createCastMetalTexture();

    // 1. Engine Block: Raw Bead-Blasted Cast Aluminum Alloy
    this.materials.block = new THREE.MeshStandardMaterial({
      color: 0x8a929e,
      metalness: 0.88,
      roughness: 0.38,
      bumpMap: castTex,
      bumpScale: 0.003,
      name: 'Cast Aluminum Engine Block',
      side: THREE.DoubleSide
    });

    // 2. Cylinder Sleeve: Honed Ductile Iron Liner
    this.materials.sleeve = new THREE.MeshStandardMaterial({
      color: 0xb0bac5,
      metalness: 0.94,
      roughness: 0.16,
      bumpMap: brushedTex,
      bumpScale: 0.0015,
      name: 'Honed Ductile Iron Sleeve',
      side: THREE.DoubleSide
    });

    // 3. Piston: CNC Forged 2618 T6 Aluminum Alloy
    this.materials.piston = new THREE.MeshStandardMaterial({
      color: 0xd6dfe8,
      metalness: 0.94,
      roughness: 0.16,
      bumpMap: brushedTex,
      bumpScale: 0.0012,
      name: 'Forged 2618-T6 Aluminum Piston',
      side: THREE.DoubleSide
    });

    // 4. Piston Compression & Scraper Rings: Mirror-Polished Chrome Steel
    this.materials.rings = new THREE.MeshStandardMaterial({
      color: 0xf6f9fc,
      metalness: 0.99,
      roughness: 0.04,
      name: 'Mirror-Polished Chrome Ring'
    });

    // 5. Wrist Pin: Precision Ground Hardened Tool Steel
    this.materials.wristPin = new THREE.MeshStandardMaterial({
      color: 0xeef3f8,
      metalness: 0.98,
      roughness: 0.06,
      name: 'Precision Ground Tool Steel Pin'
    });

    // 6. Phosphor Bronze Bushing (Connecting Rod Small End)
    this.materials.bushing = new THREE.MeshStandardMaterial({
      color: 0xc49448,
      metalness: 0.88,
      roughness: 0.22,
      name: 'Phosphor Bronze Bushing'
    });

    // 7. Connecting Rod: Forged 4340 Chromoly Steel (Shot-peened finish)
    this.materials.conRod = new THREE.MeshStandardMaterial({
      color: 0x9099a6,
      metalness: 0.92,
      roughness: 0.22,
      bumpMap: brushedTex,
      bumpScale: 0.002,
      name: 'Forged 4340 Steel Con-Rod'
    });

    // 8. ARP Grade 12.9 High-Tensile Black Oxide Fasteners
    this.materials.bolts = new THREE.MeshStandardMaterial({
      color: 0x22262c,
      metalness: 0.85,
      roughness: 0.38,
      name: 'Grade 12.9 Black Oxide Fasteners'
    });

    // 9. Crankshaft: Forged Nitrided Alloy Steel with Polished Journals
    this.materials.crankshaft = new THREE.MeshStandardMaterial({
      color: 0x767f8c,
      metalness: 0.92,
      roughness: 0.18,
      bumpMap: castTex,
      bumpScale: 0.002,
      name: 'Forged Nitrided Steel Crankshaft'
    });

    // 10. Stainless Steel Intake Valve
    this.materials.valveIntake = new THREE.MeshStandardMaterial({
      color: 0xc8d2dc,
      metalness: 0.95,
      roughness: 0.12,
      name: 'EV8 Stainless Intake Valve'
    });

    // 11. Inconel 751 Heat-Resistant Exhaust Valve
    this.materials.valveExhaust = new THREE.MeshStandardMaterial({
      color: 0x9ba4af,
      metalness: 0.92,
      roughness: 0.18,
      name: 'Inconel 751 Exhaust Valve'
    });

    // 12. Machined Titanium / Hard Anodized Retainers
    this.materials.retainer = new THREE.MeshStandardMaterial({
      color: 0x8a929d,
      metalness: 0.92,
      roughness: 0.18,
      name: 'Titanium Valve Retainers'
    });

    // 13. Dual Valve Springs: High-Tensile Spring Steel
    this.materials.spring = new THREE.MeshStandardMaterial({
      color: 0x3d434c,
      metalness: 0.95,
      roughness: 0.16,
      name: 'High-Tensile Spring Steel'
    });

    // 14. Billet Camshaft
    this.materials.camshaft = new THREE.MeshStandardMaterial({
      color: 0x7a8390,
      metalness: 0.93,
      roughness: 0.14,
      name: 'Chilled Billet Steel Camshaft'
    });

    // 15. Spark Plug Alumina Ceramic Insulator
    this.materials.sparkCeramic = new THREE.MeshStandardMaterial({
      color: 0xfafbfc,
      metalness: 0.04,
      roughness: 0.1,
      name: 'High Alumina Ceramic'
    });

    // 16. Spark Plug Zinc-Plated Metal Shell
    this.materials.sparkMetal = new THREE.MeshStandardMaterial({
      color: 0xa0a9b5,
      metalness: 0.94,
      roughness: 0.24,
      name: 'Zinc-Plated Steel Shell'
    });

    // 18. Dynamic Combustion Chamber Gas Flow
    this.materials.combustionGas = new THREE.MeshStandardMaterial({
      color: 0x00c8ff,
      emissive: 0x0055aa,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.55,
      roughness: 0.3,
      metalness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      name: 'Combustion Gas Dynamics'
    });

    // 19. Spark Arc Plasma
    this.materials.sparkArc = new THREE.MeshBasicMaterial({
      color: 0xa8e5ff,
      transparent: true,
      opacity: 0.0,
      name: 'Electric Arc Plasma'
    });

    // Clipping setup: block and sleeve cut away
    this.clippableMaterials = [
      this.materials.block,
      this.materials.sleeve,
    ];

    this.setCrossSectionMode('quarter');
  }

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
      this.materials.block.opacity = 0.25;
      this.materials.block.roughness = 0.1;
      this.materials.sleeve.transparent = true;
      this.materials.sleeve.opacity = 0.4;
    } else { // 'solid'
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
    this.materials.block.roughness = 0.32;
    this.materials.sleeve.transparent = false;
    this.materials.sleeve.opacity = 1.0;
  }

  buildEngine() {
    this.buildCrankshaft();
    this.buildConnectingRod();
    this.buildPiston();
    this.buildEngineBlock();
    this.buildCylinderHead();
    this.buildValvetrain();
    this.buildSparkPlug();
    this.buildCombustionGasVolume();

    this.registerExplodeOffsets();
  }

  // ==========================================
  // 1. CRANKSHAFT & FLYWHEEL
  // ==========================================
  buildCrankshaft() {
    this.crankshaftGroup = new THREE.Group();
    this.crankshaftGroup.name = 'Crankshaft_Assembly';

    const r = this.kinematics.crankRadius; // 0.44

    // Main Bearing Journals (front & rear)
    const journalFront = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.5, 36),
      this.materials.crankshaft
    );
    journalFront.rotation.x = Math.PI / 2;
    journalFront.position.z = 0.52;
    this.crankshaftGroup.add(journalFront);

    const journalRear = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.6, 36),
      this.materials.crankshaft
    );
    journalRear.rotation.x = Math.PI / 2;
    journalRear.position.z = -0.52;
    this.crankshaftGroup.add(journalRear);

    // Crankshaft Counterweight Webs (Forged aerodynamic balance weights)
    const webShape = new THREE.Shape();
    webShape.moveTo(-0.38, -0.08);
    webShape.quadraticCurveTo(-0.52, -0.68, 0, -0.76);
    webShape.quadraticCurveTo(0.52, -0.68, 0.38, -0.08);
    webShape.lineTo(0.24, r + 0.12);
    webShape.quadraticCurveTo(0, r + 0.24, -0.24, r + 0.12);
    webShape.closePath();

    const extrudeOpts = { depth: 0.18, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };

    const webFront = new THREE.Mesh(new THREE.ExtrudeGeometry(webShape, extrudeOpts), this.materials.crankshaft);
    webFront.position.set(0, 0, 0.16);
    this.crankshaftGroup.add(webFront);

    const webRear = new THREE.Mesh(new THREE.ExtrudeGeometry(webShape, extrudeOpts), this.materials.crankshaft);
    webRear.position.set(0, 0, -0.34);
    this.crankshaftGroup.add(webRear);

    // Counterweight balance drill holes
    [-0.22, 0.22].forEach((xOff) => {
      const drillHole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.72, 16),
        new THREE.MeshStandardMaterial({ color: 0x111317, metalness: 0.8, roughness: 0.6 })
      );
      drillHole.rotation.x = Math.PI / 2;
      drillHole.position.set(xOff, -0.45, 0);
      this.crankshaftGroup.add(drillHole);
    });

    // Crankpin Journal (Connecting rod bearing surface)
    const crankPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.20, 0.34, 36),
      this.materials.wristPin
    );
    crankPin.rotation.x = Math.PI / 2;
    crankPin.position.set(0, r, 0);
    this.crankshaftGroup.add(crankPin);

    // Cross-drilled oil chamfer
    const crankOilHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.36, 12),
      this.materials.bolts
    );
    crankOilHole.position.set(0, r, 0);
    this.crankshaftGroup.add(crankOilHole);

    // Flywheel Assembly with Ring Gear
    const flywheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.78, 0.12, 48),
      this.materials.crankshaft
    );
    flywheel.rotation.x = Math.PI / 2;
    flywheel.position.z = -0.86;
    this.crankshaftGroup.add(flywheel);

    // Flywheel ring gear teeth
    const ringGear = new THREE.Mesh(
      new THREE.TorusGeometry(0.77, 0.024, 8, 64),
      this.materials.bolts
    );
    ringGear.position.z = -0.86;
    this.crankshaftGroup.add(ringGear);

    // Front crank pulley / harmonic damper
    const pulley = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.08, 36),
      this.materials.crankshaft
    );
    pulley.rotation.x = Math.PI / 2;
    pulley.position.z = 0.82;
    this.crankshaftGroup.add(pulley);

    this.root.add(this.crankshaftGroup);

    this.parts.crankshaft = {
      group: this.crankshaftGroup,
      explodeOffset: new THREE.Vector3(0, -1.2, -0.6),
      name: 'Forged Steel Crankshaft & Flywheel',
      specs: 'Stroke: 88 mm | Main Journal: 48 mm | Crankpin: 40 mm | Balance: Dynamic 50%'
    };
  }

  // ==========================================
  // 2. CONNECTING ROD & BIG END CAP
  // ==========================================
  buildConnectingRod() {
    this.conRodGroup = new THREE.Group();
    this.conRodGroup.name = 'ConnectingRod_Assembly';

    const l = this.kinematics.conRodLength; // 1.38

    // Big-End Eye Upper Body (Aligned along Z axis with rotation.x = Math.PI/2)
    // Angles: thetaStart = Math.PI/2, thetaLength = Math.PI spans y >= 0
    const bigEndUpper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.26, 36, 1, false, Math.PI / 2, Math.PI),
      this.materials.conRod
    );
    bigEndUpper.rotation.x = Math.PI / 2;
    this.conRodGroup.add(bigEndUpper);

    // Bi-metal journal bearing shell (Upper half)
    const bearingShellUpper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.206, 0.206, 0.25, 36, 1, true, Math.PI / 2, Math.PI),
      this.materials.bushing
    );
    bearingShellUpper.rotation.x = Math.PI / 2;
    this.conRodGroup.add(bearingShellUpper);

    // Split Rod Cap (Lower half: spans y <= 0)
    this.rodCapGroup = new THREE.Group();
    this.rodCapGroup.name = 'RodCap_Assembly';

    const bigEndLower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.26, 36, 1, false, -Math.PI / 2, Math.PI),
      this.materials.conRod
    );
    bigEndLower.rotation.x = Math.PI / 2;
    this.rodCapGroup.add(bigEndLower);

    const bearingShellLower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.206, 0.206, 0.25, 36, 1, true, -Math.PI / 2, Math.PI),
      this.materials.bushing
    );
    bearingShellLower.rotation.x = Math.PI / 2;
    this.rodCapGroup.add(bearingShellLower);

    // ARP 2000 Connecting Rod Bolts
    [-0.26, 0.26].forEach((xOff) => {
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.36, 16),
        this.materials.bolts
      );
      bolt.position.set(xOff, -0.16, 0);
      this.rodCapGroup.add(bolt);

      const boltHead = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.068, 0.08, 12),
        this.materials.bolts
      );
      boltHead.position.set(xOff, -0.34, 0);
      this.rodCapGroup.add(boltHead);
    });

    this.conRodGroup.add(this.rodCapGroup);

    // Precision H-Beam Shank
    const shankGroup = new THREE.Group();
    const hLength = l - 0.40;

    // Center Web
    const centerWeb = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, hLength, 0.12),
      this.materials.conRod
    );
    centerWeb.position.y = l / 2;
    shankGroup.add(centerWeb);

    // Flanges (H-Profile)
    [-0.075, 0.075].forEach((zOff) => {
      const flange = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, hLength, 0.035),
        this.materials.conRod
      );
      flange.position.set(0, l / 2, zOff);
      shankGroup.add(flange);
    });

    this.conRodGroup.add(shankGroup);

    // Small-End Eye & Bronze Bushing
    const smallEnd = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.22, 32),
      this.materials.conRod
    );
    smallEnd.rotation.x = Math.PI / 2;
    smallEnd.position.y = l;
    this.conRodGroup.add(smallEnd);

    const smallBushing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.124, 0.124, 0.225, 32, 1, true),
      this.materials.bushing
    );
    smallBushing.rotation.x = Math.PI / 2;
    smallBushing.position.y = l;
    this.conRodGroup.add(smallBushing);

    this.root.add(this.conRodGroup);

    this.parts.conRod = {
      group: this.conRodGroup,
      explodeOffset: new THREE.Vector3(-0.9, 0, 0),
      name: 'Forged 4340 H-Beam Connecting Rod',
      specs: 'Center-to-Center: 138 mm | Pin Bore: 22 mm | Big End: 44 mm | Weight: 480g'
    };

    this.parts.rodCap = {
      group: this.rodCapGroup,
      explodeOffset: new THREE.Vector3(0, -0.65, 0),
      name: 'Split Rod Bearing Cap & ARP Bolts',
      specs: 'Fasteners: ARP 2000 Grade 12.9 M9x1.0 | Clamping Load: 52 kN'
    };
  }

  // ==========================================
  // 3. PISTON ASSEMBLY & RINGS (Clean Hollow Architecture)
  // ==========================================
  buildPiston() {
    this.pistonGroup = new THREE.Group();
    this.pistonGroup.name = 'Piston_Assembly';

    const bore = this.kinematics.bore; // 0.85
    const rOuter = (bore / 2) * 0.985; // 0.418
    const pistonH = 0.62;
    const crownH = 0.14; // Top solid crown thickness
    const pinY = this.kinematics.wristPinHeight; // 0.32

    // 1. Machined Piston Crown (Solid top section from y = pistonH - crownH to pistonH)
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(rOuter, rOuter, crownH, 48),
      this.materials.piston
    );
    crown.position.y = pistonH - crownH / 2;
    this.pistonGroup.add(crown);

    // 2. Hollow Slipper Skirt (Front & rear thrust surfaces, completely open underneath)
    // Slipper skirts leave the pin sides completely open so no intersecting plates occur
    const skirtH = pistonH - crownH;

    // Front Skirt (z > 0)
    const frontSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(rOuter, rOuter, skirtH, 36, 1, true, -Math.PI / 3, (2 * Math.PI) / 3),
      this.materials.piston
    );
    frontSkirt.position.y = skirtH / 2;
    this.pistonGroup.add(frontSkirt);

    // Rear Skirt (z < 0)
    const rearSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(rOuter, rOuter, skirtH, 36, 1, true, (2 * Math.PI) / 3, (2 * Math.PI) / 3),
      this.materials.piston
    );
    rearSkirt.position.y = skirtH / 2;
    this.pistonGroup.add(rearSkirt);

    // 3. Precision CNC Pin Bosses (Sleeves for wrist pin on left & right)
    const bossOuterR = 0.17;
    const bossLength = 0.12; // Wall thickness of each pin boss

    // Front & rear bosses centered at pin height
    [-rOuter + bossLength / 2 + 0.02, rOuter - bossLength / 2 - 0.02].forEach((zPos) => {
      const boss = new THREE.Mesh(
        new THREE.CylinderGeometry(bossOuterR, bossOuterR, bossLength, 32),
        this.materials.piston
      );
      boss.rotation.x = Math.PI / 2;
      boss.position.set(0, pinY, zPos);
      this.pistonGroup.add(boss);
    });

    // 4. Chrome Piston Rings Pack
    this.ringsGroup = new THREE.Group();
    this.ringsGroup.name = 'PistonRings_Pack';

    const ringOffsets = [pistonH - 0.035, pistonH - 0.075, pistonH - 0.115];
    const ringHeights = [0.018, 0.018, 0.026];

    ringOffsets.forEach((yOff, i) => {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(rOuter + 0.005, rOuter + 0.005, ringHeights[i], 48, 1, true),
        this.materials.rings
      );
      ring.position.y = yOff;
      this.ringsGroup.add(ring);
    });

    this.pistonGroup.add(this.ringsGroup);

    // 5. Tool Steel Wrist Pin (Clean mirror-ground cylinder through bosses)
    this.wristPinGroup = new THREE.Group();
    this.wristPinGroup.name = 'WristPin_Assembly';

    const pinRadius = 0.12;
    const pinLength = rOuter * 1.84;
    const wristPin = new THREE.Mesh(
      new THREE.CylinderGeometry(pinRadius, pinRadius, pinLength, 36),
      this.materials.wristPin
    );
    wristPin.rotation.x = Math.PI / 2;
    this.wristPinGroup.add(wristPin);

    // Hollow through-bore
    const hollowCore = new THREE.Mesh(
      new THREE.CylinderGeometry(pinRadius * 0.62, pinRadius * 0.62, pinLength * 1.02, 24),
      new THREE.MeshStandardMaterial({ color: 0x181a1f, metalness: 0.9, roughness: 0.5 })
    );
    hollowCore.rotation.x = Math.PI / 2;
    this.wristPinGroup.add(hollowCore);

    // Wire Circlips at pin ends
    [-pinLength / 2 + 0.015, pinLength / 2 - 0.015].forEach((zOff) => {
      const circlip = new THREE.Mesh(
        new THREE.TorusGeometry(pinRadius * 0.96, 0.01, 8, 24, Math.PI * 1.8),
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
      explodeOffset: new THREE.Vector3(0, 1.4, 0),
      name: 'Forged Racing Piston',
      specs: 'Bore: 85.0 mm | Compression Height: 32 mm | Alloy: 2618-T6 High Strength Aluminum'
    };

    this.parts.wristPin = {
      group: this.wristPinGroup,
      explodeOffset: new THREE.Vector3(0, 0, 1.2),
      name: 'DLC Coated Wrist Pin',
      specs: 'Diameter: 22 mm | Wall: 3.5 mm | Material: Casalloy Nitrided Tool Steel'
    };

    this.parts.rings = {
      group: this.ringsGroup,
      explodeOffset: new THREE.Vector3(0.7, 0.5, 0),
      name: 'Piston Ring Pack',
      specs: 'Top: 1.2mm Gas-Nitrided Steel | 2nd: 1.2mm Napier Scraper | Oil: 2.0mm 3-Piece Flex-Vent'
    };
  }

  // ==========================================
  // 4. ENGINE BLOCK & CRANKCASE
  // ==========================================
  buildEngineBlock() {
    this.engineBlockGroup = new THREE.Group();
    this.engineBlockGroup.name = 'EngineBlock_Assembly';

    const bore = this.kinematics.bore;
    const rBore = bore / 2;
    const blockH = 2.4;

    // 1. Hollow Cylinder Block Casting (Zero geometry inside cylinder bore r < rBore)
    const blockBodyGeom = this.createHollowCylinderGeometry(rBore + 0.005, 0.76, blockH, 48);
    const blockBody = new THREE.Mesh(blockBodyGeom, this.materials.block);
    blockBody.position.y = 1.35;
    this.engineBlockGroup.add(blockBody);

    // 2. Hollow Cooling Fins (Annular rings attached ONLY to outer block surface)
    // Inner radius 0.74 attaches to block; NO geometry exists inside bore!
    const finGeom = this.createHollowCylinderGeometry(0.74, 0.96, 0.045, 48);
    for (let y = 0.55; y <= 2.25; y += 0.24) {
      const fin = new THREE.Mesh(finGeom, this.materials.block);
      fin.position.y = y;
      this.engineBlockGroup.add(fin);
    }

    // 3. Machined Cylinder Sleeve Liner (Thin polished inner liner wall)
    this.cylinderSleeveMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(rBore, rBore, blockH * 0.96, 48, 1, true),
      this.materials.sleeve
    );
    this.cylinderSleeveMesh.position.y = 1.35;
    this.engineBlockGroup.add(this.cylinderSleeveMesh);

    // 4. Hollow Perimeter Crankcase Walls (Leaves central cavity open for crank & rod)
    const wallMat = this.materials.block;
    const caseH = 0.55;
    const caseY = 0.12;

    // Left & Right Crankcase Walls
    [-0.74, 0.74].forEach((xPos) => {
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, caseH, 1.42),
        wallMat
      );
      sideWall.position.set(xPos, caseY, 0);
      this.engineBlockGroup.add(sideWall);
    });

    // Front & Rear Crankcase Walls (with circular bearing arches)
    [-0.64, 0.64].forEach((zPos) => {
      const endWall = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, caseH, 0.16),
        wallMat
      );
      endWall.position.set(0, caseY, zPos);
      this.engineBlockGroup.add(endWall);
    });

    // 5. Oil Pan Sump (Underneath crankcase at y <= -0.28)
    const oilSump = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.25, 1.1),
      wallMat
    );
    oilSump.position.y = -0.32;
    this.engineBlockGroup.add(oilSump);

    // 6. Crankcase Main Bearing Caps (Nitrided steel journal mounts)
    [-0.52, 0.52].forEach((zOff) => {
      const mainCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.14, 24, 1, false, -Math.PI / 2, Math.PI),
        this.materials.conRod
      );
      mainCap.rotation.x = Math.PI / 2;
      mainCap.position.set(0, -0.05, zOff);
      this.engineBlockGroup.add(mainCap);
    });

    this.root.add(this.engineBlockGroup);

    this.parts.block = {
      group: this.engineBlockGroup,
      explodeOffset: new THREE.Vector3(1.6, 0, 1.0),
      name: 'Engine Block & Cylinder Liner',
      specs: 'Material: A356-T6 Aluminum with Ductile Iron Wet Sleeve | Bore: 85 mm | Stroke: 88 mm'
    };
  }

  // ==========================================
  // 5. CYLINDER HEAD & MANIFOLDS
  // ==========================================
  buildCylinderHead() {
    this.cylinderHeadGroup = new THREE.Group();
    this.cylinderHeadGroup.name = 'CylinderHead_Assembly';

    const headH = 0.95;
    const headMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.86, 0.82, headH, 36),
      this.materials.block
    );
    headMesh.position.y = 2.88;
    this.cylinderHeadGroup.add(headMesh);

    // Head Studs & 12-Point Nuts
    const studR = 0.56;
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((angle) => {
      const stud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 1.1, 16),
        this.materials.bolts
      );
      stud.position.set(studR * Math.cos(angle), 2.88, studR * Math.sin(angle));
      this.cylinderHeadGroup.add(stud);

      const studNut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.09, 12),
        this.materials.bolts
      );
      studNut.position.set(studR * Math.cos(angle), 3.42, studR * Math.sin(angle));
      this.cylinderHeadGroup.add(studNut);
    });

    // Intake Manifold Port Runner (Left)
    const intakeRunner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.58, 24),
      this.materials.block
    );
    intakeRunner.rotation.z = Math.PI / 3;
    intakeRunner.position.set(-0.5, 2.88, 0);
    this.cylinderHeadGroup.add(intakeRunner);

    // Throttle Body Flange
    const throttleFlange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.06, 24),
      this.materials.conRod
    );
    throttleFlange.rotation.z = Math.PI / 3;
    throttleFlange.position.set(-0.75, 3.02, 0);
    this.cylinderHeadGroup.add(throttleFlange);

    // Exhaust Manifold Port Runner (Right)
    const exhaustRunner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.58, 24),
      this.materials.conRod
    );
    exhaustRunner.rotation.z = -Math.PI / 3;
    exhaustRunner.position.set(0.5, 2.88, 0);
    this.cylinderHeadGroup.add(exhaustRunner);

    // Exhaust Header Flange
    const exhaustFlange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.06, 24),
      this.materials.crankshaft
    );
    exhaustFlange.rotation.z = -Math.PI / 3;
    exhaustFlange.position.set(0.75, 3.02, 0);
    this.cylinderHeadGroup.add(exhaustFlange);

    this.root.add(this.cylinderHeadGroup);

    this.parts.cylinderHead = {
      group: this.cylinderHeadGroup,
      explodeOffset: new THREE.Vector3(0, 1.8, 0),
      name: 'Cross-Flow DOHC Cylinder Head',
      specs: 'Pent-Roof 4-Valve Chamber | Sintered Valve Seats | CNC High-Velocity Ports'
    };
  }

  // ==========================================
  // 6. VALVETRAIN (VALVES, SPRINGS, CAMSHAFT)
  // ==========================================
  buildValvetrain() {
    const valveAngle = 0.22; // ~12.6 degrees canted

    // A. Intake Valve Assembly
    this.intakeValveGroup = new THREE.Group();
    this.intakeValveGroup.name = 'IntakeValve_Assembly';

    const intakeHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.21, 0.065, 32),
      this.materials.valveIntake
    );
    intakeHead.rotation.x = Math.PI;
    this.intakeValveGroup.add(intakeHead);

    const intakeStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.98, 16),
      this.materials.valveIntake
    );
    intakeStem.position.y = 0.49;
    this.intakeValveGroup.add(intakeStem);

    this.intakeSpringMesh = this.createValveSpring(this.materials.spring);
    this.intakeSpringMesh.position.y = 0.35;
    this.intakeValveGroup.add(this.intakeSpringMesh);

    const intakeRetainer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.08, 0.05, 24),
      this.materials.retainer
    );
    intakeRetainer.position.y = 0.88;
    this.intakeValveGroup.add(intakeRetainer);

    this.intakeValveBasePos = new THREE.Vector3(-0.20, 2.42, 0);
    this.intakeValveGroup.position.copy(this.intakeValveBasePos);
    this.intakeValveGroup.rotation.z = valveAngle;
    this.root.add(this.intakeValveGroup);

    // B. Exhaust Valve Assembly
    this.exhaustValveGroup = new THREE.Group();
    this.exhaustValveGroup.name = 'ExhaustValve_Assembly';

    const exhaustHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.065, 32),
      this.materials.valveExhaust
    );
    exhaustHead.rotation.x = Math.PI;
    this.exhaustValveGroup.add(exhaustHead);

    const exhaustStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.98, 16),
      this.materials.valveExhaust
    );
    exhaustStem.position.y = 0.49;
    this.exhaustValveGroup.add(exhaustStem);

    this.exhaustSpringMesh = this.createValveSpring(this.materials.spring);
    this.exhaustSpringMesh.position.y = 0.35;
    this.exhaustValveGroup.add(this.exhaustSpringMesh);

    const exhaustRetainer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.08, 0.05, 24),
      this.materials.retainer
    );
    exhaustRetainer.position.y = 0.88;
    this.exhaustValveGroup.add(exhaustRetainer);

    this.exhaustValveBasePos = new THREE.Vector3(0.20, 2.42, 0);
    this.exhaustValveGroup.position.copy(this.exhaustValveBasePos);
    this.exhaustValveGroup.rotation.z = -valveAngle;
    this.root.add(this.exhaustValveGroup);

    // C. Overhead Camshaft with Precision Lobes
    this.camshaftGroup = new THREE.Group();
    this.camshaftGroup.name = 'Camshaft_Assembly';

    const camShaftMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 1.25, 24),
      this.materials.camshaft
    );
    camShaftMesh.rotation.x = Math.PI / 2;
    this.camshaftGroup.add(camShaftMesh);

    [-0.18, 0.18].forEach((zOff, i) => {
      const lobeShape = new THREE.Shape();
      lobeShape.absarc(0, 0, 0.09, 0, Math.PI, false);
      lobeShape.lineTo(0.07, -0.16);
      lobeShape.quadraticCurveTo(0, -0.23, -0.07, -0.16);
      lobeShape.closePath();

      const lobeGeom = new THREE.ExtrudeGeometry(lobeShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015 });
      const lobe = new THREE.Mesh(lobeGeom, this.materials.camshaft);
      lobe.position.z = zOff - 0.06;
      lobe.rotation.z = i === 0 ? 0 : Math.PI * 0.75;
      this.camshaftGroup.add(lobe);
    });

    this.camshaftGroup.position.set(0, 3.44, 0);
    this.root.add(this.camshaftGroup);

    this.parts.intakeValve = {
      group: this.intakeValveGroup,
      explodeOffset: new THREE.Vector3(-0.65, 1.2, 0),
      name: 'EV8 Stainless Intake Valve & Spring',
      specs: 'Head: 35.0 mm | Stem: 5.5 mm | Lift: 10.2 mm | PAC Dual Springs'
    };

    this.parts.exhaustValve = {
      group: this.exhaustValveGroup,
      explodeOffset: new THREE.Vector3(0.65, 1.2, 0),
      name: 'Inconel 751 Exhaust Valve & Spring',
      specs: 'Head: 30.0 mm | Stem: 5.5 mm | Lift: 9.8 mm | High-Thermal Superalloy'
    };

    this.parts.camshaft = {
      group: this.camshaftGroup,
      explodeOffset: new THREE.Vector3(0, 1.5, -0.8),
      name: 'DOHC Billet Camshaft',
      specs: 'Profile: 264° Advertised Duration | 10.5mm Max Lift | 1:2 Crank Ratio'
    };
  }

  createValveSpring(mat) {
    const springGroup = new THREE.Group();
    const coils = 6.5;
    const rSpring = 0.085;
    const hSpring = 0.44;
    const wireR = 0.016;

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
    const mesh = new THREE.Mesh(geom, mat);
    springGroup.add(mesh);
    return springGroup;
  }

  // ==========================================
  // 7. SPARK PLUG & IGNITION ARC
  // ==========================================
  buildSparkPlug() {
    this.sparkPlugGroup = new THREE.Group();
    this.sparkPlugGroup.name = 'SparkPlug_Assembly';

    // Ribbed Alumina Ceramic Insulator
    const ceramicGeom = new THREE.CylinderGeometry(0.07, 0.08, 0.56, 24);
    const ceramic = new THREE.Mesh(ceramicGeom, this.materials.sparkCeramic);
    ceramic.position.y = 0.5;
    this.sparkPlugGroup.add(ceramic);

    // 5 Corrugation Ribs
    for (let y = 0.36; y <= 0.64; y += 0.07) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(0.078, 0.011, 8, 24),
        this.materials.sparkCeramic
      );
      rib.rotation.x = Math.PI / 2;
      rib.position.y = y;
      this.sparkPlugGroup.add(rib);
    }

    // Hex Body & Threaded Barrel
    const hexNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.12, 6),
      this.materials.sparkMetal
    );
    hexNut.position.y = 0.18;
    this.sparkPlugGroup.add(hexNut);

    const threadedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.22, 24),
      this.materials.sparkMetal
    );
    threadedBase.position.y = 0.02;
    this.sparkPlugGroup.add(threadedBase);

    // Ground & Central Electrodes
    const groundArm1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.075, 0.016),
      this.materials.sparkMetal
    );
    groundArm1.position.set(0.055, -0.115, 0);
    this.sparkPlugGroup.add(groundArm1);

    const groundArm2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.016, 0.016),
      this.materials.sparkMetal
    );
    groundArm2.position.set(0.03, -0.15, 0);
    this.sparkPlugGroup.add(groundArm2);

    const centerPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.08, 16),
      this.materials.wristPin
    );
    centerPin.position.set(0, -0.115, 0);
    this.sparkPlugGroup.add(centerPin);

    // Glowing Arc Line
    const sparkArcGeom = new THREE.BufferGeometry();
    const arcVertices = new Float32Array([
      0, -0.135, 0,
      0.01, -0.142, 0.005,
      0.02, -0.14, -0.005,
      0.03, -0.15, 0
    ]);
    sparkArcGeom.setAttribute('position', new THREE.BufferAttribute(arcVertices, 3));
    this.sparkArcMesh = new THREE.Line(sparkArcGeom, this.materials.sparkArc);
    this.sparkPlugGroup.add(this.sparkArcMesh);

    // Dynamic Spark PointLight
    this.sparkLight = new THREE.PointLight(0x80d8ff, 0, 1.8, 2.0);
    this.sparkLight.position.set(0, -0.14, 0);
    this.sparkPlugGroup.add(this.sparkLight);

    this.sparkPlugBasePos = new THREE.Vector3(0, 2.46, 0);
    this.sparkPlugGroup.position.copy(this.sparkPlugBasePos);
    this.root.add(this.sparkPlugGroup);

    this.parts.sparkPlug = {
      group: this.sparkPlugGroup,
      explodeOffset: new THREE.Vector3(0, 2.2, 0),
      name: 'Iridium IX Racing Spark Plug',
      specs: 'Electrode: 0.6 mm Laser-Welded Iridium | Gap: 0.8 mm | Thread: M14 x 1.25'
    };
  }

  // ==========================================
  // 8. COMBUSTION CHAMBER GAS DYNAMICS
  // ==========================================
  buildCombustionGasVolume() {
    const bore = this.kinematics.bore;
    const rBore = (bore / 2) * 0.985;

    this.gasGeom = new THREE.CylinderGeometry(rBore, rBore, 1.0, 36, 1, false);
    this.gasMesh = new THREE.Mesh(this.gasGeom, this.materials.combustionGas);
    this.gasMesh.position.set(0, 2.0, 0);
    this.root.add(this.gasMesh);
  }

  registerExplodeOffsets() {
    for (const key in this.parts) {
      const part = this.parts[key];
      part.basePos = part.group.position.clone();
      part.baseRot = part.group.rotation.clone();
    }
  }

  setExplodeFactor(factor) {
    this.explodeFactor = Math.max(0, Math.min(1, factor));

    for (const key in this.parts) {
      const part = this.parts[key];
      if (part.explodeOffset) {
        const targetPos = part.basePos.clone().add(
          part.explodeOffset.clone().multiplyScalar(this.explodeFactor)
        );

        if (key === 'piston' || key === 'conRod' || key === 'rodCap' || key === 'intakeValve' || key === 'exhaustValve') {
          part.currentExplodeOffset = part.explodeOffset.clone().multiplyScalar(this.explodeFactor);
        } else {
          part.group.position.copy(targetPos);
        }
      }
    }
  }

  update(kinematicsState) {
    const theta = this.kinematics.crankAngle;
    const explodeT = this.explodeFactor;

    // 1. Crankshaft Rotation
    this.crankshaftGroup.rotation.z = -theta;
    if (this.parts.crankshaft) {
      const basePos = this.parts.crankshaft.basePos.clone();
      const expOff = this.parts.crankshaft.explodeOffset.clone().multiplyScalar(explodeT);
      this.crankshaftGroup.position.copy(basePos.add(expOff));
    }

    // 2. Connecting Rod Kinematics
    const crankPin = kinematicsState.crankPinPos;
    const conRodTilt = kinematicsState.conRodAngle;
    const conRodExplode = this.parts.conRod.currentExplodeOffset || new THREE.Vector3();

    this.conRodGroup.position.set(
      crankPin.x + conRodExplode.x,
      crankPin.y + conRodExplode.y,
      crankPin.z + conRodExplode.z
    );
    this.conRodGroup.rotation.z = conRodTilt;

    // 3. Piston Reciprocation
    const pistonPos = kinematicsState.pistonPos;
    const pistonExplode = this.parts.piston.currentExplodeOffset || new THREE.Vector3();

    this.pistonGroup.position.set(
      pistonPos.x + pistonExplode.x,
      pistonPos.y - this.kinematics.wristPinHeight + pistonExplode.y,
      pistonPos.z + pistonExplode.z
    );

    // 4. Valve Lifts
    const intakeExplode = this.parts.intakeValve.currentExplodeOffset || new THREE.Vector3();
    const intakeLiftOffset = kinematicsState.intakeValveLift * 0.14;
    this.intakeValveGroup.position.set(
      this.intakeValveBasePos.x + intakeExplode.x - Math.sin(0.22) * intakeLiftOffset,
      this.intakeValveBasePos.y + intakeExplode.y - Math.cos(0.22) * intakeLiftOffset,
      this.intakeValveBasePos.z + intakeExplode.z
    );
    const intakeSpringScale = 1 - kinematicsState.intakeValveLift * 0.3;
    this.intakeSpringMesh.scale.set(1, Math.max(0.65, intakeSpringScale), 1);

    const exhaustExplode = this.parts.exhaustValve.currentExplodeOffset || new THREE.Vector3();
    const exhaustLiftOffset = kinematicsState.exhaustValveLift * 0.14;
    this.exhaustValveGroup.position.set(
      this.exhaustValveBasePos.x + exhaustExplode.x + Math.sin(0.22) * exhaustLiftOffset,
      this.exhaustValveBasePos.y + exhaustExplode.y - Math.cos(0.22) * exhaustLiftOffset,
      this.exhaustValveBasePos.z + exhaustExplode.z
    );
    const exhaustSpringScale = 1 - kinematicsState.exhaustValveLift * 0.3;
    this.exhaustSpringMesh.scale.set(1, Math.max(0.65, exhaustSpringScale), 1);

    // 5. Camshaft (1/2 crank speed)
    this.camshaftGroup.rotation.z = -theta * 0.5;

    // 6. Spark Plug Arc Plasma
    if (kinematicsState.sparkPlugFiring) {
      this.materials.sparkArc.opacity = 1.0;
      this.sparkLight.intensity = 3.5 + Math.random() * 2.0;
      const posAttr = this.sparkArcMesh.geometry.attributes.position;
      posAttr.setXYZ(1, 0.01 + (Math.random() - 0.5) * 0.015, -0.142 + (Math.random() - 0.5) * 0.008, 0.005);
      posAttr.setXYZ(2, 0.02 + (Math.random() - 0.5) * 0.015, -0.14 + (Math.random() - 0.5) * 0.008, -0.005);
      posAttr.needsUpdate = true;
    } else {
      this.materials.sparkArc.opacity = 0.0;
      this.sparkLight.intensity = 0;
    }

    // 7. Dynamic Combustion Chamber Gas Volume
    const headRoofY = 2.38;
    const crownTopY = pistonPos.y - this.kinematics.wristPinHeight + 0.62;
    const gasHeight = Math.max(0.12, headRoofY - crownTopY);
    const gasCenterY = crownTopY + gasHeight / 2;

    this.gasMesh.scale.set(1, gasHeight, 1);
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
    } else { // 'EXHAUST'
      this.materials.combustionGas.color.setHex(0xdf3e18);
      this.materials.combustionGas.emissive.setHex(0x551105);
      this.materials.combustionGas.emissiveIntensity = 0.35 * (1 - prog);
      this.materials.combustionGas.opacity = 0.45 * (1 - prog);
    }
  }
}
