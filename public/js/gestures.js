// Pinch (pen-down/pen-up) gesture detection and fingertip smoothing.
//
// Pinch distance is normalized against the hand's own size (wrist -> middle
// MCP) so the threshold behaves the same whether the user is close to or far
// from the camera. Hysteresis (a lower "enter" threshold and a higher "exit"
// threshold) plus a short debounce stop the pen state from flickering on
// tracking noise.

import {
    LANDMARK,
    PINCH_ENTER_RATIO,
    PINCH_EXIT_RATIO,
    PINCH_DEBOUNCE_MS,
    SMOOTHING_ALPHA,
} from "./config.js";

export class FingertipSmoother {
    constructor(alpha = SMOOTHING_ALPHA) {
        this.alpha = alpha;
        this.x = null;
        this.y = null;
    }

    reset() {
        this.x = null;
        this.y = null;
    }

    push(x, y) {
        if (this.x === null) {
            this.x = x;
            this.y = y;
        } else {
            this.x = this.alpha * x + (1 - this.alpha) * this.x;
            this.y = this.alpha * y + (1 - this.alpha) * this.y;
        }
        return { x: this.x, y: this.y };
    }
}

export class PinchDetector {
    constructor() {
        this.pinched = false;
        this.pendingSince = 0;
        this.pendingValue = null;
    }

    reset() {
        this.pinched = false;
        this.pendingSince = 0;
        this.pendingValue = null;
    }

    /** landmarks: normalized 21-point hand landmark array. Returns current pinched boolean. */
    update(landmarks, now) {
        const wrist = landmarks[LANDMARK.WRIST];
        const middleMcp = landmarks[LANDMARK.MIDDLE_MCP];
        const thumbTip = landmarks[LANDMARK.THUMB_TIP];
        const indexTip = landmarks[LANDMARK.INDEX_TIP];

        const handScale = dist(wrist, middleMcp) || 1e-4;
        const pinchRatio = dist(thumbTip, indexTip) / handScale;

        const rawPinched = this.pinched
            ? pinchRatio < PINCH_EXIT_RATIO
            : pinchRatio < PINCH_ENTER_RATIO;

        if (rawPinched !== this.pinched) {
            if (this.pendingValue !== rawPinched) {
                this.pendingValue = rawPinched;
                this.pendingSince = now;
            } else if (now - this.pendingSince >= PINCH_DEBOUNCE_MS) {
                this.pinched = rawPinched;
                this.pendingValue = null;
            }
        } else {
            this.pendingValue = null;
        }

        return this.pinched;
    }
}

function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}
