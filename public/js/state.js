// Central mutable app state with a tiny pub-sub so UI modules can react to changes
// without every module needing direct references to each other.

import { COLORS, BRUSH_SIZES } from "./config.js";

const listeners = new Set();

export const state = {
    cameraStatus: "init", // init | ready | error
    handDetected: false,
    isDrawing: false, // pinch currently engaged
    tool: "pen", // pen | eraser
    color: COLORS[0].value,
    brushSize: BRUSH_SIZES.medium,
    debugMode: false,
    showVideo: true,
};

export function setState(patch) {
    Object.assign(state, patch);
    for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
