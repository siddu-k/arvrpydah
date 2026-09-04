/**
 * 4-Stroke Engine Photorealistic 3D Model Generator
 * High-precision CAD model reconstructed directly from automotive cross-section blueprints.
 * Features:
 * - Liquid-cooled engine block with internal water jackets
 * - Pent-roof cylinder head with deep central spark plug valley
 * - Slipper piston with rectangular pin boss panel and hollow interior
 * - Tapered H-beam forged connecting rod with 12-point ARP rod bolts
 * - Aerodynamic sickle counterweight crankshaft with circular lightening pockets
 * - Ribbed lower oil pan with base cooling fins
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

    this.createBrushedTextures();
    this.setupClippingPlanes();
    this.createMaterials();
    this.buildEngine();
  }

  createBrushedTextures() {
    // Brushed metal texture
    const canvasB = document.createElement('canvas');
    canvasB.width = 512;
    canvasB.height = 512;
    const ctxB = canvasB.getContext('2d');
    ctxB.fillStyle = '#808080';
    ctxB.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 2500; i++) {
      const y = Math.random() * 512;
      const len = 30 + Math.random() * 100;
      const x = Math.random() * 512;
      const val = Math.floor(105 + Math.random() * 45);
      ctxB.fillStyle = `rgb(${val}, ${val}, ${val})`;
      ctxB.fillRect(x, y, len, 1);
    }

    this.brushedTex = new THREE.CanvasTexture(canvasB);
    this.brushedTex.wrapS = THREE.RepeatWrapping;
    this.brushedTex.wrapT = THREE.RepeatWrapping;
    this.brushedTex.repeat.set(2, 2);

    // Cast metal texture
    const canvasC = document.createElement('canvas');
    canvasC.width = 512;
    canvasC.height = 512;
    const ctxC = canvasC.getContext('2d');
    const imgData = ctxC.createImageData(512, 512);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const val = Math.floor(115 + Math.random() * 26);
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
    ctxC.putImageData(imgData, 0, 0);

    this.castTex = new THREE.CanvasTexture(canvasC);
    this.castTex.wrapS = THREE.RepeatWrapping;
    this.castTex.wrapT = THREE.RepeatWrapping;
    this.castTex.repeat.set(4, 4);
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
    // 1. Engine Block: Precision Machined Cast Aluminum Alloy (Blueprint Grey)
    this.materials.block = new THREE.MeshStandardMaterial({
      color: 0x98a2af,
      metalness: 0.88,
      roughness: 0.35,
      bumpMap: this.castTex,
      bumpScale: 0.002,
      name: 'Cast Aluminum Block',
      side: THREE.DoubleSide
    });

    // 2. Cylinder Sleeve: Honed Ductile Cast Iron Liner
    this.materials.sleeve = new THREE.MeshStandardMaterial({
      color: 0xbac5d2,
      metalness: 0.94,
      roughness: 0.16,
      bumpMap: this.brushedTex,
      bumpScale: 0.0015,
      name: 'Honed Ductile Iron Sleeve',
      side: THREE.DoubleSide
    });

    // 3. Coolant Jacket Volume (Liquid Coolant Channel)
    this.materials.coolant = new THREE.MeshStandardMaterial({
      color: 0x2277cc,
      metalness: 0.3,
      roughness: 0.2,
      transparent: true,
      opacity: 0.55,
      name: 'Engine Coolant Jacket'
    });

    // 4. Piston: CNC Forged 2618-T6 Aluminum Alloy
    this.materials.piston = new THREE.MeshStandardMaterial({
      color: 0xd8e1ec,
      metalness: 0.95,
      roughness: 0.15,
      bumpMap: this.brushedTex,
      bumpScale: 0.001,
      name: 'Forged 2618-T6 Aluminum Piston',
      side: THREE.DoubleSide
    });

    // 5. Piston Compression & Oil Control Rings: Mirror-Polished Chrome
    this.materials.rings = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.99,
      roughness: 0.04,
      name: 'Mirror-Polished Chrome Rings'
    });

    // 6. Wrist Pin: Ground Hardened Tool Steel
    this.materials.wristPin = new THREE.MeshStandardMaterial({
      color: 0xeef3f8,
      metalness: 0.98,
      roughness: 0.06,
      name: 'Precision Ground Tool Steel Pin'
    });

    // 7. Phosphor Bronze Bushing
    this.materials.bushing = new THREE.MeshStandardMaterial({
      color: 0xc6964a,
      metalness: 0.88,
      roughness: 0.22,
      name: 'Phosphor Bronze Bushing'
    });

    // 8. Connecting Rod: Forged 4340 Chromoly Steel (Tapered H-Beam)
    this.materials.conRod = new THREE.MeshStandardMaterial({
      color: 0x939da9,
      metalness: 0.92,
      roughness: 0.2,
      bumpMap: this.brushedTex,
      bumpScale: 0.0018,
      name: 'Forged 4340 H-Beam Con-Rod'
    });

    // 9. Fasteners: Grade 12.9 Black Oxide Bolts
    this.materials.bolts = new THREE.MeshStandardMaterial({
      color: 0x20242a,
      metalness: 0.86,
      roughness: 0.36,
      name: 'Grade 12.9 Fasteners'
    });

    // 10. Crankshaft: Nitrided Forged Steel with Polished Journals
    this.materials.crankshaft = new THREE.MeshStandardMaterial({
      color: 0x7c8592,
      metalness: 0.92,
      roughness: 0.18,
      bumpMap: this.castTex,
      bumpScale: 0.002,
      name: 'Forged Nitrided Crankshaft'
    });

    // 11. Stainless Steel Intake Valve
    this.materials.valveIntake = new THREE.MeshStandardMaterial({
      color: 0xc8d2dc,
      metalness: 0.95,
      roughness: 0.12,
      name: 'Stainless Intake Valve'
    });

    // 12. Inconel 751 Heat-Resistant Exhaust Valve
    this.materials.valveExhaust = new THREE.MeshStandardMaterial({
      color: 0x9ba4af,
      metalness: 0.92,
      roughness: 0.18,
      name: 'Inconel 751 Exhaust Valve'
    });

    // 13. Dual Valve Springs
    this.materials.spring = new THREE.MeshStandardMaterial({
      color: 0x3d434c,
      metalness: 0.95,
      roughness: 0.16,
      name: 'Valve Springs'
    });

    // 14. Titanium Retainers
    this.materials.retainer = new THREE.MeshStandardMaterial({
      color: 0x8a929d,
      metalness: 0.92,
      roughness: 0.18,
      name: 'Titanium Retainers'
    });

    // 15. Spark Plug Porcelain Ceramic
    this.materials.sparkCeramic = new THREE.MeshStandardMaterial({
      color: 0xfafbfc,
      metalness: 0.04,
      roughness: 0.1,
      name: 'Alumina Ceramic Insulator'
    });

    // 16. Spark Plug Shell
    this.materials.sparkMetal = new THREE.MeshStandardMaterial({
      color: 0xa2abb7,
      metalness: 0.94,
      roughness: 0.24,
      name: 'Galvanized Steel Shell'
    });

    // 17. Combustion Chamber Gas Volume
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

    // 18. Spark Arc Plasma
    this.materials.sparkArc = new THREE.MeshBasicMaterial({
      color: 0xa8e5ff,
      transparent: true,
      opacity: 0.0,
      name: 'Ignition Plasma Arc'
    });

    // Clippable materials
    this.clippableMaterials = [
      this.materials.block,
      this.materials.sleeve,
      this.materials.coolant
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
      this.materials.block.opacity = 0.22;
      this.materials.block.roughness = 0.1;
      this.materials.sleeve.transparent = true;
      this.materials.sleeve.opacity = 0.38;
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
    this.materials.block.roughness = 0.35;
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
  // 1. BLUEPRINT SICKLE COUNTERWEIGHT CRANKSHAFT (Image 1 & 2)
  // ==========================================
  buildCrankshaft() {
    this.crankshaftGroup = new THREE.Group();
    this.crankshaftGroup.name = 'Crankshaft_Assembly';

    const r = this.kinematics.crankRadius; // 0.44

    // Main Bearing Journals (Front & Rear)
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

    // Exact Blueprint Sickle Counterweight Profile (Image 1 & 2)
    const sickleShape = new THREE.Shape();
    sickleShape.moveTo(-0.16, r + 0.15);
    sickleShape.quadraticCurveTo(0, r + 0.26, 0.26, r + 0.12);
    sickleShape.lineTo(0.38, 0.05);
    sickleShape.quadraticCurveTo(0.62, -0.38, 0.48, -0.74);
    sickleShape.quadraticCurveTo(0.12, -0.88, -0.28, -0.80);
    sickleShape.quadraticCurveTo(-0.64, -0.66, -0.52, -0.28);
    sickleShape.lineTo(-0.35, 0.08);
    sickleShape.closePath();

    const extrudeSettings = {
      depth: 0.18,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025
    };

    // Front Web
    const webFront = new THREE.Mesh(new THREE.ExtrudeGeometry(sickleShape, extrudeSettings), this.materials.crankshaft);
    webFront.position.set(0, 0, 0.16);
    this.crankshaftGroup.add(webFront);

    // Rear Web
    const webRear = new THREE.Mesh(new THREE.ExtrudeGeometry(sickleShape, extrudeSettings), this.materials.crankshaft);
    webRear.position.set(0, 0, -0.34);
    this.crankshaftGroup.add(webRear);

    // Circular Lightening/Balance Pockets (prominently visible in Blueprint Image 1 & 2!)
    [-0.26, 0.26].forEach((zOff) => {
      const pocket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.06, 32),
        new THREE.MeshStandardMaterial({ color: 0x1d2127, metalness: 0.9, roughness: 0.4 })
      );
      pocket.rotation.x = Math.PI / 2;
      pocket.position.set(0.14, r - 0.05, zOff);
      this.crankshaftGroup.add(pocket);
    });

    // Crankpin Journal (Polished ground bearing surface)
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

    // Rear Flywheel
    const flywheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.78, 0.12, 48),
      this.materials.crankshaft
    );
    flywheel.rotation.x = Math.PI / 2;
    flywheel.position.z = -0.86;
    this.crankshaftGroup.add(flywheel);

    // Flywheel ring gear
    const ringGear = new THREE.Mesh(
      new THREE.TorusGeometry(0.77, 0.024, 8, 64),
      this.materials.bolts
    );
    ringGear.position.z = -0.86;
    this.crankshaftGroup.add(ringGear);

    // Front pulley
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
      name: 'Sickle Counterweight Crankshaft',
      specs: 'Stroke: 88 mm | Crankpin: 40 mm | Aerodynamic Sickle Balance Webs'
    };
  }

  // ==========================================
  // 2. BLUEPRINT TAPERED H-BEAM CONNECTING ROD (Image 1, 2, 3)
  // ==========================================
  buildConnectingRod() {
    this.conRodGroup = new THREE.Group();
    this.conRodGroup.name = 'ConnectingRod_Assembly';

    const l = this.kinematics.conRodLength; // 1.38

    // Big-End Eye Upper Body (Aligned along Z axis)
    const bigEndUpper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.26, 36, 1, false, Math.PI / 2, Math.PI),
      this.materials.conRod
    );
    bigEndUpper.rotation.x = Math.PI / 2;
    this.conRodGroup.add(bigEndUpper);

    // Bi-metal journal bearing shell (Upper)
    const bearingShellUpper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.206, 0.206, 0.25, 36, 1, true, Math.PI / 2, Math.PI),
      this.materials.bushing
    );
    bearingShellUpper.rotation.x = Math.PI / 2;
    this.conRodGroup.add(bearingShellUpper);

    // Split Rod Cap (Lower half)
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

    // 12-Point ARP Rod Bolts (threading upward from below cap)
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

    // Tapered H-Beam Shank (Narrower at small end, wider at big end)
    const shankGroup = new THREE.Group();
    const hLength = l - 0.40;

    // Tapered Center Web
    const webShape = new THREE.Shape();
    webShape.moveTo(-0.09, 0);       // Big end width 0.18
    webShape.lineTo(0.09, 0);
    webShape.lineTo(0.06, hLength);  // Small end width 0.12
    webShape.lineTo(-0.06, hLength);
    webShape.closePath();

    const webGeom = new THREE.ExtrudeGeometry(webShape, { depth: 0.065, bevelEnabled: false });
    webGeom.center();
    const centerWeb = new THREE.Mesh(webGeom, this.materials.conRod);
    centerWeb.position.y = l / 2;
    shankGroup.add(centerWeb);

    // Tapered Side Flanges (H-Profile)
    [-0.075, 0.075].forEach((zOff) => {
      const flangeShape = new THREE.Shape();
      flangeShape.moveTo(-0.11, 0);
      flangeShape.lineTo(0.11, 0);
      flangeShape.lineTo(0.08, hLength);
      flangeShape.lineTo(-0.08, hLength);
      flangeShape.closePath();

      const flangeGeom = new THREE.ExtrudeGeometry(flangeShape, { depth: 0.035, bevelEnabled: false });
      flangeGeom.center();
      const flange = new THREE.Mesh(flangeGeom, this.materials.conRod);
      flange.position.set(0, l / 2, zOff);
      shankGroup.add(flange);
    });

    this.conRodGroup.add(shankGroup);

    // Small-End Eye & Phosphor Bronze Bushing
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
      name: 'Tapered H-Beam Connecting Rod',
      specs: 'Center-to-Center: 138 mm | Tapered Shank: 12mm to 18mm | Forged 4340 Steel'
    };

    this.parts.rodCap = {
      group: this.rodCapGroup,
      explodeOffset: new THREE.Vector3(0, -0.65, 0),
      name: 'Split Rod Bearing Cap & 12-Pt Bolts',
      specs: 'Fasteners: ARP 2000 Grade 12.9 M9x1.0 | Clamping Load: 52 kN'
    };
  }

  // ==========================================
  // 3. BLUEPRINT SLIPPER PISTON WITH RECTANGULAR PIN PANEL (Image 1 & 2)
  // ==========================================
  buildPiston() {
    this.pistonGroup = new THREE.Group();
    this.pistonGroup.name = 'Piston_Assembly';

    const bore = this.kinematics.bore; // 0.85
    const rOuter = (bore / 2) * 0.985; // 0.418
    const pistonH = 0.62;
    const crownH = 0.14;
    const pinY = this.kinematics.wristPinHeight; // 0.32

    // 1. Machined Piston Crown
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(rOuter, rOuter, crownH, 48),
      this.materials.piston
    );
    crown.position.y = pistonH - crownH / 2;
    this.pistonGroup.add(crown);

    // Shallow combustion dish on crown
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.26, 0.02, 32),
      this.materials.piston
    );
    dish.position.y = pistonH - 0.005;
    this.pistonGroup.add(dish);

    // 2. Hollow Slipper Skirt (Front & Rear Thrust Skirts)
    const skirtH = pistonH - crownH;

    const frontSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(rOuter, rOuter, skirtH, 36, 1, true, -Math.PI / 3, (2 * Math.PI) / 3),
      this.materials.piston
    );
    frontSkirt.position.y = skirtH / 2;
    this.pistonGroup.add(frontSkirt);

    const rearSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(rOuter, rOuter, skirtH, 36, 1, true, (2 * Math.PI) / 3, (2 * Math.PI) / 3),
      this.materials.piston
    );
    rearSkirt.position.y = skirtH / 2;
    this.pistonGroup.add(rearSkirt);

    // 3. Rectangular Wrist Pin Boss Recessed Panels (prominently seen in Blueprint Image 1 & 2!)
    [-rOuter + 0.015, rOuter - 0.015].forEach((zPos) => {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.26, 0.025),
        this.materials.piston
      );
      panel.position.set(0, pinY, zPos);
      this.pistonGroup.add(panel);

      // Pin Hole Chamfer Bevel Ring
      const chamfer = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.015, 8, 32),
        this.materials.piston
      );
      chamfer.position.set(0, pinY, zPos);
      this.pistonGroup.add(chamfer);
    });

    // Pin Boss Cylindrical Sleeves inside skirt
    [-rOuter + 0.06, rOuter - 0.06].forEach((zPos) => {
      const boss = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.08, 32),
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

    // 5. Tool Steel Wrist Pin (Hollow Through-Bore)
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

    // Hollow through-core
    const hollowCore = new THREE.Mesh(
      new THREE.CylinderGeometry(pinRadius * 0.62, pinRadius * 0.62, pinLength * 1.02, 24),
      new THREE.MeshStandardMaterial({ color: 0x181a1f, metalness: 0.9, roughness: 0.5 })
    );
    hollowCore.rotation.x = Math.PI / 2;
    this.wristPinGroup.add(hollowCore);

    // Wire Circlips
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
      name: 'Blueprint CNC Forged Slipper Piston',
      specs: 'Bore: 85.0 mm | Compression Height: 32 mm | Recessed Pin Boss Architecture'
    };

    this.parts.wristPin = {
      group: this.wristPinGroup,
      explodeOffset: new THREE.Vector3(0, 0, 1.2),
      name: 'Hollow Tool Steel Wrist Pin',
      specs: 'Diameter: 22 mm | Wall: 3.5 mm | Ground Nitrided Finish'
    };

    this.parts.rings = {
      group: this.ringsGroup,
      explodeOffset: new THREE.Vector3(0.7, 0.5, 0),
      name: 'Chrome Piston Ring Pack',
      specs: 'Top: 1.2mm Gas-Nitrided | 2nd: 1.2mm Napier | Oil: 2.0mm 3-Piece'
    };
  }

  // ==========================================
  // 4. BLUEPRINT LIQUID-COOLED ENGINE BLOCK & FINNED SUMP (Image 1, 2, 3)
  // ==========================================
  buildEngineBlock() {
    this.engineBlockGroup = new THREE.Group();
    this.engineBlockGroup.name = 'EngineBlock_Assembly';

    const bore = this.kinematics.bore;
    const rBore = bore / 2; // 0.425
    const blockH = 2.4;

    // 1. Solid Outer Cast Block Housing (Smooth volumetric walls like Image 1 & 2)
    const blockOuterGeom = this.createHollowCylinderGeometry(0.62, 0.84, blockH, 48);
    const blockOuter = new THREE.Mesh(blockOuterGeom, this.materials.block);
    blockOuter.position.y = 1.35;
    this.engineBlockGroup.add(blockOuter);

    // 2. Liquid Coolant Jacket Volume (Annular chamber between r = 0.48 and r = 0.62)
    const coolantGeom = this.createHollowCylinderGeometry(rBore + 0.035, 0.615, blockH * 0.75, 48);
    const coolantMesh = new THREE.Mesh(coolantGeom, this.materials.coolant);
    coolantMesh.position.y = 1.45;
    this.engineBlockGroup.add(coolantMesh);

    // 3. Ductile Iron Cylinder Sleeve Liner (Machined inner bore wall)
    this.cylinderSleeveMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(rBore, rBore, blockH * 0.96, 48, 1, true),
      this.materials.sleeve
    );
    this.cylinderSleeveMesh.position.y = 1.35;
    this.engineBlockGroup.add(this.cylinderSleeveMesh);

    // 4. Belled Lower Crankcase Housing (Flared out like Image 2 & 3)
    const bellMat = this.materials.block;
    const bellH = 0.75;
    const bellY = 0.15;

    // Outer Flared Walls
    [-0.78, 0.78].forEach((xPos) => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, bellH, 1.46),
        bellMat
      );
      wall.position.set(xPos, bellY, 0);
      this.engineBlockGroup.add(wall);
    });

    [-0.66, 0.66].forEach((zPos) => {
      const endWall = new THREE.Mesh(
        new THREE.BoxGeometry(1.38, bellH, 0.18),
        bellMat
      );
      endWall.position.set(0, bellY, zPos);
      this.engineBlockGroup.add(endWall);
    });

    // 5. Ribbed Oil Pan with Underside Cooling Fins (Exact match for Image 3 bottom!)
    const oilPanBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 0.28, 1.2),
      bellMat
    );
    oilPanBody.position.y = -0.32;
    this.engineBlockGroup.add(oilPanBody);

    // Vertical Cooling Fins on Underside of Sump (Image 3)
    for (let x = -0.55; x <= 0.55; x += 0.12) {
      const sumpFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.12, 1.05),
        bellMat
      );
      sumpFin.position.set(x, -0.50, 0);
      this.engineBlockGroup.add(sumpFin);
    }

    // Drain plug at center bottom
    const drainPlug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6),
      this.materials.bolts
    );
    drainPlug.position.set(0, -0.56, 0);
    this.engineBlockGroup.add(drainPlug);

    // 6. Crankcase Main Bearing Caps
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
      name: 'Liquid-Cooled Engine Block & Finned Sump',
      specs: 'Material: A356-T6 Aluminum with Internal Coolant Jackets | Ribbed Finned Sump'
    };
  }

  // ==========================================
  // 5. BLUEPRINT PENT-ROOF CYLINDER HEAD & SPARK PLUG VALLEY (Image 1 & 2)
  // ==========================================
  buildCylinderHead() {
    this.cylinderHeadGroup = new THREE.Group();
    this.cylinderHeadGroup.name = 'CylinderHead_Assembly';

    const headH = 1.0;
    const headMat = this.materials.block;

    // Left and Right Head Castings leaving deep central V-groove valley (Image 1 & 2!)
    const leftHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, headH, 1.3),
      headMat
    );
    leftHead.position.set(-0.52, 2.92, 0);
    this.cylinderHeadGroup.add(leftHead);

    const rightHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, headH, 1.3),
      headMat
    );
    rightHead.position.set(0.52, 2.92, 0);
    this.cylinderHeadGroup.add(rightHead);

    // V-Valley Angled Floor
    const vValleyFloor = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.25, 1.2),
      headMat
    );
    vValleyFloor.position.set(0, 2.55, 0);
    this.cylinderHeadGroup.add(vValleyFloor);

    // Canted Valve Guide Boss Towers
    const intakeTower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.65, 24),
      headMat
    );
    intakeTower.rotation.z = 0.38;
    intakeTower.position.set(-0.24, 2.95, 0);
    this.cylinderHeadGroup.add(intakeTower);

    const exhaustTower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.65, 24),
      headMat
    );
    exhaustTower.rotation.z = -0.38;
    exhaustTower.position.set(0.24, 2.95, 0);
    this.cylinderHeadGroup.add(exhaustTower);

    // Intake Port Runner (Left)
    const intakeRunner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.58, 24),
      headMat
    );
    intakeRunner.rotation.z = Math.PI / 3;
    intakeRunner.position.set(-0.55, 2.85, 0);
    this.cylinderHeadGroup.add(intakeRunner);

    // Exhaust Port Runner (Right)
    const exhaustRunner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.58, 24),
      this.materials.conRod
    );
    exhaustRunner.rotation.z = -Math.PI / 3;
    exhaustRunner.position.set(0.55, 2.85, 0);
    this.cylinderHeadGroup.add(exhaustRunner);

    this.root.add(this.cylinderHeadGroup);

    this.parts.cylinderHead = {
      group: this.cylinderHeadGroup,
      explodeOffset: new THREE.Vector3(0, 1.8, 0),
      name: 'Pent-Roof DOHC Cylinder Head',
      specs: 'Central Spark Plug Valley | Canted Valve Guides | High-Velocity Cross-Flow Ports'
    };
  }

  // ==========================================
  // 6. VALVETRAIN (CANTED VALVES & SPRINGS)
  // ==========================================
  buildValvetrain() {
    const valveAngle = 0.38; // radians (~21.8 degrees, exact match for Image 1 & 2!)

    // A. Intake Valve Assembly
    this.intakeValveGroup = new THREE.Group();
    this.intakeValveGroup.name = 'IntakeValve_Assembly';

    const intakeHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.065, 32),
      this.materials.valveIntake
    );
    intakeHead.rotation.x = Math.PI;
    this.intakeValveGroup.add(intakeHead);

    const intakeStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.05, 16),
      this.materials.valveIntake
    );
    intakeStem.position.y = 0.52;
    this.intakeValveGroup.add(intakeStem);

    this.intakeSpringMesh = this.createValveSpring(this.materials.spring);
    this.intakeSpringMesh.position.y = 0.42;
    this.intakeValveGroup.add(this.intakeSpringMesh);

    const intakeRetainer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.08, 0.05, 24),
      this.materials.retainer
    );
    intakeRetainer.position.y = 0.95;
    this.intakeValveGroup.add(intakeRetainer);

    // Inverted Bucket Tappet (Cam follower directly depressed by intake cam lobe)
    const intakeBucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.16, 24),
      this.materials.wristPin
    );
    intakeBucket.position.y = 1.0;
    this.intakeValveGroup.add(intakeBucket);

    this.intakeValveBasePos = new THREE.Vector3(-0.21, 2.42, 0);
    this.intakeValveGroup.position.copy(this.intakeValveBasePos);
    this.intakeValveGroup.rotation.z = valveAngle;
    this.root.add(this.intakeValveGroup);

    // B. Exhaust Valve Assembly
    this.exhaustValveGroup = new THREE.Group();
    this.exhaustValveGroup.name = 'ExhaustValve_Assembly';

    const exhaustHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.19, 0.065, 32),
      this.materials.valveExhaust
    );
    exhaustHead.rotation.x = Math.PI;
    this.exhaustValveGroup.add(exhaustHead);

    const exhaustStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.05, 16),
      this.materials.valveExhaust
    );
    exhaustStem.position.y = 0.52;
    this.exhaustValveGroup.add(exhaustStem);

    this.exhaustSpringMesh = this.createValveSpring(this.materials.spring);
    this.exhaustSpringMesh.position.y = 0.42;
    this.exhaustValveGroup.add(this.exhaustSpringMesh);

    const exhaustRetainer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.08, 0.05, 24),
      this.materials.retainer
    );
    exhaustRetainer.position.y = 0.95;
    this.exhaustValveGroup.add(exhaustRetainer);

    // Inverted Bucket Tappet (Cam follower directly depressed by exhaust cam lobe)
    const exhaustBucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.16, 24),
      this.materials.wristPin
    );
    exhaustBucket.position.y = 1.0;
    this.exhaustValveGroup.add(exhaustBucket);

    this.exhaustValveBasePos = new THREE.Vector3(0.21, 2.42, 0);
    this.exhaustValveGroup.position.copy(this.exhaustValveBasePos);
    this.exhaustValveGroup.rotation.z = -valveAngle;
    this.root.add(this.exhaustValveGroup);

    // C. Dual Overhead Camshafts (DOHC) Assembly (Exact match for Image 3!)
    this.camshaftGroup = new THREE.Group();
    this.camshaftGroup.name = 'DOHC_Valvetrain_Assembly';

    // 1. Intake Camshaft (Left side directly over intake valve bucket)
    this.intakeCamshaftGroup = new THREE.Group();
    this.intakeCamshaftGroup.name = 'Intake_Camshaft';
    this.intakeCamshaftGroup.position.set(-0.58, 3.48, 0);

    const intakeShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 1.25, 24),
      this.materials.crankshaft
    );
    intakeShaft.rotation.x = Math.PI / 2;
    this.intakeCamshaftGroup.add(intakeShaft);

    // Egg-shaped Intake Cam Lobe
    const lobeShapeIn = new THREE.Shape();
    lobeShapeIn.absarc(0, 0, 0.075, 0, Math.PI, false);
    lobeShapeIn.lineTo(0.055, -0.16);
    lobeShapeIn.quadraticCurveTo(0, -0.22, -0.055, -0.16);
    lobeShapeIn.closePath();

    const lobeGeomIn = new THREE.ExtrudeGeometry(lobeShapeIn, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015 });
    const intakeLobe = new THREE.Mesh(lobeGeomIn, this.materials.crankshaft);
    intakeLobe.position.z = -0.06;
    this.intakeCamshaftGroup.add(intakeLobe);

    // Front Timing Sprocket
    const intakeSprocket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.045, 32),
      this.materials.crankshaft
    );
    intakeSprocket.rotation.x = Math.PI / 2;
    intakeSprocket.position.z = 0.58;
    this.intakeCamshaftGroup.add(intakeSprocket);

    this.camshaftGroup.add(this.intakeCamshaftGroup);

    // 2. Exhaust Camshaft (Right side directly over exhaust valve bucket)
    this.exhaustCamshaftGroup = new THREE.Group();
    this.exhaustCamshaftGroup.name = 'Exhaust_Camshaft';
    this.exhaustCamshaftGroup.position.set(0.58, 3.48, 0);

    const exhaustShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 1.25, 24),
      this.materials.crankshaft
    );
    exhaustShaft.rotation.x = Math.PI / 2;
    this.exhaustCamshaftGroup.add(exhaustShaft);

    // Egg-shaped Exhaust Cam Lobe
    const lobeShapeEx = new THREE.Shape();
    lobeShapeEx.absarc(0, 0, 0.075, 0, Math.PI, false);
    lobeShapeEx.lineTo(0.055, -0.16);
    lobeShapeEx.quadraticCurveTo(0, -0.22, -0.055, -0.16);
    lobeShapeEx.closePath();

    const lobeGeomEx = new THREE.ExtrudeGeometry(lobeShapeEx, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015 });
    const exhaustLobe = new THREE.Mesh(lobeGeomEx, this.materials.crankshaft);
    exhaustLobe.position.z = -0.06;
    this.exhaustCamshaftGroup.add(exhaustLobe);

    // Front Timing Sprocket
    const exhaustSprocket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.045, 32),
      this.materials.crankshaft
    );
    exhaustSprocket.rotation.x = Math.PI / 2;
    exhaustSprocket.position.z = 0.58;
    this.exhaustCamshaftGroup.add(exhaustSprocket);

    this.camshaftGroup.add(this.exhaustCamshaftGroup);

    // Front Camshaft Timing Link
    const timingLink = new THREE.Mesh(
      new THREE.BoxGeometry(1.16, 0.035, 0.04),
      this.materials.bolts
    );
    timingLink.position.set(0, 3.70, 0.58);
    this.camshaftGroup.add(timingLink);

    this.root.add(this.camshaftGroup);

    this.parts.intakeValve = {
      group: this.intakeValveGroup,
      explodeOffset: new THREE.Vector3(-0.65, 1.2, 0),
      name: 'Canted Stainless Intake Valve & Bucket Tappet',
      specs: 'Head: 36.0 mm | Canted Angle: 22° | Inverted Hydraulic Bucket'
    };

    this.parts.exhaustValve = {
      group: this.exhaustValveGroup,
      explodeOffset: new THREE.Vector3(0.65, 1.2, 0),
      name: 'Canted Inconel Exhaust Valve & Bucket Tappet',
      specs: 'Head: 31.0 mm | Canted Angle: 22° | Inconel 751 Superalloy'
    };

    this.parts.camshaft = {
      group: this.camshaftGroup,
      explodeOffset: new THREE.Vector3(0, 1.5, -0.8),
      name: 'Dual Overhead Camshafts (DOHC)',
      specs: 'Dual Billet Shafts | Inverted Bucket Direct Drive | 10.5mm Peak Lift'
    };
  }

  createValveSpring(mat) {
    const springGroup = new THREE.Group();
    const coils = 6.5;
    const rSpring = 0.082;
    const hSpring = 0.44;
    const wireR = 0.015;

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
  // 7. BLUEPRINT VERTICAL SPARK PLUG (Centrally Placed in V-Valley)
  // ==========================================
  buildSparkPlug() {
    this.sparkPlugGroup = new THREE.Group();
    this.sparkPlugGroup.name = 'SparkPlug_Assembly';

    // Ribbed Alumina Ceramic Insulator (in central V-valley)
    const ceramicGeom = new THREE.CylinderGeometry(0.065, 0.075, 0.54, 24);
    const ceramic = new THREE.Mesh(ceramicGeom, this.materials.sparkCeramic);
    ceramic.position.y = 0.48;
    this.sparkPlugGroup.add(ceramic);

    for (let y = 0.35; y <= 0.62; y += 0.07) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.01, 8, 24),
        this.materials.sparkCeramic
      );
      rib.rotation.x = Math.PI / 2;
      rib.position.y = y;
      this.sparkPlugGroup.add(rib);
    }

    // Hex Nut & Threaded Barrel
    const hexNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 0.12, 6),
      this.materials.sparkMetal
    );
    hexNut.position.y = 0.18;
    this.sparkPlugGroup.add(hexNut);

    const threadedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.082, 0.22, 24),
      this.materials.sparkMetal
    );
    threadedBase.position.y = 0.02;
    this.sparkPlugGroup.add(threadedBase);

    // Electrodes
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

    // Glowing Arc
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

    this.sparkLight = new THREE.PointLight(0x80d8ff, 0, 1.8, 2.0);
    this.sparkLight.position.set(0, -0.14, 0);
    this.sparkPlugGroup.add(this.sparkLight);

    this.sparkPlugBasePos = new THREE.Vector3(0, 2.45, 0);
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

    // 4. Canted Valve Lifts
    const vAngle = 0.38;
    const intakeExplode = this.parts.intakeValve.currentExplodeOffset || new THREE.Vector3();
    const intakeLiftOffset = kinematicsState.intakeValveLift * 0.14;
    this.intakeValveGroup.position.set(
      this.intakeValveBasePos.x + intakeExplode.x - Math.sin(vAngle) * intakeLiftOffset,
      this.intakeValveBasePos.y + intakeExplode.y - Math.cos(vAngle) * intakeLiftOffset,
      this.intakeValveBasePos.z + intakeExplode.z
    );
    const intakeSpringScale = 1 - kinematicsState.intakeValveLift * 0.3;
    this.intakeSpringMesh.scale.set(1, Math.max(0.65, intakeSpringScale), 1);

    const exhaustExplode = this.parts.exhaustValve.currentExplodeOffset || new THREE.Vector3();
    const exhaustLiftOffset = kinematicsState.exhaustValveLift * 0.14;
    this.exhaustValveGroup.position.set(
      this.exhaustValveBasePos.x + exhaustExplode.x + Math.sin(vAngle) * exhaustLiftOffset,
      this.exhaustValveBasePos.y + exhaustExplode.y - Math.cos(vAngle) * exhaustLiftOffset,
      this.exhaustValveBasePos.z + exhaustExplode.z
    );
    const exhaustSpringScale = 1 - kinematicsState.exhaustValveLift * 0.3;
    this.exhaustSpringMesh.scale.set(1, Math.max(0.65, exhaustSpringScale), 1);

    // 5. DOHC Camshafts (1/2 crank speed, phased to valve lift events)
    if (this.intakeCamshaftGroup) {
      this.intakeCamshaftGroup.rotation.z = -theta * 0.5 + Math.PI * 0.25;
    }
    if (this.exhaustCamshaftGroup) {
      this.exhaustCamshaftGroup.rotation.z = -theta * 0.5 + Math.PI * 1.25;
    }

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

    // 7. Dynamic Combustion Gas Dynamics
    const headRoofY = 2.42;
    const crownTopY = pistonPos.y - this.kinematics.wristPinHeight + 0.62;
    const gasHeight = Math.max(0.10, headRoofY - crownTopY);
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
