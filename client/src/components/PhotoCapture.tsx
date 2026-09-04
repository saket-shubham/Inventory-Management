import { useEffect, useRef, useState } from "react";
import { Camera, TriangleAlert, X } from "lucide-react";
import { compressVideoFrame, ImageProcessingError } from "../utils/imageCompress";

interface PhotoCaptureProps {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

/**
 * A real live camera preview via getUserMedia — used instead of a plain
 * `<input type="file" capture>` because that attribute is only ever a hint;
 * several mobile browsers ignore it and open the gallery picker instead. This
 * opens the device camera directly, every time, matching the same approach
 * already used for barcode scanning (components/CameraScanner.tsx).
 */
export function PhotoCapture({ onCapture, onCancel }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't access the camera — check your browser's camera permission for this site.");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;
    try {
      const dataUrl = compressVideoFrame(video);
      onCapture(dataUrl);
    } catch (err) {
      setError(err instanceof ImageProcessingError ? err.message : "Couldn't capture a photo.");
    }
  }

  return (
    <div className="photo-capture">
      <div className="photo-capture-viewport">
        <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => setReady(true)} />
      </div>
      {error && (
        <p className="error-text small">
          <TriangleAlert size={12} /> {error}
        </p>
      )}
      <div className="photo-capture-actions">
        <button type="button" className="primary" disabled={!ready || !!error} onClick={handleCapture}>
          <Camera size={14} /> Capture
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  );
}
