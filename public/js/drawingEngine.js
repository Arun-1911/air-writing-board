// Stroke storage and rendering. Points are stored in normalized [0,1] board
// coordinates (already mirrored to match the on-screen preview) so strokes
// stay correctly placed if the window/canvas is resized. Brush width is
// stored as a fraction of canvas width for the same reason.
//
// Each stroke is rendered as a single quadratic-curve path through the
// midpoints of consecutive points, which is the standard trick for turning a
// polyline of noisy samples into a smooth, handwriting-like line.
//
// Strokes are transient: each carries a createdAt timestamp and fades out
// STROKE_FADE_MS before hitting STROKE_TTL_MS, at which point render() drops
// it for good so the board never gets cluttered.

import { STROKE_TTL_MS, STROKE_FADE_MS } from "./config.js";

const REFERENCE_WIDTH = 1280;

export class DrawingEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.strokes = [];
        this.redoStack = [];
        this.activeStroke = null;
    }

    beginStroke(color, sizePx, isEraser, now = performance.now()) {
        this.activeStroke = {
            points: [],
            color,
            width: sizePx / REFERENCE_WIDTH,
            isEraser: !!isEraser,
            createdAt: now,
        };
        this.strokes.push(this.activeStroke);
        this.redoStack = [];
    }

    addPoint(xNorm, yNorm) {
        if (!this.activeStroke) return;
        this.activeStroke.points.push({ x: xNorm, y: yNorm });
    }

    endStroke(now = performance.now()) {
        if (this.activeStroke && this.activeStroke.points.length === 0) {
            // Pinch tapped without moving; drop the empty stroke.
            this.strokes.pop();
        } else if (this.activeStroke) {
            // Lifetime starts when the stroke is finished, not when it began,
            // so a slow signature doesn't start fading while still being drawn.
            this.activeStroke.createdAt = now;
        }
        this.activeStroke = null;
    }

    undo() {
        if (this.strokes.length === 0) return;
        this.redoStack.push(this.strokes.pop());
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const stroke = this.redoStack.pop();
        stroke.createdAt = performance.now(); // give it a fresh lifetime
        this.strokes.push(stroke);
    }

    clear() {
        if (this.strokes.length === 0) return;
        this.strokes = [];
        this.redoStack = [];
        this.activeStroke = null;
    }

    hasContent() {
        return this.strokes.length > 0;
    }

    /** Returns true if any stroke is still alive (used to decide whether to keep animating). */
    render(now = performance.now()) {
        const { ctx, canvas } = this;

        if (this.strokes.length > 0) {
            this.strokes = this.strokes.filter(
                (s) => s === this.activeStroke || now - s.createdAt < STROKE_TTL_MS
            );
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        let stillFading = false;
        for (const stroke of this.strokes) {
            const opacity = this._renderStroke(stroke, now);
            if (opacity < 1) stillFading = true;
        }
        return stillFading;
    }

    _renderStroke(stroke, now) {
        const { ctx, canvas } = this;
        const pts = stroke.points;
        if (pts.length === 0) return 1;

        let opacity = 1;
        if (stroke !== this.activeStroke) {
            const age = now - stroke.createdAt;
            const remaining = STROKE_TTL_MS - age;
            if (remaining < STROKE_FADE_MS) {
                opacity = Math.max(0, remaining / STROKE_FADE_MS);
            }
        }
        ctx.globalAlpha = opacity;

        ctx.globalCompositeOperation = stroke.isEraser ? "destination-out" : "source-over";
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = Math.max(1, stroke.width * canvas.width);

        if (!stroke.isEraser) {
            ctx.shadowColor = stroke.color;
            ctx.shadowBlur = 6;
        } else {
            ctx.shadowBlur = 0;
        }

        if (pts.length === 1) {
            const p = toPx(pts[0], canvas);
            ctx.beginPath();
            ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
            ctx.fillStyle = stroke.color;
            ctx.fill();
        } else {
            ctx.beginPath();
            let prev = toPx(pts[0], canvas);
            ctx.moveTo(prev.x, prev.y);
            for (let i = 1; i < pts.length; i++) {
                const curr = toPx(pts[i], canvas);
                const mid = { x: (prev.x + curr.x) / 2, y: (prev.y + curr.y) / 2 };
                ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
                prev = curr;
            }
            ctx.lineTo(prev.x, prev.y);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        return opacity;
    }

    /** Composite the given video frame under the current strokes and trigger a PNG download. */
    exportPNG(videoEl, filename = "air-writing-board.png") {
        const out = document.createElement("canvas");
        out.width = this.canvas.width;
        out.height = this.canvas.height;
        const octx = out.getContext("2d");

        if (videoEl && videoEl.videoWidth) {
            octx.save();
            octx.translate(out.width, 0);
            octx.scale(-1, 1);
            octx.drawImage(videoEl, 0, 0, out.width, out.height);
            octx.restore();
        } else {
            octx.fillStyle = "#0b0f14";
            octx.fillRect(0, 0, out.width, out.height);
        }

        octx.drawImage(this.canvas, 0, 0);

        out.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }, "image/png");
    }
}

function toPx(pt, canvas) {
    return { x: pt.x * canvas.width, y: pt.y * canvas.height };
}
