// Central tunables for the air-writing board.

export const VISION_VERSION = "0.10.14";
export const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
export const HAND_MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Hand landmark indices (MediaPipe HandLandmarker).
export const LANDMARK = {
    WRIST: 0,
    THUMB_TIP: 4,
    INDEX_MCP: 5,
    INDEX_TIP: 8,
    MIDDLE_MCP: 9,
    PINKY_MCP: 17,
};

// Pinch gesture thresholds, expressed as a ratio of pinch-distance to hand-size
// (distance from wrist to middle-finger MCP), so they stay stable regardless of
// how close the user is standing to the camera.
export const PINCH_ENTER_RATIO = 0.35; // start drawing when pinch closes below this
export const PINCH_EXIT_RATIO = 0.5; // stop drawing when pinch opens above this (hysteresis)
export const PINCH_DEBOUNCE_MS = 60; // minimum time a state must hold before it "sticks"

// Fingertip position smoothing (exponential moving average). Lower = smoother/laggier.
export const SMOOTHING_ALPHA = 0.45;

// How long the hand can be missing before we treat the pen as lifted & hand as lost.
export const HAND_LOST_TIMEOUT_MS = 350;

export const COLORS = [
    { name: "white", value: "#f5f7fa" },
    { name: "red", value: "#f87171" },
    { name: "blue", value: "#60a5fa" },
    { name: "green", value: "#4ade80" },
    { name: "yellow", value: "#facc15" },
];

export const BRUSH_SIZES = {
    small: 3,
    medium: 6,
    large: 11,
};

export const ERASER_SIZE = 34;

// Strokes disappear on their own so the board never gets cluttered — each
// stroke lives for STROKE_TTL_MS after it's drawn, fading out over the final
// STROKE_FADE_MS of that lifetime.
export const STROKE_TTL_MS = 10000;
export const STROKE_FADE_MS = 1500;
