// Loads the MediaPipe HandLandmarker and runs per-frame detection.
// Single-hand tracking only: MediaPipe already returns landmarks ordered by
// detection confidence, and capping numHands at 1 means the tracked hand
// never randomly swaps mid-session.

import {
    FilesetResolver,
    HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
import { WASM_URL, HAND_MODEL_URL } from "./config.js";

let handLandmarker = null;

export async function loadHandTracking() {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    try {
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.6,
            minHandPresenceConfidence: 0.6,
            minTrackingConfidence: 0.6,
        });
    } catch (err) {
        console.warn("GPU delegate unavailable for HandLandmarker, falling back to CPU.", err);
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "CPU" },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.6,
            minHandPresenceConfidence: 0.6,
            minTrackingConfidence: 0.6,
        });
    }
    return handLandmarker;
}

/** Returns the first detected hand's 21 landmarks (normalized 0-1), or null. */
export function detectHand(videoEl, timestampMs) {
    if (!handLandmarker) return null;
    const result = handLandmarker.detectForVideo(videoEl, timestampMs);
    if (!result.landmarks || result.landmarks.length === 0) return null;
    return result.landmarks[0];
}

export { HandLandmarker };
