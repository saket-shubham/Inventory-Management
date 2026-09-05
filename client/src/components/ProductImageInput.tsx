import { useRef, useState, type ChangeEvent } from "react";
import { Camera, TriangleAlert, Upload, X } from "lucide-react";
import { compressImageFile, ImageProcessingError } from "../utils/imageCompress";
import { PhotoCapture } from "./PhotoCapture";

interface ProductImageInputProps {
  imageUrl: string;
  imageData: string;
  onChangeUrl: (url: string) => void;
  onChangeData: (data: string) => void;
  compact?: boolean;
}

// Shared by the single Add/Edit product form and each Bulk Add row — either
// paste an Image URL, take a live photo (Camera), or pick an existing file
// (Upload) — all compressed to <=50KB client-side before being sent to the
// server. The three are mutually exclusive per product: setting one clears
// the others.
export function ProductImageInput({ imageUrl, imageData, onChangeUrl, onChangeData, compact }: ProductImageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so selecting the same file again still fires onChange
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      const compressed = await compressImageFile(file);
      onChangeData(compressed);
      onChangeUrl("");
    } catch (err) {
      setError(err instanceof ImageProcessingError ? err.message : "Couldn't process this image.");
    } finally {
      setProcessing(false);
    }
  }

  function handleCapture(dataUrl: string) {
    onChangeData(dataUrl);
    onChangeUrl("");
    setCameraOpen(false);
    setError(null);
  }

  function clearImage() {
    onChangeData("");
    onChangeUrl("");
    setError(null);
  }

  const preview = imageData || imageUrl;

  if (cameraOpen) {
    return <PhotoCapture onCapture={handleCapture} onCancel={() => setCameraOpen(false)} />;
  }

  return (
    <div className={`product-image-input${compact ? " compact" : ""}`}>
      {preview && (
        <div className="product-image-preview">
          <img src={preview} alt="Product" />
          <button type="button" className="link-button" onClick={clearImage}>
            <X size={12} /> {compact ? "" : "Remove"}
          </button>
        </div>
      )}
      <div className="product-image-controls">
        <input
          placeholder="Image URL"
          value={imageUrl}
          onChange={(e) => {
            onChangeUrl(e.target.value);
            if (e.target.value) onChangeData("");
          }}
        />
        <button type="button" className="link-button" onClick={() => setCameraOpen(true)}>
          <Camera size={13} /> Camera
        </button>
        <button type="button" className="link-button" disabled={processing} onClick={() => fileInputRef.current?.click()}>
          <Upload size={13} /> {processing ? "Processing..." : "Upload"}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>
      {error && (
        <p className="error-text small">
          <TriangleAlert size={12} /> {error}
        </p>
      )}
    </div>
  );
}
