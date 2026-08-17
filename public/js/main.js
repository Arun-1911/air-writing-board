// Application entry point: wires camera + hand tracking + gestures into the
// drawing engine, and drives the render loop.

import { startWebcam, stopWebcam } from "./camera.js";
import { loadHandTracking, detectHand } from "./handTracking.js";
import { FingertipSmoother, PinchDetector } from "./gestures.js";
import { DrawingEngine } from "./drawingEngine.js";
import { state, setState } from "./state.js";
import { LANDMARK, HAND_LOST_TIMEOUT_MS, BRUSH_SIZES, ERASER_SIZE } from "./config.js";
import {
    initUI,
    showLoading,
    hideLoading,
    showCameraError,
    enterActiveMode,
    advanceInstructions,
} from "./ui.js";

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], // thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // index
    [5, 9], [9, 10], [10, 11], [11, 12], // middle
    [9, 13], [13, 14], [14, 15], [15, 16], // ring
    [13, 17], [17, 18], [18, 19], [19, 20], // pinky
    [0, 17],
];

const video = document.getElementById("webcam");
const stage = document.getElementById("stage");
const drawCanvas = document.getElementById("drawCanvas");
const debugCanvas = document.getElementById("debugCanvas");
const debugCtx = debugCanvas.getContext("2d");

const engine = new DrawingEngine(drawCanvas);
const smoother = new FingertipSmoother();
const pinchDetector = new PinchDetector();

let running = false;
let rafId = null;
let lastVideoTime = -1;
let lastHandSeenAt = 0;
let hasEverDetectedHand = false;
let hasEverDrawn = false;

const dom = initUI({
    engine,
    onStart: () => beginSession(),
    onRetryCamera: () => beginSession(),
});

function resizeCanvases() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [drawCanvas, debugCanvas]) {
        c.width = rect.width * dpr;
        c.height = rect.height * dpr;
    }
    engine.render();
}

window.addEventListener("resize", () => {
    if (running) resizeCanvases();
});

async function beginSession() {
    dom.cameraError.hidden = true;
    try {
        await startWebcam(video);
    } catch (err) {
        console.error(err);
        showCameraError(dom, err.message);
        dom.startBtn.disabled = false;
        dom.startBtn.textContent = "Start Camera";
        setState({ cameraStatus: "error" });
        return;
    }

    resizeCanvases();
    setState({ cameraStatus: "ready" });
    enterActiveMode(dom);
    advanceInstructions(dom, 1);

    running = true;
    smoother.reset();
    pinchDetector.reset();
    predictLoop();
}

function predictLoop() {
    if (!running) return;

    const now = performance.now();

    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const landmarks = detectHand(video, now);

        if (landmarks) {
            lastHandSeenAt = now;
            if (!hasEverDetectedHand) {
                hasEverDetectedHand = true;
                advanceInstructions(dom, 2);
            }
            handleLandmarks(landmarks, now);
        } else if (now - lastHandSeenAt > HAND_LOST_TIMEOUT_MS) {
            handleHandLost();
        }
    }

    // Rendered every animation frame (not just on new video frames) so
    // stroke fade-outs and the cursor marker animate smoothly in between.
    engine.render(now);
    drawCursor();

    rafId = requestAnimationFrame(predictLoop);
}

function handleLandmarks(landmarks, now) {
    setState({ handDetected: true });

    const rawX = 1 - landmarks[LANDMARK.INDEX_TIP].x; // mirror to match the mirrored preview
    const rawY = landmarks[LANDMARK.INDEX_TIP].y;
    const { x, y } = smoother.push(rawX, rawY);

    const pinched = pinchDetector.update(landmarks, now);
    const wasDrawing = state.isDrawing;

    if (pinched && !wasDrawing) {
        const isEraser = state.tool === "eraser";
        engine.beginStroke(state.color, isEraser ? ERASER_SIZE : state.brushSize, isEraser, now);
        engine.addPoint(x, y);
        setState({ isDrawing: true });
        if (!hasEverDrawn) {
            hasEverDrawn = true;
            advanceInstructions(dom, 3);
        }
    } else if (pinched && wasDrawing) {
        engine.addPoint(x, y);
    } else if (!pinched && wasDrawing) {
        engine.endStroke(now);
        setState({ isDrawing: false });
    }

    cursorPos = { x, y, visible: true };

    if (state.debugMode) drawDebugSkeleton(landmarks);
    else if (debugDrawnLastFrame) clearDebug();
}

function handleHandLost() {
    if (state.isDrawing) {
        engine.endStroke();
    }
    setState({ handDetected: false, isDrawing: false });
    smoother.reset();
    pinchDetector.reset();
    cursorPos.visible = false;
    clearDebug();
}

let cursorPos = { x: 0, y: 0, visible: false };
let debugDrawnLastFrame = false;

function drawCursor() {
    if (!cursorPos.visible) return;
    const ctx = engine.ctx;
    const px = cursorPos.x * drawCanvas.width;
    const py = cursorPos.y * drawCanvas.height;
    const radius = state.isDrawing ? 7 : 9;

    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.strokeStyle = state.isDrawing ? state.color : "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.shadowColor = state.isDrawing ? state.color : "transparent";
    ctx.shadowBlur = state.isDrawing ? 10 : 0;
    ctx.stroke();

    if (state.isDrawing) {
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = state.color;
        ctx.fill();
    }
    ctx.restore();
}

function drawDebugSkeleton(landmarks) {
    debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    const toPx = (lm) => ({ x: (1 - lm.x) * debugCanvas.width, y: lm.y * debugCanvas.height });

    debugCtx.strokeStyle = "rgba(96, 165, 250, 0.8)";
    debugCtx.lineWidth = 2;
    for (const [a, b] of HAND_CONNECTIONS) {
        const pa = toPx(landmarks[a]);
        const pb = toPx(landmarks[b]);
        debugCtx.beginPath();
        debugCtx.moveTo(pa.x, pa.y);
        debugCtx.lineTo(pb.x, pb.y);
        debugCtx.stroke();
    }

    debugCtx.fillStyle = "#f472b6";
    for (const lm of landmarks) {
        const p = toPx(lm);
        debugCtx.beginPath();
        debugCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        debugCtx.fill();
    }
    debugDrawnLastFrame = true;
}

function clearDebug() {
    debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    debugDrawnLastFrame = false;
}

(async function init() {
    try {
        showLoading(dom, "Loading hand-tracking model…");
        await loadHandTracking();
        hideLoading(dom);
        dom.startBtn.disabled = false;
        dom.startBtn.textContent = "Start Camera";
    } catch (err) {
        console.error(err);
        showLoading(dom, "Failed to load the hand-tracking model. Check your connection and reload.");
        return;
    }
})();

window.addEventListener("beforeunload", () => {
    if (running) stopWebcam(video);
});
