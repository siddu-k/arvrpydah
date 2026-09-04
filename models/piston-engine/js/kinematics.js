/**
 * 4-Stroke Engine Kinematics Engine
 * Implements exact slider-crank mathematical equations and camshaft valvetrain timing.
 */

export class EngineKinematics {
  constructor(params = {}) {
    // Standard engineering dimensions (scaled in 3D units, 1 unit = ~100mm)
    this.stroke = params.stroke || 0.88;       // Piston stroke (distance between TDC and BDC)
    this.crankRadius = this.stroke / 2;       // r = stroke / 2 = 0.44
    this.conRodLength = params.conRodLength || 1.38; // l = connecting rod center-to-center length (~3.14 r/l ratio)
    this.bore = params.bore || 0.85;           // Cylinder bore diameter
    this.wristPinHeight = 0.32;               // Height of wrist pin inside piston crown

    // Current state
    this.crankAngle = 0; // In radians, 0 to 4*PI (0 to 720 degrees)
    this.rpm = 1200;
    this.isRunning = true;

    // Derived kinematics cache
    this.state = {
      crankAngleDeg: 0,
      cycleAngleDeg: 0, // 0 to 720
      strokePhase: 'INTAKE', // INTAKE, COMPRESSION, POWER, EXHAUST
      strokeProgress: 0, // 0 to 1 within current stroke
      crankPinPos: { x: 0, y: 0, z: 0 },
      wristPinPos: { x: 0, y: 0, z: 0 },
      pistonPos: { x: 0, y: 0, z: 0 },
      conRodAngle: 0, // Radians
      intakeValveLift: 0, // 0 to 1
      exhaustValveLift: 0, // 0 to 1
      sparkPlugFiring: false,
      cylinderPressure: 1.0, // atm / relative pressure
      gasTemperature: 300, // Kelvin
    };
  }

  setRPM(rpm) {
    this.rpm = Math.max(0, Math.min(rpm, 9000));
  }

  setCrankAngleDeg(deg) {
    let normalized = deg % 720;
    if (normalized < 0) normalized += 720;
    this.crankAngle = (normalized * Math.PI) / 180;
    this.updateKinematics(0);
  }

  update(deltaSeconds) {
    if (this.isRunning && this.rpm > 0) {
      // 1 revolution = 2*PI radians. RPM = revolutions per minute
      const radPerSec = (this.rpm / 60) * (2 * Math.PI);
      this.crankAngle = (this.crankAngle + radPerSec * deltaSeconds) % (4 * Math.PI);
    }
    this.updateKinematics(deltaSeconds);
    return this.state;
  }

  updateKinematics(deltaSeconds) {
    const theta = this.crankAngle; // 0 to 4*PI (0 to 720 degrees)
    const r = this.crankRadius;
    const l = this.conRodLength;

    // Cycle angle in degrees (0 to 720)
    const cycleDeg = ((theta * 180) / Math.PI) % 720;
    this.state.crankAngleDeg = cycleDeg % 360;
    this.state.cycleAngleDeg = cycleDeg;

    // 1. Crankpin Journal Position (spinning about Z axis in X-Y plane)
    // At theta = 0 (TDC), crankpin is pointing straight UP along +Y
    const crankX = r * Math.sin(theta);
    const crankY = r * Math.cos(theta);
    const crankZ = 0;
    this.state.crankPinPos = { x: crankX, y: crankY, z: crankZ };

    // 2. Exact Slider-Crank Equation for Wrist Pin
    // Wrist pin is constrained to move along Y-axis (x = 0, z = 0)
    // Distance between crankpin and wristpin is l:
    // (0 - crankX)^2 + (y_wp - crankY)^2 = l^2
    // y_wp = crankY + sqrt(l^2 - crankX^2)
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const underRadical = l * l - r * r * sinTheta * sinTheta;
    const yWp = r * cosTheta + Math.sqrt(Math.max(0, underRadical));

    this.state.wristPinPos = { x: 0, y: yWp, z: 0 };

    // 3. Connecting Rod Angle (tilt relative to vertical Y axis)
    // Connecting rod vector from crankpin to wrist pin has dx = 0 - crankX = -crankX
    // Rotating (0, l) by beta yields (-l*sin(beta), l*cos(beta))
    // We need -l*sin(beta) = -crankX => sin(beta) = crankX / l
    const conRodAngle = Math.asin(crankX / l);
    this.state.conRodAngle = conRodAngle;

    // 4. Piston Position (attached to wrist pin)
    // The piston crown is at wristPin.y + wristPinHeight
    this.state.pistonPos = { x: 0, y: yWp, z: 0 };

    // 5. Four Stroke Cycle Identification & Valve Lifts
    // Stroke 1: INTAKE (0° - 180°) -> Piston TDC to BDC, Intake Valve OPEN
    // Stroke 2: COMPRESSION (180° - 360°) -> Piston BDC to TDC, both valves CLOSED
    // Stroke 3: POWER / COMBUSTION (360° - 540°) -> Spark fires at ~355°-365°, Piston TDC to BDC, both CLOSED
    // Stroke 4: EXHAUST (540° - 720°) -> Piston BDC to TDC, Exhaust Valve OPEN

    let intakeLift = 0;
    let exhaustLift = 0;
    let firing = false;
    let pressure = 1.0;
    let temp = 300;
    let phase = 'INTAKE';
    let progress = 0;

    if (cycleDeg >= 0 && cycleDeg < 180) {
      phase = 'INTAKE';
      progress = cycleDeg / 180;
      // Intake valve opens around 355° of prev cycle up to 195°, peaks around 90°
      const camTheta = (cycleDeg - 0) / 180 * Math.PI;
      intakeLift = Math.pow(Math.sin(camTheta), 1.6);
      exhaustLift = 0;
      pressure = 0.9 + 0.1 * (1 - progress);
      temp = 295 + 15 * progress;
    } else if (cycleDeg >= 180 && cycleDeg < 360) {
      phase = 'COMPRESSION';
      progress = (cycleDeg - 180) / 180;
      intakeLift = 0;
      exhaustLift = 0;
      // Exponential pressure buildup: PV^gamma = const
      pressure = 1.0 + Math.pow(progress, 2.5) * 12.0;
      temp = 310 + Math.pow(progress, 2.0) * 450;
      // Spark fires right before TDC (at 352° - 365°)
      if (cycleDeg >= 352 && cycleDeg <= 365) {
        firing = true;
      }
    } else if (cycleDeg >= 360 && cycleDeg < 540) {
      phase = 'POWER';
      progress = (cycleDeg - 360) / 180;
      intakeLift = 0;
      exhaustLift = 0;
      // Spark continuation for early power
      if (cycleDeg < 368) {
        firing = true;
      }
      // Extreme pressure spike at ignition, then adiabatic expansion
      pressure = 13.0 * Math.exp(-progress * 2.8) + 1.2;
      temp = 760 * Math.exp(-progress * 1.5) + 400;
    } else {
      phase = 'EXHAUST';
      progress = (cycleDeg - 540) / 180;
      intakeLift = 0;
      // Exhaust valve opens around 530° to 715°, peaks around 630°
      const camTheta = (cycleDeg - 540) / 180 * Math.PI;
      exhaustLift = Math.pow(Math.sin(camTheta), 1.6);
      pressure = 1.2 - 0.2 * progress;
      temp = 450 - 120 * progress;
    }

    this.state.strokePhase = phase;
    this.state.strokeProgress = progress;
    this.state.intakeValveLift = Math.max(0, Math.min(1, intakeLift));
    this.state.exhaustValveLift = Math.max(0, Math.min(1, exhaustLift));
    this.state.sparkPlugFiring = firing;
    this.state.cylinderPressure = pressure;
    this.state.gasTemperature = temp;
  }
}
