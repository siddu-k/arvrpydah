# AERO-4 WebXR Engineering Model Hub

AERO-4 is a browser-based 3D/WebXR engineering showcase for interactive mechanical assemblies.  
It provides a dashboard and dedicated model workspaces for inspecting CAD-like components, running kinematics simulations, and entering immersive AR/VR sessions.

## Purpose

This repository hosts a static web application for:
- Browsing available engineering models from a dashboard
- Exploring high-fidelity 3D mechanical assemblies
- Interacting with model-specific controls (telemetry, cutaways, exploded views, presets)
- Using WebXR AR/VR experiences with controller-based interaction

## Current Models

- **4-Stroke Engine Assembly** (`models/piston-engine/`)
  - Real-time 4-stroke kinematics
  - Component focus/inspection panel
  - Cross-section and exploded view controls
  - Procedural engine audio
- **MTZ-80 Tractor Assembly** (`models/tractor/`)
  - Vehicle/engine telemetry and controls
  - Steering/speed simulation and part inspection
  - Exploded/service/X-ray style modes
  - Procedural diesel-style audio

Additional catalog cards (turbocharger/DCT) are present as roadmap items in the dashboard UI.

## Project Structure

```text
/
├── index.html                # Main model dashboard
├── style.css                 # Shared UI/theme styles
├── dashboard.css             # Dashboard-specific styling
├── js/                       # Root engine app modules
│   ├── app.js
│   ├── kinematics.js
│   ├── model.js
│   ├── xr.js
│   ├── audio.js
│   └── models-data.js
└── models/
    ├── piston-engine/        # Dedicated 4-stroke engine experience
    └── tractor/              # Dedicated MTZ-80 tractor experience
```

## Tech Stack

- **Three.js** (loaded via import maps from jsDelivr CDN)
- **WebXR Device API** for immersive VR/AR sessions
- **Web Audio API** for procedural mechanical sound synthesis
- Plain **HTML/CSS/JavaScript** (no build system required)

## Setup & Run

Because ES modules and WebXR are used, run from a local web server (not `file://`).

### Option 1: Python

```bash
cd /home/runner/work/arvrpydah/arvrpydah
python3 -m http.server 8080
```

Open: `http://localhost:8080`

### Option 2: Any static server

Serve the repository root and open `index.html` in your browser.

## Usage

1. Open the dashboard (`/index.html`)
2. Launch a model card (engine or tractor)
3. Use on-screen controls for simulation and inspection
4. If supported, enter:
   - **VR** via “Enter VR”
   - **AR** via “Enter AR” (surface hit-test placement)

## Configuration Notes

- Three.js and addons are currently pinned in import maps to `0.160.0` in model pages.
- XR feature availability is runtime-detected in the app and AR/VR buttons are enabled/disabled automatically.
- Audio starts muted by default and is activated by user interaction to align with browser autoplay restrictions.

## Security & Privacy Notes

- No secrets or API keys are required for local execution.
- Dependencies are fetched from public CDNs at runtime; use trusted networks and consider self-hosting pinned assets for stricter supply-chain control.
- WebXR requires HTTPS in most environments (except localhost) and explicit user permission for immersive sessions.

## Browser/Device Expectations

- Modern Chromium-based browsers are recommended for best WebXR support.
- AR/VR behavior depends on hardware/browser support (e.g., headset/mobile AR capabilities).
- If XR is unavailable, the desktop 3D experience remains usable.
