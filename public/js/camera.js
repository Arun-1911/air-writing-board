// Webcam acquisition and lifecycle. Emits friendly errors for the common
// failure modes (denied permission, no device, device busy).

export async function startWebcam(videoEl) {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser doesn't support camera access. Try Chrome or Edge.");
    }

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: "user" },
            audio: false,
        });
    } catch (err) {
        throw new Error(mapCameraError(err));
    }

    videoEl.srcObject = stream;
    await new Promise((resolve) => {
        videoEl.onloadedmetadata = resolve;
    });
    await videoEl.play();
    return stream;
}

export function stopWebcam(videoEl) {
    const stream = videoEl.srcObject;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    videoEl.srcObject = null;
}

function mapCameraError(err) {
    switch (err.name) {
        case "NotAllowedError":
        case "SecurityError":
            return "Camera access was denied. Allow camera permission in your browser and reload.";
        case "NotFoundError":
        case "OverconstrainedError":
            return "No camera was found on this device.";
        case "NotReadableError":
            return "The camera is already in use by another application.";
        default:
            return "Couldn't access the camera. " + (err.message || "");
    }
}
