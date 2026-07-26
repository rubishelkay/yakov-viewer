"use client";

import { sanitizePublicJpeg } from "@/lib/jpeg-metadata";

export type BrowserJpegDerivative = {
  blob: Blob;
  colorProfile: "preserve" | "srgb";
  height: number;
  width: number;
};

export type PreparedJpegUpload = {
  display: BrowserJpegDerivative;
  expanded: BrowserJpegDerivative;
  height: number;
  thumb: BrowserJpegDerivative;
  width: number;
};

const thumbTarget = { maxBytes: 300 * 1024, maxDimension: 640, quality: 0.82 };
const displayTarget = { maxBytes: 1.2 * 1024 * 1024, maxDimension: 2000, quality: 0.9 };
const expandedTarget = { maxBytes: 20 * 1024 * 1024, quality: 0.96 };

export async function prepareJpegUpload(file: File): Promise<PreparedJpegUpload> {
  if (file.type !== "image/jpeg" && !/\.jpe?g$/i.test(file.name)) {
    throw new Error("Only JPEG files are supported.");
  }

  const sanitized = sanitizePublicJpeg(new Uint8Array(await file.arrayBuffer()));
  const decoded = await decodeImage(file);
  try {
    const [thumb, display, expanded] = await Promise.all([
      createDerivative(decoded.image, decoded.width, decoded.height, thumbTarget),
      createDerivative(decoded.image, decoded.width, decoded.height, displayTarget),
      sanitized.orientation && sanitized.orientation !== 1
        ? createDerivative(decoded.image, decoded.width, decoded.height, {
            ...expandedTarget,
            maxDimension: Math.max(decoded.width, decoded.height)
          })
        : Promise.resolve({
            blob: new Blob([sanitized.bytes.slice().buffer], { type: "image/jpeg" }),
            colorProfile: "preserve" as const,
            height: decoded.height,
            width: decoded.width
          })
    ]);

    return { display, expanded, height: decoded.height, thumb, width: decoded.width };
  } finally {
    decoded.dispose();
  }
}

async function createDerivative(
  image: HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  target: { maxBytes: number; maxDimension: number; quality: number }
): Promise<BrowserJpegDerivative> {
  let maxDimension = Math.min(target.maxDimension, Math.max(sourceWidth, sourceHeight));
  let fallback: BrowserJpegDerivative | undefined;

  for (let sizeAttempt = 0; sizeAttempt < 4; sizeAttempt += 1) {
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser cannot prepare JPEG previews.");
    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualitySteps(target.quality)) {
      const blob = await canvasToJpeg(canvas, quality);
      fallback = { blob, colorProfile: "srgb", height, width };
      if (blob.size <= target.maxBytes) return fallback;
    }

    maxDimension = Math.max(480, Math.round(maxDimension * 0.86));
  }

  if (!fallback) throw new Error("Unable to encode JPEG preview.");
  return fallback;
}

function qualitySteps(start: number) {
  return [start, 0.84, 0.78, 0.72, 0.66, 0.6]
    .filter((quality, index, values) => quality <= start && values.indexOf(quality) === index);
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to encode JPEG preview."));
    }, "image/jpeg", quality);
  });
}

async function decodeImage(file: File) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;

  try {
    try {
      await image.decode();
    } catch {
      await waitForImage(image);
    }

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error(`Unable to decode ${file.name}.`);
    }

    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(url)
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function waitForImage(image: HTMLImageElement) {
  return new Promise<void>((resolve, reject) => {
    if (image.complete) {
      if (image.naturalWidth) resolve();
      else reject(new Error("Unable to decode JPEG."));
      return;
    }
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => reject(new Error("Unable to decode JPEG.")), { once: true });
  });
}
