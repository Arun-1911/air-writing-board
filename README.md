# Air-Writing Board

**Pinch to draw in the air over a live webcam feed — real-time hand-landmark tracking turns your fingertip into a pen, entirely in the browser.**

![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)
![MediaPipe](https://img.shields.io/badge/MediaPipe-HandLandmarker-0F9D58?logo=google&logoColor=white)
![Canvas](https://img.shields.io/badge/HTML5-Canvas-E34F26?logo=html5&logoColor=white)
![Express](https://img.shields.io/badge/Express-static%20server-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

No install beyond Node, no cloud API, no GPU requirement beyond what's already in your laptop's browser. Stand in front of your camera, pinch your thumb and index finger together, and write — letters, signatures, diagrams, whatever — directly in the air. Strokes render as smooth, handwriting-like curves and fade out on their own a few seconds later, so the board never needs manual clearing.

---

## How it works

```
webcam frame
     │
     ▼
MediaPipe HandLandmarker  (WASM/WebGL, in-browser)
     │  21 hand landmarks, normalized 0–1
     ▼
pinch detection            thumb–index distance, normalized by hand size,
     │                     with hysteresis + debounce to stop flicker
     ▼
fingertip smoothing        exponential moving average
     │
     ▼
stroke engine               quadratic-curve rendering, undo/redo,
     │                      per-stroke 10s auto-fade
     ▼
<canvas> overlay, composited live over the mirrored camera feed
```

| | Where it runs |
|---|---|
| Camera capture & hand-landmark inference | Browser (MediaPipe, WebAssembly/WebGL) |
| Gesture logic, smoothing, stroke rendering | Browser (Canvas 2D) |
| Static file serving | Express (Node) |
| Camera frames / hand data | Never leave the browser |

The pinch threshold is a *ratio* of thumb–index distance to the hand's own size (wrist → middle-finger knuckle), not a fixed pixel distance — so detection stays consistent whether you're close to the camera or a few feet back.

## Quick start

```bash
cd backend
npm install
npm start
```

Open `http://localhost:3000`, click **Start Camera**, and allow camera access when prompted.

## Controls

| Gesture | Action |
|---|---|
| Pinch thumb + index finger | Pen down — start/continue a stroke |
| Release pinch | Pen up — move without drawing |
| Move hand out of frame | Pen lifts automatically after a short grace period |

| Toolbar | Action |
|---|---|
| Undo / Redo | Remove or restore the most recent stroke |
| Clear | Erase the entire board |
| Pen / Eraser | Switch drawing tool |
| Color | White, red, blue, green, yellow |
| Brush size | Small / medium / large |
| Camera toggle | Show/hide the raw feed under your drawing |
| Debug toggle | Show the hand-landmark skeleton (off by default) |
| Save | Export the board + camera frame as a PNG |

Strokes fade out and disappear about 10 seconds after they're drawn — export a PNG first if you want to keep something.

## Project structure

```
backend/            Express static file server
public/
  index.html          Markup: video/canvas stage, status panel, toolbar
  style.css            Styling
  js/
    config.js            Tunables: gesture thresholds, colors, model URLs
    state.js             Central app state + pub-sub
    camera.js            getUserMedia lifecycle + error handling
    handTracking.js      MediaPipe HandLandmarker loading/detection
    gestures.js          Pinch detection (hysteresis) + fingertip smoothing
    drawingEngine.js     Stroke storage, rendering, undo/redo, PNG export
    ui.js                DOM wiring for toolbar/status/instructions
    main.js              Entry point / render loop
```

## Troubleshooting

- **Camera access denied** — allow camera permission for the site in your browser and reload.
- **No camera found** — check a webcam is connected and not disabled in OS privacy settings.
- **Camera already in use** — close other apps (Zoom, Teams, other tabs) holding the camera.
- **Hand not detected** — keep your hand fully in frame, in good lighting.
- **Pinch not registering reliably** — bring thumb and index fingertip clearly together; the threshold is distance-normalized so it works at any range from the camera.

## Known limitations

- Single-hand tracking by design — the app never swaps between hands mid-session.
- No shape or handwriting recognition; it preserves your actual drawn strokes.
- Eraser works at the stroke-compositing level, not pixel-perfect partial erasing.
- Needs reasonably even lighting for stable hand detection.

## License

MIT
