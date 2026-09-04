/**
 * ARVR CAD Platform - Model Catalog Registry
 * Centralized registry of all available interactive 3D WebXR models.
 */

export const MODEL_CATALOG = [
  {
    id: 'piston',
    title: '4-Stroke Engine DOHC',
    category: 'Powertrain Engineering',
    tag: 'Interactive Kinematics',
    badge: 'V2 Blueprint CAD',
    description: 'High-precision internal combustion engine cross-section with real-time slider-crank kinematics, 21.8° canted valvetrain, DOHC camshafts, and explosion view.',
    specs: [
      { label: 'Bore x Stroke', val: '85 mm x 88 mm' },
      { label: 'Valvetrain', val: 'DOHC 4-Valve Pent-Roof' },
      { label: 'Compression', val: '10.5 : 1 Ratio' },
      { label: 'WebXR Support', val: 'Immersive VR + AR' }
    ],
    features: ['Real-time Slider-Crank', 'Canted Valves', '6-DoF VR Controllers', 'Explode / Assemble'],
    href: 'piston.html',
    status: 'ACTIVE',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17.93V15a3 3 0 0 0-2 0v4.93A8 8 0 0 1 4.07 13H9a3 3 0 0 0 0-2H4.07A8 8 0 0 1 11 4.07V9a3 3 0 0 0 2 0V4.07A8 8 0 0 1 19.93 11H15a3 3 0 0 0 0 2h4.93A8 8 0 0 1 13 19.93z"/></svg>`
  },
  {
    id: 'turbocharger',
    title: 'Twin-Scroll Turbocharger',
    category: 'Forced Induction',
    tag: 'Aerodynamic Flow',
    badge: 'Coming Next',
    description: 'Variable-geometry dual ball-bearing turbocharger with exhaust turbine housing, billet compressor wheel, wastegate actuator, and fluid thermal cutaway.',
    specs: [
      { label: 'Turbine Wheel', val: 'Inconel 713C' },
      { label: 'Compressor', val: 'Forged Milled Billet' },
      { label: 'Max Speed', val: '185,000 RPM' },
      { label: 'Boost Pressure', val: '2.4 bar peak' }
    ],
    features: ['Twin-Scroll Volute', 'Fluid Flow Streamlines', 'Wastegate Actuation', 'Thermal Gradient'],
    href: '#',
    status: 'ROADMAP',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16.93V15h-2v3.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 11.2V9l-5.6-2.24C4.85 4.3 8.16 2.5 12 2.5c4.14 0 7.5 3.36 7.5 7.5 0 2.91-1.66 5.43-4.08 6.67L13 15v3.93z"/></svg>`
  },
  {
    id: 'transmission',
    title: 'Dual-Clutch Transmission (DCT)',
    category: 'Drivetrain Systems',
    tag: 'Gearbox Kinematics',
    badge: 'In Development',
    description: '7-speed electro-hydraulic dual-clutch transmission with concentric input shafts, helical gear sets, synchronizer sleeves, and limited-slip differential.',
    specs: [
      { label: 'Gear Ratios', val: '7-Speed + Reverse' },
      { label: 'Clutch Type', val: 'Wet Multi-Plate Dual' },
      { label: 'Shift Time', val: '80 ms Direct Shift' },
      { label: 'Differential', val: 'Electronic LSD' }
    ],
    features: ['Concentric Shafts', 'Synchronizer Motion', 'Shift Fork Actuation', 'Torque Flow Paths'],
    href: '#',
    status: 'ROADMAP',
    icon: `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`
  }
];
