// Wires up all DOM controls (toolbar, status panel, instructions, error UI)
// and keeps them in sync with app state. Contains no tracking/drawing logic.

import { COLORS, BRUSH_SIZES, ERASER_SIZE } from "./config.js";
import { state, setState, subscribe } from "./state.js";

const el = (id) => document.getElementById(id);

export function initUI({ engine, onStart, onRetryCamera }) {
    const dom = {
        loadingStatus: el("loadingStatus"),
        startBtn: el("startBtn"),
        cameraError: el("cameraError"),
        cameraErrorText: el("cameraErrorText"),
        retryCameraBtn: el("retryCameraBtn"),
        toolbar: el("toolbar"),
        instructions: el("instructions"),
        instructionText: el("instructionText"),
        statCamera: el("statCamera"),
        statHand: el("statHand"),
        statPen: el("statPen"),
        toastContainer: el("toastContainer"),
        loadingText: el("loadingText"),
        undoBtn: el("undoBtn"),
        redoBtn: el("redoBtn"),
        clearBtn: el("clearBtn"),
        penToolBtn: el("penToolBtn"),
        eraserToolBtn: el("eraserToolBtn"),
        colorGroup: el("colorGroup"),
        sizeGroup: el("sizeGroup"),
        toggleVideo: el("toggleVideo"),
        toggleDebug: el("toggleDebug"),
        saveBtn: el("saveBtn"),
        webcam: el("webcam"),
        debugCanvas: el("debugCanvas"),
    };

    // Color swatches
    for (const c of COLORS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "color-swatch" + (c.value === state.color ? " active" : "");
        btn.style.background = c.value;
        btn.title = c.name;
        btn.addEventListener("click", () => {
            setState({ color: c.value, tool: "pen" });
        });
        dom.colorGroup.appendChild(btn);
    }

    dom.startBtn.addEventListener("click", () => {
        dom.startBtn.disabled = true;
        dom.startBtn.textContent = "Starting…";
        onStart();
    });

    dom.retryCameraBtn.addEventListener("click", () => {
        dom.cameraError.hidden = true;
        onRetryCamera();
    });

    dom.undoBtn.addEventListener("click", () => {
        engine.undo();
        engine.render();
        toast(dom, "Undid last stroke");
        pulse(dom.undoBtn);
    });
    dom.redoBtn.addEventListener("click", () => {
        engine.redo();
        engine.render();
        toast(dom, "Stroke restored");
        pulse(dom.redoBtn);
    });
    dom.clearBtn.addEventListener("click", () => {
        engine.clear();
        engine.render();
        toast(dom, "Board cleared");
        pulse(dom.clearBtn);
    });

    dom.penToolBtn.addEventListener("click", () => setState({ tool: "pen" }));
    dom.eraserToolBtn.addEventListener("click", () => setState({ tool: "eraser" }));

    for (const btn of dom.sizeGroup.querySelectorAll(".size-btn")) {
        btn.addEventListener("click", () => {
            const key = btn.dataset.size;
            setState({ brushSize: BRUSH_SIZES[key] });
            for (const b of dom.sizeGroup.querySelectorAll(".size-btn")) b.classList.toggle("active", b === btn);
        });
    }

    dom.toggleVideo.addEventListener("change", () => {
        setState({ showVideo: dom.toggleVideo.checked });
    });

    dom.toggleDebug.addEventListener("change", () => {
        setState({ debugMode: dom.toggleDebug.checked });
        if (!dom.toggleDebug.checked) {
            const ctx = dom.debugCanvas.getContext("2d");
            ctx.clearRect(0, 0, dom.debugCanvas.width, dom.debugCanvas.height);
        }
    });

    dom.saveBtn.addEventListener("click", () => {
        engine.exportPNG(dom.webcam);
        toast(dom, "Saved as PNG");
        pulse(dom.saveBtn);
    });

    subscribe((s) => {
        dom.webcam.classList.toggle("hidden", !s.showVideo);

        setStatus(dom.statCamera, s.cameraStatus === "ready" ? "READY" : s.cameraStatus === "error" ? "ERROR" : "INIT",
            s.cameraStatus === "ready" ? "ok" : s.cameraStatus === "error" ? "error" : "pending");

        setStatus(dom.statHand, s.handDetected ? "DETECTED" : "SEARCHING", s.handDetected ? "ok" : "pending");

        setStatus(dom.statPen, s.isDrawing ? (s.tool === "eraser" ? "ERASING" : "DRAWING") : "READY",
            s.isDrawing ? "active" : "pending");

        dom.penToolBtn.classList.toggle("active", s.tool === "pen");
        dom.eraserToolBtn.classList.toggle("active", s.tool === "eraser");

        for (const btn of dom.colorGroup.querySelectorAll(".color-swatch")) {
            btn.classList.toggle("active", btn.title === COLORS.find((c) => c.value === s.color)?.name && s.tool === "pen");
        }
    });

    return dom;
}

function setStatus(el, text, kind) {
    el.querySelector(".status-text").textContent = text;
    el.className = "status-value " + kind;
}

let toastTimer = null;

export function toast(dom, message) {
    dom.toastContainer.textContent = message;
    dom.toastContainer.classList.remove("show");
    // Force reflow so re-triggering the animation restarts it even for the same message.
    void dom.toastContainer.offsetWidth;
    dom.toastContainer.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toastContainer.classList.remove("show"), 1800);
}

export function pulse(btn) {
    btn.classList.remove("pulse");
    void btn.offsetWidth;
    btn.classList.add("pulse");
}

export function showLoading(dom, message) {
    dom.loadingStatus.hidden = false;
    dom.loadingText.textContent = message;
}

export function hideLoading(dom) {
    dom.loadingStatus.hidden = true;
}

export function showCameraError(dom, message) {
    dom.cameraErrorText.textContent = message;
    dom.cameraError.hidden = false;
    dom.startBtn.classList.add("hidden");
}

export function enterActiveMode(dom) {
    dom.startBtn.classList.add("hidden");
    dom.toolbar.hidden = false;
}

let instructionStage = 0;
let instructionTimer = null;

export function advanceInstructions(dom, stage) {
    if (stage === instructionStage) return;
    instructionStage = stage;
    clearTimeout(instructionTimer);

    const messages = {
        1: "Raise your hand to begin",
        2: "Pinch thumb + index finger to draw",
        3: null,
    };

    const msg = messages[stage];
    if (msg == null) {
        dom.instructions.classList.add("hidden");
        return;
    }
    dom.instructions.classList.remove("hidden");
    dom.instructionText.textContent = msg;

    if (stage === 2) {
        instructionTimer = setTimeout(() => advanceInstructions(dom, 3), 6000);
    }
}

export function getEraserSizeForTool() {
    return ERASER_SIZE;
}
