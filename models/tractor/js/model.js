/**
 * MTZ-80 Belarus-class Tractor — Blueprint-Accurate Photorealistic Model
 * Reconstructed from factory orthographic blueprint:
 *   Length 3930 | Wheelbase 2450 | Height 2470 | Width 1970
 *   Front track 1200-1800 | Rear track 1400-2100
 * Axes: X = width, Y = up, Z = length (front = -Z, rear = +Z). Meters.
 */

import * as THREE from 'three';

export class TractorModel {
  constructor(kinematics) {
    this.kinematics = kinematics;
    this.root = new THREE.Group();
    this.root.name = 'TractorAssembly';
    this.parts = {};
    this.materials = {};
    this.explodeFactor = 0;
    this.bodyMode = 'solid';

    this.createTextures();
    this.createMaterials();
    this.buildAll();
    this.registerExplodeOffsets();

    this.root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  /* ================= TEXTURES ================= */
  createTextures() {
    // Cast grain
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 118 + Math.random() * 26;
      img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v; img.data[i+3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.castTex = new THREE.CanvasTexture(c);
    this.castTex.wrapS = this.castTex.wrapT = THREE.RepeatWrapping;
    this.castTex.repeat.set(3, 3);

    // Grille mesh
    const cg = document.createElement('canvas');
    cg.width = 128; cg.height = 128;
    const gg = cg.getContext('2d');
    gg.fillStyle = '#1a1a1c'; gg.fillRect(0, 0, 128, 128);
    gg.fillStyle = '#3a3a3e';
    for (let y = 4; y < 128; y += 12)
      for (let x = 4; x < 128; x += 12) gg.fillRect(x, y, 6, 6);
    this.grilleTex = new THREE.CanvasTexture(cg);
    this.grilleTex.wrapS = this.grilleTex.wrapT = THREE.RepeatWrapping;
    this.grilleTex.repeat.set(3, 3);

    // Tire sidewall ring texture (subtle)
    const ct = document.createElement('canvas');
    ct.width = 256; ct.height = 64;
    const gt = ct.getContext('2d');
    gt.fillStyle = '#17181a'; gt.fillRect(0, 0, 256, 64);
    gt.fillStyle = '#232527';
    gt.font = 'bold 20px sans-serif';
    gt.fillText('15.5-38  •  8 PR  •  BELARUS', 12, 40);
    this.sidewallTex = new THREE.CanvasTexture(ct);
    this.sidewallTex.wrapS = THREE.RepeatWrapping;

    // Hood side decal: MTZ-80 + BELARUS stripe (transparent background)
    const cd = document.createElement('canvas');
    cd.width = 512; cd.height = 128;
    const gd = cd.getContext('2d');
    gd.clearRect(0, 0, 512, 128);
    gd.fillStyle = '#f2ede0';
    gd.font = '800 62px Arial, sans-serif';
    gd.fillText('MTZ-80', 18, 66);
    gd.font = '600 25px Arial, sans-serif';
    gd.fillStyle = '#cfe0f2';
    gd.fillText('B E L A R U S', 20, 100);
    gd.fillStyle = '#e8e2d4';
    gd.fillRect(330, 40, 164, 12);
    gd.fillStyle = '#c8102e';
    gd.fillRect(330, 58, 164, 8);
    this.decalTex = new THREE.CanvasTexture(cd);
    this.decalTex.anisotropy = 4;

    // Number plate face
    const cp = document.createElement('canvas');
    cp.width = 256; cp.height = 64;
    const gp = cp.getContext('2d');
    gp.fillStyle = '#f4f4f5'; gp.fillRect(0, 0, 256, 64);
    gp.strokeStyle = '#1e40af'; gp.lineWidth = 6; gp.strokeRect(3, 3, 250, 58);
    gp.fillStyle = '#111111';
    gp.font = '800 34px Arial, sans-serif';
    gp.fillText('80 MTZ', 62, 45);
    this.plateTex = new THREE.CanvasTexture(cp);
    this.plateTex.anisotropy = 4;
  }

  /* ================= MATERIALS ================= */
  createMaterials() {
    const DS = THREE.DoubleSide;
    // MTZ Belarus blue + cream
    this.materials.bodyBlue = new THREE.MeshStandardMaterial({
      color: 0x1e5aa8, metalness: 0.35, roughness: 0.38,
      bumpMap: this.castTex, bumpScale: 0.0012, name: 'Belarus Blue Enamel', side: DS,
      envMapIntensity: 0.65
    });
    this.materials.cream = new THREE.MeshStandardMaterial({
      color: 0xe8e2d4, metalness: 0.15, roughness: 0.5, name: 'Cream Roof', side: DS,
      envMapIntensity: 0.6
    });
    this.materials.chassis = new THREE.MeshStandardMaterial({
      color: 0x23262b, metalness: 0.7, roughness: 0.55,
      bumpMap: this.castTex, bumpScale: 0.002, name: 'Chassis Black', side: DS
    });
    this.materials.castIron = new THREE.MeshStandardMaterial({
      color: 0x4a4f57, metalness: 0.8, roughness: 0.5,
      bumpMap: this.castTex, bumpScale: 0.002, name: 'Cast Iron Housing'
    });
    this.materials.steel = new THREE.MeshStandardMaterial({
      color: 0x9aa2ad, metalness: 0.92, roughness: 0.28, name: 'Machined Steel'
    });
    this.materials.chrome = new THREE.MeshStandardMaterial({
      color: 0xf2f5f8, metalness: 1.0, roughness: 0.08, name: 'Chrome'
    });
    this.materials.rimPaint = new THREE.MeshStandardMaterial({
      color: 0xd9b93c, metalness: 0.45, roughness: 0.42, name: 'Rim Yellow', side: DS
    });
    this.materials.rimFront = new THREE.MeshStandardMaterial({
      color: 0xc9cdd3, metalness: 0.55, roughness: 0.4, name: 'Front Rim Silver', side: DS
    });
    this.materials.tire = new THREE.MeshStandardMaterial({
      color: 0x1b1c1e, metalness: 0.05, roughness: 0.94, name: 'Tire Rubber'
    });
    this.materials.tireSide = new THREE.MeshStandardMaterial({
      color: 0x1e1f22, metalness: 0.05, roughness: 0.9, map: this.sidewallTex, name: 'Sidewall'
    });
    this.materials.glass = new THREE.MeshPhysicalMaterial({
      color: 0xbfe3f2, metalness: 0.0, roughness: 0.06, transparent: true, opacity: 0.22,
      clearcoat: 1.0, side: DS, name: 'Cab Glazing'
    });
    this.materials.grille = new THREE.MeshStandardMaterial({
      color: 0x2a2d31, metalness: 0.6, roughness: 0.5, map: this.grilleTex, name: 'Grille Mesh'
    });
    this.materials.headLens = new THREE.MeshStandardMaterial({
      color: 0xfff6d8, emissive: 0xffedb8, emissiveIntensity: 0.9,
      metalness: 0.2, roughness: 0.15, name: 'Headlamp Lens'
    });
    this.materials.tailRed = new THREE.MeshStandardMaterial({
      color: 0xb01a1a, emissive: 0x7a0d0d, emissiveIntensity: 0.7, roughness: 0.3, name: 'Tail Lamp'
    });
    this.materials.beacon = new THREE.MeshStandardMaterial({
      color: 0xff8c00, emissive: 0xff6a00, emissiveIntensity: 1.4,
      transparent: true, opacity: 0.9, roughness: 0.2, name: 'Beacon'
    });
    this.materials.seat = new THREE.MeshStandardMaterial({
      color: 0x1b1815, metalness: 0.05, roughness: 0.9, name: 'Vinyl Seat'
    });
    this.materials.dashPlastic = new THREE.MeshStandardMaterial({
      color: 0x1c1e22, metalness: 0.2, roughness: 0.7, name: 'Dashboard'
    });
    this.materials.gaugeFace = new THREE.MeshStandardMaterial({
      color: 0xf4f4f5, emissive: 0x99ccff, emissiveIntensity: 0.25, roughness: 0.4, name: 'Gauges'
    });
    this.materials.exhaust = new THREE.MeshStandardMaterial({
      color: 0x555b63, metalness: 0.85, roughness: 0.45, name: 'Exhaust Steel'
    });
    this.materials.exhaustDark = new THREE.MeshStandardMaterial({
      color: 0x2b2d30, metalness: 0.7, roughness: 0.6, name: 'Muffler'
    });
    this.materials.hose = new THREE.MeshStandardMaterial({
      color: 0x101112, metalness: 0.1, roughness: 0.9, name: 'Rubber Hose'
    });
    this.materials.copper = new THREE.MeshStandardMaterial({
      color: 0xb0703a, metalness: 0.9, roughness: 0.3, name: 'Copper/Brass'
    });
    this.materials.smoke = new THREE.MeshBasicMaterial({
      color: 0x9aa0a8, transparent: true, opacity: 0.0, depthWrite: false, name: 'Exhaust Smoke'
    });
    this.materials.plate = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5, metalness: 0.1, roughness: 0.5, name: 'Number Plate'
    });
    this.materials.plateFace = new THREE.MeshStandardMaterial({
      map: this.plateTex, metalness: 0.1, roughness: 0.5, name: 'Plate Face'
    });
    this.materials.decal = new THREE.MeshStandardMaterial({
      map: this.decalTex, transparent: true, metalness: 0.15, roughness: 0.4,
      polygonOffset: true, polygonOffsetFactor: -2, name: 'Hood Decal'
    });
    this.materials.safetyYellow = new THREE.MeshStandardMaterial({
      color: 0xe3b008, metalness: 0.3, roughness: 0.5, name: 'PTO Guard Yellow', side: DS
    });
    this.materials.weight = new THREE.MeshStandardMaterial({
      color: 0x3a3d42, metalness: 0.75, roughness: 0.5,
      bumpMap: this.castTex, bumpScale: 0.002, name: 'Ballast Weight'
    });
  }

  box(w, h, d, mat) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }
  cyl(rt, rb, h, mat, seg = 24) {
    return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  }

  /* ================= BUILD ALL ================= */
  buildAll() {
    this.buildChassis();
    this.buildEngineBay();
    this.buildHoodAndGrille();
    this.buildExhaustIntake();
    this.buildFuelTank();
    this.buildTransmission();
    this.buildFrontAxle();
    this.buildCab();
    this.buildFenders();
    this.buildWheels();
    this.buildHitchPTO();
    this.buildBallastSteps();
  }

  /* ---- 1. Chassis frame ---- */
  buildChassis() {
    const g = new THREE.Group(); g.name = 'Chassis';
    const M = this.materials;
    [-0.28, 0.28].forEach((x) => {
      const rail = this.box(0.09, 0.16, 2.70, M.chassis);
      rail.position.set(x, 0.78, -0.20);
      g.add(rail);
    });
    // Cross members
    [-1.2, -0.4, 0.35].forEach((z) => {
      const cm = this.box(0.65, 0.09, 0.10, M.chassis);
      cm.position.set(0, 0.78, z);
      g.add(cm);
    });
    // Front support casting (radiator cradle)
    const cradle = this.box(0.55, 0.22, 0.30, M.castIron);
    cradle.position.set(0, 0.72, -1.55);
    g.add(cradle);
    this.root.add(g);
    this.parts.chassis = { group: g, name: 'Frame Chassis & Rails', specs: 'Riveted channel rails | Wheelbase: 2450 mm | Front support casting' };
  }

  /* ---- 2. Engine bay: block, head, radiator, fan ---- */
  buildEngineBay() {
    const g = new THREE.Group(); g.name = 'EngineBay';
    const M = this.materials;
    // D-240 4-cyl diesel block
    const block = this.box(0.52, 0.52, 0.92, M.castIron);
    block.position.set(0, 1.02, -0.92);
    g.add(block);
    // Oil sump
    const sump = this.box(0.40, 0.16, 0.70, M.exhaustDark);
    sump.position.set(0, 0.70, -0.92);
    g.add(sump);
    // Cylinder head + valve cover (blue)
    const head = this.box(0.46, 0.14, 0.88, M.castIron);
    head.position.set(0, 1.35, -0.92);
    g.add(head);
    const cover = this.box(0.34, 0.08, 0.80, M.bodyBlue);
    cover.position.set(0, 1.46, -0.92);
    g.add(cover);
    // Oil filler + breather
    const filler = this.cyl(0.035, 0.035, 0.07, M.chassis);
    filler.position.set(0.12, 1.53, -0.75);
    g.add(filler);
    // Intake / exhaust manifolds
    const maniEx = this.cyl(0.05, 0.05, 0.80, M.exhaustDark);
    maniEx.rotation.x = Math.PI / 2;
    maniEx.position.set(0.28, 1.28, -0.92);
    g.add(maniEx);
    for (let i = 0; i < 4; i++) {
      const port = this.cyl(0.035, 0.035, 0.12, M.exhaustDark, 12);
      port.rotation.z = Math.PI / 2;
      port.position.set(0.22, 1.28, -1.22 + i * 0.20);
      g.add(port);
    }
    // Radiator block + shroud
    const rad = this.box(0.60, 0.58, 0.12, M.chassis);
    rad.position.set(0, 1.06, -1.58);
    g.add(rad);
    const radCore = this.box(0.54, 0.50, 0.03, M.grille);
    radCore.position.set(0, 1.06, -1.65);
    g.add(radCore);
    const radCap = this.cyl(0.03, 0.03, 0.05, M.chrome, 12);
    radCap.position.set(0.18, 1.38, -1.58);
    g.add(radCap);
    // Top + bottom hoses
    const hoseT = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.032, 10, 20, Math.PI / 2), M.hose);
    hoseT.position.set(-0.10, 1.30, -1.45); hoseT.rotation.y = Math.PI / 2;
    g.add(hoseT);
    // Cooling fan (spins around Z)
    this.fanGroup = new THREE.Group();
    this.fanGroup.position.set(0, 1.06, -1.48);
    for (let i = 0; i < 6; i++) {
      const blade = this.box(0.02, 0.20, 0.10, M.steel);
      const holder = new THREE.Group();
      blade.position.y = 0.16;
      blade.rotation.x = 0.5;
      holder.rotation.z = (i / 6) * Math.PI * 2;
      holder.add(blade);
      this.fanGroup.add(holder);
    }
    const fanHub = this.cyl(0.05, 0.05, 0.08, M.chassis, 16);
    fanHub.rotation.x = Math.PI / 2;
    this.fanGroup.add(fanHub);
    g.add(this.fanGroup);
    // Belt pulley + alternator + starter details
    const alt = this.cyl(0.06, 0.06, 0.14, M.steel, 16);
    alt.rotation.z = Math.PI / 2;
    alt.position.set(-0.30, 1.05, -0.80);
    g.add(alt);
    const starter = this.cyl(0.055, 0.055, 0.22, M.chassis, 14);
    starter.rotation.x = Math.PI / 2;
    starter.position.set(0.24, 0.82, -0.55);
    g.add(starter);
    // Fuel injection pump + fuel filter (right side)
    const injPump = this.box(0.12, 0.16, 0.30, M.steel);
    injPump.position.set(0.30, 1.02, -0.85);
    g.add(injPump);
    for (let i = 0; i < 4; i++) {
      const line = this.cyl(0.008, 0.008, 0.22, M.copper, 6);
      line.position.set(0.30, 1.20, -1.12 + i * 0.18);
      g.add(line);
    }
    const fuelFilt = this.cyl(0.05, 0.05, 0.16, M.cream, 14);
    fuelFilt.position.set(0.30, 1.22, -0.60);
    g.add(fuelFilt);
    const filtBase = this.cyl(0.055, 0.055, 0.03, M.chassis, 14);
    filtBase.position.set(0.30, 1.32, -0.60);
    g.add(filtBase);
    // Crank pulley + fan belt runs (front of engine)
    const crankPul = this.cyl(0.07, 0.07, 0.05, M.chassis, 16);
    crankPul.rotation.x = Math.PI / 2;
    crankPul.position.set(0, 0.80, -1.46);
    g.add(crankPul);
    [-0.055, 0.055].forEach((x) => {
      const belt = this.box(0.022, 0.32, 0.012, M.hose);
      belt.position.set(x, 0.94, -1.465);
      belt.rotation.x = 0.06;
      g.add(belt);
    });

    this.root.add(g);
    this.parts.engine = { group: g, name: 'D-240 Diesel Engine 4-Cyl', specs: '4.75 L NA diesel | 80 hp @ 2200 rpm | 280 Nm | Water-cooled + 6-blade fan' };
  }

  /* ---- 3. Hood + grille + headlights ---- */
  buildHoodAndGrille() {
    const g = new THREE.Group(); g.name = 'Hood';
    const M = this.materials;
    // Main hood top (slight nose-down slope toward front)
    const top = this.box(0.70, 0.05, 1.50, M.bodyBlue);
    top.position.set(0, 1.52, -0.99);
    top.rotation.x = 0.022;
    g.add(top);
    // Center spine ridge
    const spine = this.box(0.10, 0.035, 1.48, M.bodyBlue);
    spine.position.set(0, 1.555, -0.99);
    g.add(spine);
    // Side panels with louver vents (left/right)
    [-1, 1].forEach((s) => {
      const panel = this.box(0.03, 0.42, 1.44, M.bodyBlue);
      panel.position.set(s * 0.355, 1.28, -0.99);
      g.add(panel);
      // 5 louver slits
      for (let i = 0; i < 5; i++) {
        const lou = this.box(0.012, 0.025, 0.55, M.chassis);
        lou.position.set(s * 0.372, 1.36 - i * 0.07, -0.95);
        g.add(lou);
      }
      // Side emblem strip
      const strip = this.box(0.012, 0.05, 0.60, M.cream);
      strip.position.set(s * 0.372, 1.44, -0.80);
      g.add(strip);
    });
    // Nose side cheeks taper to grille
    const noseT = this.box(0.66, 0.30, 0.10, M.bodyBlue);
    noseT.position.set(0, 1.36, -1.70);
    g.add(noseT);
    // Hood side decals (both flanks)
    [-1, 1].forEach((s) => {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.21), M.decal);
      decal.position.set(s * 0.3725, 1.27, -0.95);
      decal.rotation.y = s * Math.PI / 2;
      g.add(decal);
    });

    // Grille group (separate part for explode clarity but parented here visually)
    this.grilleGroup = new THREE.Group();
    const gg = this.grilleGroup;
    const frame = this.box(0.62, 0.62, 0.06, M.bodyBlue);
    frame.position.set(0, 1.06, -1.74);
    gg.add(frame);
    const mesh = this.box(0.52, 0.50, 0.03, M.grille);
    mesh.position.set(0, 1.04, -1.775);
    gg.add(mesh);
    // Vertical divider bars
    for (let i = -2; i <= 2; i++) {
      const bar = this.box(0.02, 0.50, 0.02, M.steel);
      bar.position.set(i * 0.10, 1.04, -1.79);
      gg.add(bar);
    }
    // Badge
    const badge = this.box(0.16, 0.05, 0.015, M.chrome);
    badge.position.set(0, 1.28, -1.79);
    gg.add(badge);
    // Round headlights in grille sides
    [-1, 1].forEach((s) => {
      const bucket = this.cyl(0.085, 0.09, 0.09, M.chassis, 20);
      bucket.rotation.x = Math.PI / 2;
      bucket.position.set(s * 0.24, 1.18, -1.76);
      gg.add(bucket);
      const lens = this.cyl(0.072, 0.072, 0.02, M.headLens, 20);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(s * 0.24, 1.18, -1.81);
      gg.add(lens);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.012, 8, 24), M.chrome);
      ring.position.set(s * 0.24, 1.18, -1.81);
      gg.add(ring);
    });
    g.add(gg);
    this.hoodGroup = g;
    this.root.add(g);
    this.parts.hood = { group: g, name: 'Bonnet, Grille & Headlamps', specs: 'Pressed-steel bonnet | Mesh grille | 2x sealed-beam headlamps' };
  }

  /* ---- 4. Exhaust stack + air cleaner ---- */
  buildExhaustIntake() {
    const g = new THREE.Group(); g.name = 'Exhaust';
    const M = this.materials;
    // Muffler body (right of hood)
    const muff = this.cyl(0.095, 0.095, 0.42, M.exhaustDark, 20);
    muff.position.set(0.24, 1.72, -1.10);
    g.add(muff);
    const band1 = new THREE.Mesh(new THREE.TorusGeometry(0.096, 0.012, 8, 20), M.steel);
    band1.rotation.x = Math.PI / 2; band1.position.set(0.24, 1.60, -1.10);
    g.add(band1);
    const band2 = band1.clone(); band2.position.y = 1.84; g.add(band2);
    // Downpipe from manifold into muffler
    const down = this.cyl(0.038, 0.038, 0.42, M.exhaust, 14);
    down.position.set(0.26, 1.42, -1.02);
    down.rotation.x = 0.25;
    g.add(down);
    // Tailpipe + curved tip + rain cap
    const tail = this.cyl(0.034, 0.034, 0.42, M.exhaust, 14);
    tail.position.set(0.24, 2.12, -1.10);
    g.add(tail);
    const tip = this.cyl(0.037, 0.034, 0.07, M.chassis, 14);
    tip.position.set(0.24, 2.35, -1.10);
    g.add(tip);
    this.exhaustTip = new THREE.Object3D();
    this.exhaustTip.position.set(0.24, 2.40, -1.10);
    g.add(this.exhaustTip);
    // Smoke puff
    this.smoke = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), M.smoke.clone());
    this.smoke.position.copy(this.exhaustTip.position);
    g.add(this.smoke);
    // Clamp bracket to hood
    const brk = this.box(0.06, 0.03, 0.10, M.chassis);
    brk.position.set(0.24, 1.52, -1.10);
    g.add(brk);

    // Air cleaner (left of hood, oil-bath type with cap + hose)
    const ac = this.cyl(0.085, 0.085, 0.26, M.bodyBlue, 18);
    ac.position.set(-0.27, 1.66, -1.15);
    g.add(ac);
    const acCap = this.cyl(0.10, 0.10, 0.05, M.chassis, 18);
    acCap.position.set(-0.27, 1.82, -1.15);
    g.add(acCap);
    const acPipe = this.cyl(0.035, 0.035, 0.30, M.hose, 12);
    acPipe.position.set(-0.20, 1.55, -1.00);
    acPipe.rotation.z = 1.1;
    g.add(acPipe);

    this.root.add(g);
    this.parts.exhaust = { group: g, name: 'Exhaust Stack & Air Cleaner', specs: 'Vertical muffler + rain cap | Oil-bath air cleaner | Heat-shielded downpipe' };
  }

  /* ---- 5. Fuel tank + cowl ---- */
  buildFuelTank() {
    const g = new THREE.Group(); g.name = 'FuelTank';
    const M = this.materials;
    const tank = this.box(0.62, 0.30, 0.44, M.bodyBlue);
    tank.position.set(0, 1.42, -0.12);
    g.add(tank);
    // Rounded top
    const topR = this.cyl(0.31, 0.31, 0.44, M.bodyBlue, 20, );
    topR.rotation.x = Math.PI / 2;
    topR.scale.set(1, 1, 0.28);
    topR.position.set(0, 1.57, -0.12);
    g.add(topR);
    const cap = this.cyl(0.045, 0.045, 0.05, M.chassis, 14);
    cap.position.set(0.15, 1.66, -0.12);
    g.add(cap);
    const gauge = this.cyl(0.025, 0.025, 0.02, M.gaugeFace, 12);
    gauge.position.set(-0.12, 1.60, -0.12);
    g.add(gauge);
    // Fuel lines
    const line = this.cyl(0.012, 0.012, 0.40, M.copper, 8);
    line.position.set(0.10, 1.22, -0.30);
    line.rotation.x = 0.4;
    g.add(line);
    // Steering cowl below tank
    const cowl = this.box(0.55, 0.35, 0.30, M.bodyBlue);
    cowl.position.set(0, 1.18, -0.18);
    g.add(cowl);
    this.root.add(g);
    this.parts.fuelTank = { group: g, name: 'Fuel Tank & Cowl (100 L)', specs: '100 L steel tank | Filler + gauge | Gravity feed to injection pump' };
  }

  /* ---- 6. Transmission + rear axle ---- */
  buildTransmission() {
    const g = new THREE.Group(); g.name = 'Transmission';
    const M = this.materials;
    // Clutch housing (conical)
    const clutch = this.cyl(0.30, 0.34, 0.45, M.castIron, 20);
    clutch.rotation.x = Math.PI / 2;
    clutch.position.set(0, 0.95, 0.18);
    g.add(clutch);
    // Gearbox main case
    const gb = this.box(0.55, 0.62, 0.85, M.castIron);
    gb.position.set(0, 0.92, 0.72);
    g.add(gb);
    // Gear lever turret
    const turret = this.box(0.20, 0.12, 0.24, M.chassis);
    turret.position.set(0, 1.26, 0.55);
    g.add(turret);
    // Rear axle center housing + trumpets to wheels
    const diff = new THREE.Mesh(new THREE.SphereGeometry(0.30, 20, 16), M.castIron);
    diff.position.set(0, 0.80, 1.10);
    diff.scale.set(1, 1, 0.8);
    g.add(diff);
    [-1, 1].forEach((s) => {
      const trumpet = this.cyl(0.16, 0.19, 0.62, M.castIron, 16);
      trumpet.rotation.z = Math.PI / 2;
      trumpet.position.set(s * 0.50, 0.80, 1.10);
      g.add(trumpet);
      // Brake drum
      const drum = this.cyl(0.20, 0.20, 0.10, M.chassis, 16);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(s * 0.72, 0.80, 1.10);
      g.add(drum);
    });
    // Hydraulic top cover + lift arms pivots
    const hyd = this.box(0.40, 0.14, 0.45, M.bodyBlue);
    hyd.position.set(0, 1.28, 1.02);
    g.add(hyd);
    // Hydraulic remote hoses (routed to rear couplers)
    [-1, 1].forEach((s) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.12, 1.30, 1.05),
        new THREE.Vector3(s * 0.24, 1.12, 1.30),
        new THREE.Vector3(s * 0.20, 0.92, 1.52)
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.018, 8), M.hose));
      const coupler = this.cyl(0.022, 0.022, 0.08, M.copper, 10);
      coupler.rotation.x = Math.PI / 2 - 0.3;
      coupler.position.set(s * 0.20, 0.88, 1.56);
      g.add(coupler);
    });
    this.root.add(g);
    this.parts.transmission = { group: g, name: 'Gearbox & Rear Axle', specs: '9F/2R sliding-mesh | Dry single clutch | Bull-gear final drives' };
  }

  /* ---- 7. Front axle with steering ---- */
  buildFrontAxle() {
    const g = new THREE.Group(); g.name = 'FrontAxle';
    const M = this.materials;
    // Pivoting tubular beam
    this.frontBeam = new THREE.Group();
    this.frontBeam.position.set(0, 0.45, -1.35);
    const beam = this.box(1.30, 0.11, 0.13, M.castIron);
    this.frontBeam.add(beam);
    const pivot = this.cyl(0.07, 0.07, 0.20, M.steel, 14);
    pivot.rotation.x = Math.PI / 2;
    this.frontBeam.add(pivot);
    // Radius rod back to clutch
    const rod = this.box(0.07, 0.07, 1.10, M.chassis);
    rod.position.set(0, 0.52, -0.75);
    g.add(rod);
    // Steering knuckles + tie rod (steer with wheels)
    this.knuckleL = new THREE.Group(); this.knuckleL.position.set(-0.675, 0.45, -1.35);
    this.knuckleR = new THREE.Group(); this.knuckleR.position.set(0.675, 0.45, -1.35);
    [-1, 1].forEach((s) => {
      const kn = this.box(0.10, 0.16, 0.10, M.castIron);
      kn.position.set(s * 0.675, 0.50, -1.35);
      g.add(kn);
    });
    const tie = this.box(1.22, 0.035, 0.035, M.steel);
    tie.position.set(0, 0.38, -1.22);
    g.add(tie);
    this.tieRod = tie;
    g.add(this.frontBeam);
    // Drag link to steering box
    const drag = this.cyl(0.02, 0.02, 0.85, M.steel, 10);
    drag.position.set(-0.30, 0.75, -0.85);
    drag.rotation.x = 1.05;
    g.add(drag);

    this.root.add(g);
    this.parts.frontAxle = { group: g, name: 'Front Axle & Steering', specs: 'Pivoting tubular axle | Track 1200-1800 mm | Ackermann tie-rod, ±35°' };
  }

  /* ---- 8. Cab: full enclosure ---- */
  buildCab() {
    const g = new THREE.Group(); g.name = 'Cab';
    const M = this.materials;
    const floorY = 1.10, roofY = 2.47;
    const zF = -0.25, zR = 1.20, halfW = 0.66;

    // Floor + tunnel
    const floor = this.box(1.32, 0.08, 1.50, M.chassis);
    floor.position.set(0, floorY, 0.475);
    g.add(floor);
    const tunnel = this.box(0.34, 0.22, 1.10, M.dashPlastic);
    tunnel.position.set(0, floorY + 0.14, 0.45);
    g.add(tunnel);

    // Lower door panels (steel, both sides)
    [-1, 1].forEach((s) => {
      const lower = this.box(0.04, 0.55, 1.30, M.bodyBlue);
      lower.position.set(s * halfW, floorY + 0.32, 0.475);
      g.add(lower);
      // Handle + lock
      const h = this.box(0.03, 0.03, 0.16, M.chassis);
      h.position.set(s * (halfW + 0.03), floorY + 0.45, 0.10);
      g.add(h);
    });
    // Rear lower panel
    const rearLow = this.box(1.32, 0.55, 0.05, M.bodyBlue);
    rearLow.position.set(0, floorY + 0.32, zR);
    g.add(rearLow);

    // Corner pillars (A slanted, B/C vertical)
    const pillarMat = M.bodyBlue;
    const mkPillar = (x, y0, y1, z0, z1, w = 0.07) => {
      const h = y1 - y0;
      const p = this.box(w, h, w, pillarMat);
      p.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
      // slant for A pillars
      if (z0 !== z1) { p.rotation.x = Math.atan2(z1 - z0, y1 - y0); }
      g.add(p);
    };
    [-1, 1].forEach((s) => {
      mkPillar(s * 0.62, 1.42, roofY, -0.22, -0.42);   // A (slanted fwd)
      mkPillar(s * halfW, 1.42, roofY, 0.45, 0.45);    // B
      mkPillar(s * halfW, 1.42, roofY, zR, zR);        // C
    });

    // Glazing: windshield (2-pc split), sides, rear
    const glass = M.glass;
    // Windshield halves (slanted plane)
    [-1, 1].forEach((s) => {
      const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.95), glass);
      ws.position.set(s * 0.305, 1.95, -0.335);
      ws.rotation.x = -0.21;
      g.add(ws);
    });
    const wsBar = this.box(0.04, 0.98, 0.04, pillarMat);
    wsBar.position.set(0, 1.95, -0.335); wsBar.rotation.x = -0.21;
    g.add(wsBar);
    // Side glass upper
    [-1, 1].forEach((s) => {
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.72), glass);
      sg.position.set(s * (halfW + 0.005), 2.02, 0.50);
      sg.rotation.y = s * Math.PI / 2;
      g.add(sg);
      // Sliding frame divider
      const div = this.box(0.02, 0.72, 0.04, M.chassis);
      div.position.set(s * (halfW + 0.005), 2.02, 0.50);
      g.add(div);
    });
    // Rear glass
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(1.10, 0.72), glass);
    rw.position.set(0, 2.02, zR + 0.005);
    g.add(rw);

    // Roof with overhang + headliner
    const roof = this.box(1.48, 0.09, 1.75, M.cream);
    roof.position.set(0, roofY + 0.045, 0.42);
    g.add(roof);
    const roofEdge = this.box(1.52, 0.04, 1.79, M.bodyBlue);
    roofEdge.position.set(0, roofY - 0.01, 0.42);
    g.add(roofEdge);
    // Roof vent hatch
    const hatch = this.box(0.50, 0.035, 0.50, M.chassis);
    hatch.position.set(-0.25, roofY + 0.105, 0.42);
    g.add(hatch);
    const hatchGlass = this.box(0.40, 0.02, 0.40, M.glass);
    hatchGlass.position.set(-0.25, roofY + 0.115, 0.42);
    g.add(hatchGlass);
    // Beacon + work lights
    const beaconBase = this.cyl(0.05, 0.06, 0.04, M.chassis, 12);
    beaconBase.position.set(0.45, roofY + 0.11, 0.9);
    g.add(beaconBase);
    this.beaconMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.10, 14), M.beacon);
    this.beaconMesh.position.set(0.45, roofY + 0.18, 0.9);
    g.add(this.beaconMesh);
    [-1, 1].forEach((s) => {
      const wl = this.box(0.14, 0.10, 0.08, M.chassis);
      wl.position.set(s * 0.45, roofY + 0.02, -0.44);
      g.add(wl);
      const lens = this.box(0.12, 0.07, 0.015, M.headLens);
      lens.position.set(s * 0.45, roofY + 0.02, -0.49);
      g.add(lens);
      const wlr = this.box(0.14, 0.10, 0.08, M.chassis);
      wlr.position.set(s * 0.45, roofY + 0.02, 1.28);
      g.add(wlr);
    });

    // Mirrors on arms
    [-1, 1].forEach((s) => {
      const arm = this.cyl(0.018, 0.018, 0.32, M.chassis, 8);
      arm.rotation.z = s * 1.2;
      arm.position.set(s * 0.76, 2.20, -0.30);
      g.add(arm);
      const mir = this.box(0.03, 0.22, 0.14, M.chassis);
      mir.position.set(s * 0.93, 2.22, -0.30);
      g.add(mir);
      const mface = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.20), M.chrome);
      mface.position.set(s * 0.915, 2.22, -0.30);
      mface.rotation.y = -s * Math.PI / 2 + s * 0.3;
      g.add(mface);
    });
    // Wipers on windshield
    [-1, 1].forEach((s) => {
      const wp = this.box(0.015, 0.40, 0.015, M.chassis);
      wp.position.set(s * 0.30, 1.80, -0.375);
      wp.rotation.z = s * 0.35;
      g.add(wp);
    });

    // Interior: seat with suspension + armrests
    const seatBase = this.box(0.48, 0.10, 0.45, M.seat);
    seatBase.position.set(0, 1.42, 0.78);
    g.add(seatBase);
    const seatBack = this.box(0.48, 0.55, 0.12, M.seat);
    seatBack.position.set(0, 1.72, 1.00);
    seatBack.rotation.x = 0.12;
    g.add(seatBack);
    const susp = this.box(0.30, 0.18, 0.30, M.chassis);
    susp.position.set(0, 1.26, 0.78);
    g.add(susp);

    // Steering column + wheel
    const shroud = this.box(0.13, 0.22, 0.17, M.dashPlastic);
    shroud.position.set(0, 1.30, -0.08);
    shroud.rotation.x = -0.35;
    g.add(shroud);
    this.steerColumn = new THREE.Group();
    this.steerColumn.position.set(-0.0, 1.45, -0.05);
    this.steerColumn.rotation.x = -0.55;
    const colTube = this.cyl(0.03, 0.03, 0.55, M.chassis, 12);
    this.steerColumn.add(colTube);
    this.steerWheel = new THREE.Group();
    this.steerWheel.position.y = 0.30;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 10, 28), M.chassis);
    rim.rotation.x = Math.PI / 2;
    this.steerWheel.add(rim);
    for (let i = 0; i < 3; i++) {
      const sp = this.box(0.36, 0.015, 0.02, M.steel);
      sp.rotation.y = (i / 3) * Math.PI * 2;
      this.steerWheel.add(sp);
    }
    const hubC = this.cyl(0.035, 0.035, 0.06, M.steel, 12);
    this.steerWheel.add(hubC);
    this.steerColumn.add(this.steerWheel);
    g.add(this.steerColumn);

    // Dashboard with gauges
    const dash = this.box(0.90, 0.22, 0.28, M.dashPlastic);
    dash.position.set(0, 1.52, -0.22);
    g.add(dash);
    for (let i = -1; i <= 1; i++) {
      const gz = this.cyl(0.045, 0.045, 0.015, M.gaugeFace, 16);
      gz.rotation.x = Math.PI / 2 - 0.5;
      gz.position.set(i * 0.14, 1.58, -0.33);
      g.add(gz);
    }
    // Gear levers with rubber boots seated on a gate plate (no floating knobs)
    const gate = this.box(0.30, 0.03, 0.22, M.chassis);
    gate.position.set(-0.01, 1.365, 0.32);
    g.add(gate);
    [[-0.12, 0.30], [0.10, 0.34]].forEach(([x, z]) => {
      const boot = this.cyl(0.045, 0.028, 0.10, M.hose, 12);
      boot.position.set(x, 1.42, z);
      boot.rotation.x = 0.25;
      g.add(boot);
      const lv = this.cyl(0.016, 0.016, 0.30, M.steel, 10);
      lv.position.set(x, 1.55, z - 0.02);
      lv.rotation.x = 0.25;
      g.add(lv);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 12), M.hose);
      knob.position.set(x, 1.69, z - 0.055);
      knob.scale.y = 1.25;
      g.add(knob);
    });

    this.root.add(g);
    this.parts.cab = { group: g, name: 'Cab, Glass & Controls', specs: 'Enclosed safety cab | Ht 2470 mm | Seat + tilt wheel + gauges' };
  }

  /* ---- 9. Fenders ---- */
  buildFenders() {
    const g = new THREE.Group(); g.name = 'Fenders';
    const M = this.materials;
    [-1, 1].forEach((s) => {
      const f = new THREE.Group();
      // Curved top: partial cylinder shell, axis mapped Y->X so the arc
      // wraps the wheel (top = +Y at theta PI/2, symmetric F-R coverage)
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.99, 0.99, 0.48, 28, 1, true, Math.PI * 0.06, Math.PI * 0.88),
        M.bodyBlue
      );
      shell.rotation.z = Math.PI / 2;
      shell.position.set(s * 0.80, 0.80, 1.10);
      f.add(shell);
      // Rolled edge trim along both arc lips
      [Math.PI * 0.06, Math.PI * 0.94].forEach((a) => {
        const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.48, 8), M.chassis);
        lip.rotation.z = Math.PI / 2;
        lip.position.set(s * 0.80, 0.80 + Math.sin(a) * 0.99, 1.10 + Math.cos(a) * 0.99);
        f.add(lip);
      });
      // Flat extension forward to cab
      const ext = this.box(0.46, 0.04, 0.55, M.bodyBlue);
      ext.position.set(s * 0.80, 1.62, 0.42);
      ext.rotation.x = -0.06;
      f.add(ext);
      // Support strut from extension down to the axle trumpet
      const strut = this.box(0.05, 0.60, 0.05, M.chassis);
      strut.position.set(s * 0.80, 1.30, 0.58);
      strut.rotation.x = 0.12;
      f.add(strut);
      // Tail lamp
      const tl = this.box(0.10, 0.12, 0.06, M.tailRed);
      tl.position.set(s * 0.80, 1.45, 1.62);
      f.add(tl);
      // Mudflap
      const flap = this.box(0.40, 0.30, 0.02, M.hose);
      flap.position.set(s * 0.80, 0.75, 1.78);
      f.add(flap);
      g.add(f);
    });
    this.root.add(g);
    this.parts.fenders = { group: g, name: 'Rear Fenders & Lamps', specs: 'Pressed fenders | Tail lamps | Rubber mudflaps' };
  }

  /* ---- 10. Wheels with realistic treads ---- */
  makeRearWheel(side) {
    const M = this.materials;
    const w = new THREE.Group();
    const R = 0.80, W = 0.40;
    // Carcass
    const carcass = new THREE.Mesh(new THREE.CylinderGeometry(R, R, W, 40, 1), M.tire);
    carcass.rotation.z = Math.PI / 2;
    w.add(carcass);
    // Sidewall rings with lettering texture (offset proud of caps to avoid z-fight)
    [-1, 1].forEach((s) => {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(R * 0.985, R * 0.985, 0.012, 40, 1, true),
        M.tireSide
      );
      ring.rotation.z = Math.PI / 2;
      ring.position.x = s * (W / 2 + 0.004);
      w.add(ring);
    });
    // Chevron lugs: 24 around, alternating ±23°, two halves
    const lugGeom = new THREE.BoxGeometry(W * 0.52, 0.075, 0.13);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      [-1, 1].forEach((h) => {
        const lug = new THREE.Mesh(lugGeom, M.tire);
        const rr = R - 0.01;
        lug.position.set(h * W * 0.24, Math.sin(a) * rr, Math.cos(a) * rr);
        lug.rotation.x = -a;
        lug.rotation.y = h * 0.42; // chevron angle
        w.add(lug);
      });
    }
    // Rim barrel (recessed inside tire)
    const rimBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, W * 0.80, 28), M.rimPaint);
    rimBarrel.rotation.z = Math.PI / 2;
    w.add(rimBarrel);
    // Outer dish — mounted PROUD of the sidewall so the rim reads from outside
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.035, 28), M.rimPaint);
    dish.rotation.z = Math.PI / 2;
    dish.position.x = side * (W / 2 - 0.008);
    w.add(dish);
    // Raised center boss
    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20), M.rimPaint);
    center.rotation.z = Math.PI / 2;
    center.position.x = side * (W / 2 + 0.005);
    w.add(center);
    // Protruding hub with cap
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.52, 16), M.castIron);
    hub.rotation.z = Math.PI / 2;
    w.add(hub);
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), M.steel);
    hubCap.rotation.z = Math.PI / 2;
    hubCap.position.x = side * 0.26;
    w.add(hubCap);
    // 8 lug nuts on a 0.40 bolt circle, standing off the dish face
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.10, 6), M.steel);
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(side * (W / 2 + 0.03), Math.sin(a) * 0.20, Math.cos(a) * 0.20);
      w.add(bolt);
    }
    // Inner dish so the inboard side never looks hollow
    const dishIn = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.035, 28), M.rimPaint);
    dishIn.rotation.z = Math.PI / 2;
    dishIn.position.x = -side * (W / 2 - 0.008);
    w.add(dishIn);
    const valve = this.cyl(0.012, 0.012, 0.06, M.steel, 8);
    valve.position.set(side * (W / 2 + 0.02), 0.30, 0.10);
    w.add(valve);
    w.userData.spin = w; // whole group spins
    return w;
  }

  makeFrontWheel(side) {
    const M = this.materials;
    const w = new THREE.Group();
    const R = 0.45, W = 0.235;
    const carcass = new THREE.Mesh(new THREE.CylinderGeometry(R, R, W, 32), M.tire);
    carcass.rotation.z = Math.PI / 2;
    w.add(carcass);
    // Rounded shoulders so the sidewall doesn't meet the tread at a hard edge
    [-1, 1].forEach((sd) => {
      const shoulder = new THREE.Mesh(new THREE.TorusGeometry(R - 0.03, 0.035, 8, 36), M.tire);
      shoulder.rotation.y = Math.PI / 2;
      shoulder.position.x = sd * (W / 2 - 0.015);
      w.add(shoulder);
    });
    // 3 guide ribs (thicker for readability)
    [-0.07, 0, 0.07].forEach((x) => {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(R + 0.005, 0.028, 8, 40), M.tire);
      rib.rotation.y = Math.PI / 2;
      rib.position.x = x;
      w.add(rib);
    });
    // Rim barrel (recessed)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, W * 0.85, 24), M.rimFront);
    rim.rotation.z = Math.PI / 2;
    w.add(rim);
    // Outer dish proud of sidewall + protruding hub + lug nuts
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.03, 24), M.rimFront);
    dish.rotation.z = Math.PI / 2;
    dish.position.x = side * (W / 2 - 0.006);
    w.add(dish);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 14), M.castIron);
    hub.rotation.z = Math.PI / 2;
    w.add(hub);
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.025, 12), M.steel);
    hubCap.rotation.z = Math.PI / 2;
    hubCap.position.x = side * 0.16;
    w.add(hubCap);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.08, 6), M.steel);
      b.rotation.z = Math.PI / 2;
      b.position.set(side * (W / 2 + 0.02), Math.sin(a) * 0.11, Math.cos(a) * 0.11);
      w.add(b);
    }
    return w;
  }

  buildWheels() {
    // Rear
    this.rearL = this.makeRearWheel(-1);
    this.rearL.position.set(-0.80, 0.80, 1.10);
    this.root.add(this.rearL);
    this.rearR = this.makeRearWheel(1);
    this.rearR.position.set(0.80, 0.80, 1.10);
    this.root.add(this.rearR);
    // Front (steerable parents)
    this.frontSteerL = new THREE.Group();
    this.frontSteerL.position.set(-0.675, 0.45, -1.35);
    this.frontWheelL = this.makeFrontWheel(-1);
    this.frontSteerL.add(this.frontWheelL);
    this.root.add(this.frontSteerL);
    this.frontSteerR = new THREE.Group();
    this.frontSteerR.position.set(0.675, 0.45, -1.35);
    this.frontWheelR = this.makeFrontWheel(1);
    this.frontSteerR.add(this.frontWheelR);
    this.root.add(this.frontSteerR);

    this.parts.rearWheels = { group: this.rearL, name: 'Rear Drive Wheels 15.5-38', specs: 'Ø1600 mm | Chevron lugs 24×2 | Track 1400-2100 mm | 8-bolt hub' };
    this.parts.rearWheelR = { group: this.rearR, name: 'Rear Wheel RH', specs: 'Ø1600 mm drive wheel | Adjustable track | Ballasted rim' };
    this.parts.frontWheels = { group: this.frontSteerL, name: 'Front Steer Wheels 9-20', specs: 'Ø900 mm ribbed | ±35° Ackermann | Track 1200-1800 mm' };
  }

  /* ---- 11. Hitch + PTO ---- */
  buildHitchPTO() {
    const g = new THREE.Group(); g.name = 'Hitch';
    const M = this.materials;
    // Drawbar
    const bar = this.box(0.10, 0.06, 0.55, M.chassis);
    bar.position.set(0, 0.55, 1.75);
    g.add(bar);
    // Lower links
    [-1, 1].forEach((s) => {
      const link = this.box(0.06, 0.05, 0.70, M.bodyBlue);
      link.position.set(s * 0.32, 0.62, 1.55);
      link.rotation.y = -s * 0.10;
      g.add(link);
      const lift = this.box(0.05, 0.40, 0.05, M.steel);
      lift.position.set(s * 0.28, 1.05, 1.25);
      lift.rotation.x = 0.3;
      g.add(lift);
    });
    // Top link
    const top = this.cyl(0.025, 0.025, 0.60, M.steel, 10);
    top.rotation.x = Math.PI / 2 - 0.25;
    top.position.set(0, 1.05, 1.50);
    g.add(top);
    // PTO shaft (spins)
    this.ptoShaft = new THREE.Group();
    this.ptoShaft.position.set(0, 0.78, 1.42);
    const ptoStub = this.cyl(0.035, 0.035, 0.22, M.steel, 12);
    ptoStub.rotation.x = Math.PI / 2;
    this.ptoShaft.add(ptoStub);
    const ptoGuard = this.cyl(0.055, 0.055, 0.10, M.safetyYellow, 12);
    ptoGuard.rotation.x = Math.PI / 2;
    ptoGuard.position.z = -0.05;
    this.ptoShaft.add(ptoGuard);
    // splines
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sp = this.box(0.012, 0.012, 0.16, M.chrome);
      sp.position.set(Math.cos(a) * 0.036, Math.sin(a) * 0.036, 0.10);
      this.ptoShaft.add(sp);
    }
    g.add(this.ptoShaft);
    // SMV triangle + plate
    const smv = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.015, 3), new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x550000, emissiveIntensity: 0.4 }));
    smv.position.set(-0.45, 1.55, 1.63);
    g.add(smv);
    const plate = this.box(0.30, 0.08, 0.01, M.plate);
    plate.position.set(0.30, 0.95, 1.64);
    g.add(plate);
    const plateFace = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.07), M.plateFace);
    plateFace.position.set(0.30, 0.95, 1.646);
    g.add(plateFace);

    this.root.add(g);
    this.parts.hitch = { group: g, name: '3-Point Hitch & PTO', specs: 'Cat II 3-pt | 540 rpm PTO @ 1600 eng rpm | Drawbar + SMV' };
  }

  /* ---- 12. Ballast + steps + rails ---- */
  buildBallastSteps() {
    const g = new THREE.Group(); g.name = 'BallastSteps';
    const M = this.materials;
    // Front suitcase weights (6 slabs)
    for (let i = 0; i < 6; i++) {
      const wt = this.box(0.52, 0.16, 0.09, M.weight);
      wt.position.set(0, 0.62 + (i % 3) * 0.17, -1.86 - Math.floor(i / 3) * 0.10);
      g.add(wt);
    }
    const bracket = this.box(0.30, 0.10, 0.30, M.chassis);
    bracket.position.set(0, 0.55, -1.72);
    g.add(bracket);
    // Front number plate facing forward
    const fplate = this.box(0.32, 0.09, 0.012, M.plate);
    fplate.position.set(0, 0.78, -1.915);
    g.add(fplate);
    const fplateFace = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.075), M.plateFace);
    fplateFace.position.set(0, 0.78, -1.922);
    fplateFace.rotation.y = Math.PI;
    g.add(fplateFace);
    // Access steps both sides (3 treads) + stringers + handrails
    [-1, 1].forEach((s) => {
      for (let i = 0; i < 3; i++) {
        const st = this.box(0.28, 0.03, 0.22, M.steel);
        st.position.set(s * 0.72, 0.42 + i * 0.24, 0.15);
        g.add(st);
        // anti-slip nosing on each tread
        const edge = this.box(0.28, 0.035, 0.025, M.chassis);
        edge.position.set(s * 0.72, 0.42 + i * 0.24, 0.05);
        g.add(edge);
      }
      // Inner + outer stringers tying the treads together, hung from cab floor
      [0.59, 0.85].forEach((x) => {
        const str = this.box(0.035, 0.78, 0.035, M.chassis);
        str.position.set(s * x, 0.68, 0.15);
        g.add(str);
      });
      const mount = this.box(0.24, 0.045, 0.30, M.chassis);
      mount.position.set(s * 0.72, 1.06, 0.15);
      g.add(mount);
      const rail = this.cyl(0.016, 0.016, 1.10, M.bodyBlue, 10);
      rail.position.set(s * 0.70, 1.55, -0.10);
      rail.rotation.x = 0.15;
      g.add(rail);
    });
    // Curved heat shield hugging the muffler + clamp bands (replaces slab)
    const shield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.125, 0.36, 14, 1, true, Math.PI / 2 - 0.9, 1.8),
      M.steel
    );
    shield.position.set(0.24, 1.72, -1.10);
    g.add(shield);
    [1.60, 1.84].forEach((y) => {
      const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.126, 0.008, 6, 20), M.chassis);
      clamp.rotation.x = Math.PI / 2;
      clamp.position.set(0.24, y, -1.10);
      g.add(clamp);
    });

    this.root.add(g);
    this.parts.ballast = { group: g, name: 'Ballast, Steps & Rails', specs: '6× front weights (~240 kg) | Access ladders | Grab rails' };
  }

  /* ================= EXPLODE ================= */
  registerExplodeOffsets() {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const set = (key, off) => {
      if (this.parts[key]) {
        this.parts[key].group.userData.basePos = this.parts[key].group.position.clone();
        this.parts[key].explodeOffset = off;
      }
    };
    set('hood', V(0, 1.0, -0.5));
    set('engine', V(0, 0.55, -0.4));
    set('exhaust', V(0.7, 0.9, -0.3));
    set('fuelTank', V(0, 0.8, 0.1));
    set('cab', V(0, 1.5, 0.3));
    set('fenders', V(0, 0.5, 0.4));
    set('transmission', V(0, -0.15, 0.5));
    set('frontAxle', V(0, -0.3, -0.7));
    set('hitch', V(0, 0.1, 1.0));
    set('ballast', V(0, -0.1, -1.0));
    set('rearWheels', V(-1.1, 0.1, 0.2));
    set('rearWheelR', V(1.1, 0.1, 0.2));
    set('frontWheels', V(-0.9, 0, -0.5));
    set('chassis', V(0, -0.35, 0));
    // front RH steer group shares offset via manual handling
    if (this.frontSteerR) {
      this.frontSteerR.userData.basePos = this.frontSteerR.position.clone();
      this.frontSteerR.userData.explodeOffset = V(0.9, 0, -0.5);
    }
  }

  setExplodeFactor(f) {
    this.explodeFactor = THREE.MathUtils.clamp(f, 0, 1);
    for (const k in this.parts) {
      const p = this.parts[k];
      if (p.group.userData.basePos && p.explodeOffset) {
        p.group.position.copy(p.group.userData.basePos).addScaledVector(p.explodeOffset, this.explodeFactor);
      }
    }
    if (this.frontSteerR?.userData.basePos) {
      this.frontSteerR.position.copy(this.frontSteerR.userData.basePos)
        .addScaledVector(this.frontSteerR.userData.explodeOffset, this.explodeFactor);
    }
  }

  /* Body modes: solid | xray | service (hood lifted open) */
  setCrossSectionMode(mode) {
    this.bodyMode = mode;
    const transparent = (mode === 'xray');
    [this.materials.bodyBlue, this.materials.cream].forEach((m) => {
      m.transparent = transparent;
      m.opacity = transparent ? 0.25 : 1.0;
      m.needsUpdate = true;
    });
    this.materials.glass.opacity = transparent ? 0.12 : 0.32;
    // Service mode: tilt hood open
    if (this.hoodGroup) {
      const target = mode === 'service' ? -0.55 : 0;
      this.hoodGroup.rotation.x = target;
      if (mode === 'service') this.hoodGroup.position.y = 0.25;
      else if (this.parts.hood?.group.userData.basePos) {
        // keep explode offset applied
        this.setExplodeFactor(this.explodeFactor);
        this.hoodGroup.rotation.x = 0;
      }
    }
  }
  // alias used by piston-style UI
  setClippingMode(m) { this.setCrossSectionMode(m); }

  /* ================= PER-FRAME UPDATE ================= */
  update(state) {
    // Wheel spin about the axle (X axis). Negative sign = forward roll:
    // with the nose at -Z, the tread crown must travel toward -Z.
    const rr = state.wheelRotationRear, fr = state.wheelRotationFront;
    if (this.rearL) this.rearL.rotation.x = -rr;
    if (this.rearR) this.rearR.rotation.x = -rr;
    if (this.frontWheelL) this.frontWheelL.rotation.x = -fr;
    if (this.frontWheelR) this.frontWheelR.rotation.x = -fr;
    // Steering yaw: slider + = right-hand turn => negative yaw about +Y
    const st = state.steeringRad || 0;
    const yaw = -st;
    // Ackermann geometry: inner wheel cuts sharper (+8%), outer runs straighter (-6%)
    const turn = Math.sign(st);
    if (this.frontSteerL) this.frontSteerL.rotation.y = yaw * (turn >= 0 ? 0.94 : 1.08);
    if (this.frontSteerR) this.frontSteerR.rotation.y = yaw * (turn >= 0 ? 1.08 : 0.94);
    if (this.tieRod) this.tieRod.position.x = Math.sin(st) * 0.10;
    // Steering wheel spins with steering + slight idle rotation
    if (this.steerWheel) this.steerWheel.rotation.y = -st * 6.0;
    if (this.steerColumn) this.steerColumn.rotation.z = -st * 0.06;
    // Fan + PTO
    if (this.fanGroup) this.fanGroup.rotation.z = -state.fanAngle;
    if (this.ptoShaft) this.ptoShaft.rotation.z = state.ptoAngle;
    // Engine shake on engine+hood
    const sh = state.engineShake || 0;
    if (this.parts.engine) this.parts.engine.group.position.x = (this.parts.engine.group.userData.basePos?.x || 0) + sh;
    // Exhaust smoke puff
    if (this.smoke) {
      const p = state.exhaustPuff || 0;
      this.smoke.material.opacity = 0.10 + p * 0.22;
      const s = 0.8 + p * 1.6 + Math.random() * 0.08;
      this.smoke.scale.set(s, s * 1.4, s);
      this.smoke.position.y = this.exhaustTip.position.y + p * 0.22;
    }
    // Beacon flash
    if (this.beaconMesh) {
      const t = performance.now() / 1000;
      this.beaconMesh.material.emissiveIntensity = (Math.sin(t * 6) > 0.2) ? 2.2 : 0.4;
    }
  }
}
