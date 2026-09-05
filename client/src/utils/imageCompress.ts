const MAX_IMAGE_BYTES = 50 * 1024;
const MAX_DIMENSION = 640;

export class ImageProcessingError extends Error {}

function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Reads an image file, draws it to a canvas, and re-encodes it as JPEG —
 * shrinking quality and then dimensions — until the result is at or under
 * `maxBytes`. Returns a ready-to-store `data:image/jpeg;base64,...` URI.
 * Rejects with ImageProcessingError for anything that isn't a readable image,
 * or that genuinely can't be brought under the limit.
 */
export function compressImageFile(file: File, maxBytes = MAX_IMAGE_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new ImageProcessingError("Please choose an image file (JPEG, PNG, or WebP)."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new ImageProcessingError("Couldn't read the selected file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new ImageProcessingError("This doesn't look like a valid image file."));
      img.onload = () => {
        try {
          resolve(shrinkToLimit(img, img.naturalWidth || img.width, img.naturalHeight || img.height, maxBytes));
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Same compression pipeline as compressImageFile, but for a single frame
 * grabbed straight off a live `<video>` camera preview (see PhotoCapture) —
 * no File/FileReader round-trip needed since the frame is already decoded.
 */
export function compressVideoFrame(video: HTMLVideoElement, maxBytes = MAX_IMAGE_BYTES): string {
  return shrinkToLimit(video, video.videoWidth, video.videoHeight, maxBytes);
}

function shrinkToLimit(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxBytes: number
): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageProcessingError("Image processing isn't supported in this browser.");

  let width = sourceWidth;
  let height = sourceHeight;
  if (width <= 0 || height <= 0) {
    throw new ImageProcessingError("This doesn't look like a valid image file.");
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  // Shrink dimensions in a few passes; at each size, step quality down until
  // it fits. Reasonable photos fit within the first pass or two.
  for (let pass = 0; pass < 6; pass++) {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    for (let quality = 0.85; quality >= 0.2; quality -= 0.15) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlByteSize(dataUrl) <= maxBytes) return dataUrl;
    }

    width = Math.round(width * 0.7);
    height = Math.round(height * 0.7);
    if (width < 40 || height < 40) break;
  }

  throw new ImageProcessingError(`Couldn't compress this image below ${Math.round(maxBytes / 1024)}KB — try a different photo.`);
}
