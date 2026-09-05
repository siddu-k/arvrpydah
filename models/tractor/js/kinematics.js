/**
 * MTZ-80 / Belarus-class Tractor Kinematics
 * Blueprint-accurate dimensions (meters):
 *  Length 3.93 | Wheelbase 2.45 | Height 2.47 | Width 1.97
 *  Front track 1.20-1.80 | Rear track 1.40-2.10
 *  Rear tire 15.5-38 (R~0.80) | Front tire 9.0-20 (R~0.45)
 */

export class TractorKinematics {
  constructor(params = {}) {
    // Blueprint dimensions
    this.wheelbase = 2.45;
    this.rearTrack = params.rearTrack || 1.60;
    this.frontTrack = params.frontTrack || 1.35;
    this.rearTireR = 0.80;
    this.frontTireR = 0.45;

    // State
    this.rpm = 1200;
    this.maxRPM = 2200;
    this.isRunning = true;
    this.driveEnabled = true;
    this.speedKmh = 8;          // target ground speed
    this.steeringDeg = 0;       // -35 .. +35
    this.ptoRPM = 540;

    this.wheelRotationRear = 0;
    this.wheelRotationFront = 0;
    this.steerCurrent = 0; // smoothed road-wheel angle (hydraulic feel)
    this.ptoAngle = 0;
    this.fanAngle = 0;
    this.enginePhase = 0; // for vibration

    this.state = {
      rpm: 1200,
      speedKmh: 8,
      actualSpeedMs: 0,
      steeringDeg: 0,
      steeringRad: 0,
      wheelRotationRear: 0,
      wheelRotationFront: 0,
      ptoAngle: 0,
      fanAngle: 0,
      engineShake: 0,
      exhaustPuff: 0,
    };
  }

  setRPM(rpm) {
    this.rpm = Math.max(0, Math.min(rpm, 2400));
  }
  setSpeed(kmh) {
    this.speedKmh = Math.max(0, Math.min(kmh, 35));
  }
  setSteering(deg) {
    this.steeringDeg = Math.max(-35, Math.min(35, deg));
  }

  update(deltaSeconds) {
    const dt = Math.min(deltaSeconds, 0.1);

    // Engine idle shake amplitude inversely proportional to rpm
    if (this.isRunning && this.rpm > 0) {
      this.enginePhase += dt * (this.rpm / 60) * Math.PI * 2;
      // Diesel 4-cyl 4-stroke: combustion freq = rpm/60 * 2
      this.exhaustTimer = (this.exhaustTimer || 0) + dt * (this.rpm / 60) * 2;
    }

    // Ground speed follows throttle: scale with rpm when driving
    const throttle = this.rpm / this.maxRPM;
    const targetMs = this.driveEnabled && this.isRunning
      ? (this.speedKmh / 3.6) * (0.25 + 0.75 * Math.min(1, throttle + 0.25))
      : 0;

    const cur = this.state.actualSpeedMs || 0;
    const accel = 2.2 * dt;
    this.state.actualSpeedMs = Math.abs(targetMs - cur) < accel
      ? targetMs
      : cur + Math.sign(targetMs - cur) * accel;

    const v = this.state.actualSpeedMs;
    // Wheel angular rotations
    this.wheelRotationRear = (this.wheelRotationRear + (v / this.rearTireR) * dt) % (Math.PI * 2);
    this.wheelRotationFront = (this.wheelRotationFront + (v / this.frontTireR) * dt) % (Math.PI * 2);
    // PTO + cooling fan scale with engine rpm
    const ptoRad = this.isRunning ? (this.ptoRPM / 60) * Math.PI * 2 * dt * (this.rpm / 1600) : 0;
    this.ptoAngle = (this.ptoAngle + ptoRad) % (Math.PI * 2);
    this.fanAngle = (this.fanAngle + dt * (this.rpm / 60) * Math.PI * 2 * 1.2) % (Math.PI * 2);

    const shakeAmp = this.isRunning ? (0.0035 * (1 - Math.min(1, this.rpm / 2200)) + 0.0012) : 0;
    const shake = Math.sin(this.enginePhase * 2) * shakeAmp;

    // Smooth steering toward the commanded angle (power-steering easing)
    this.steerCurrent += (this.steeringDeg - this.steerCurrent) * Math.min(1, dt * 6);
    if (Math.abs(this.steeringDeg - this.steerCurrent) < 0.01) this.steerCurrent = this.steeringDeg;

    this.state.rpm = this.rpm;
    this.state.speedKmh = v * 3.6;
    this.state.steeringDeg = this.steerCurrent;
    this.state.steeringRad = (this.steerCurrent * Math.PI) / 180;
    this.state.wheelRotationRear = this.wheelRotationRear;
    this.state.wheelRotationFront = this.wheelRotationFront;
    this.state.ptoAngle = this.ptoAngle;
    this.state.fanAngle = this.fanAngle;
    this.state.engineShake = shake;
    // Exhaust puff pulse 0..1
    this.state.exhaustPuff = this.isRunning ? Math.max(0, Math.sin(this.enginePhase * 2)) * Math.min(1, this.rpm / 1800) : 0;

    return this.state;
  }
}
