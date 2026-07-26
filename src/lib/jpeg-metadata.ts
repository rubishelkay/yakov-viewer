const markerStart = 0xff;
const startOfImage = 0xd8;
const startOfScan = 0xda;
const endOfImage = 0xd9;
const commentMarker = 0xfe;

export type PublicJpegInspection = {
  orientation?: number;
  unsafeSegments: string[];
};

export type SanitizedPublicJpeg = PublicJpegInspection & {
  bytes: Uint8Array;
};

export class JpegMetadataError extends Error {}

export function inspectPublicJpeg(bytes: Uint8Array): PublicJpegInspection {
  const result = walkJpeg(bytes, false);
  return {
    orientation: result.orientation,
    unsafeSegments: Array.from(result.unsafeSegments)
  };
}

export function sanitizePublicJpeg(bytes: Uint8Array): SanitizedPublicJpeg {
  const result = walkJpeg(bytes, true);
  return {
    bytes: concatenate(result.chunks),
    orientation: result.orientation,
    unsafeSegments: Array.from(result.unsafeSegments)
  };
}

function walkJpeg(bytes: Uint8Array, sanitize: boolean) {
  assertJpegSignature(bytes);

  const chunks: Uint8Array[] = [bytes.subarray(0, 2)];
  const unsafeSegments = new Set<string>();
  let cursor = 2;
  let orientation: number | undefined;

  while (cursor < bytes.length) {
    const segmentStart = cursor;
    if (bytes[cursor] !== markerStart) {
      throw new JpegMetadataError("Invalid JPEG marker sequence.");
    }

    while (cursor < bytes.length && bytes[cursor] === markerStart) cursor += 1;
    if (cursor >= bytes.length) throw new JpegMetadataError("Truncated JPEG marker.");

    const marker = bytes[cursor];
    cursor += 1;

    if (marker === startOfScan) {
      chunks.push(bytes.subarray(segmentStart));
      return { chunks, orientation, unsafeSegments };
    }

    if (marker === endOfImage) {
      chunks.push(bytes.subarray(segmentStart));
      return { chunks, orientation, unsafeSegments };
    }

    if (isStandaloneMarker(marker)) {
      chunks.push(bytes.subarray(segmentStart, cursor));
      continue;
    }

    if (cursor + 2 > bytes.length) throw new JpegMetadataError("Truncated JPEG segment.");
    const length = readUint16(bytes, cursor, false);
    if (length < 2) throw new JpegMetadataError("Invalid JPEG segment length.");
    const segmentEnd = cursor + length;
    if (segmentEnd > bytes.length) throw new JpegMetadataError("JPEG segment exceeds file length.");

    const payloadStart = cursor + 2;
    const payload = bytes.subarray(payloadStart, segmentEnd);
    if (marker === 0xe1 && orientation === undefined) {
      orientation = readExifOrientation(payload);
    }

    const unsafe = isUnsafeMetadataSegment(marker, payload);
    if (unsafe) unsafeSegments.add(markerLabel(marker));
    if (!sanitize || !unsafe) chunks.push(bytes.subarray(segmentStart, segmentEnd));
    cursor = segmentEnd;
  }

  throw new JpegMetadataError("JPEG has no scan or end marker.");
}

function assertJpegSignature(bytes: Uint8Array) {
  if (
    bytes.length < 4 ||
    bytes[0] !== markerStart ||
    bytes[1] !== startOfImage ||
    bytes[2] !== markerStart
  ) {
    throw new JpegMetadataError("Invalid JPEG signature.");
  }
}

function isStandaloneMarker(marker: number) {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8);
}

function isUnsafeMetadataSegment(marker: number, payload: Uint8Array) {
  if (marker === commentMarker) return true;
  if (marker < 0xe0 || marker > 0xef) return false;

  if (marker === 0xe0) {
    return !startsWithAscii(payload, "JFIF\u0000") && !startsWithAscii(payload, "JFXX\u0000");
  }
  if (marker === 0xe2) return !startsWithAscii(payload, "ICC_PROFILE\u0000");
  if (marker === 0xee) return !startsWithAscii(payload, "Adobe");
  return true;
}

function markerLabel(marker: number) {
  if (marker === commentMarker) return "COM";
  if (marker >= 0xe0 && marker <= 0xef) return `APP${marker - 0xe0}`;
  return `0x${marker.toString(16).padStart(2, "0")}`;
}

function readExifOrientation(payload: Uint8Array) {
  if (!startsWithAscii(payload, "Exif\u0000\u0000")) return undefined;
  const tiffStart = 6;
  if (payload.length < tiffStart + 8) return undefined;

  const littleEndian = payload[tiffStart] === 0x49 && payload[tiffStart + 1] === 0x49;
  const bigEndian = payload[tiffStart] === 0x4d && payload[tiffStart + 1] === 0x4d;
  if (!littleEndian && !bigEndian) return undefined;
  if (readUint16(payload, tiffStart + 2, littleEndian) !== 42) return undefined;

  const firstIfdOffset = readUint32(payload, tiffStart + 4, littleEndian);
  const ifdStart = tiffStart + firstIfdOffset;
  if (ifdStart + 2 > payload.length) return undefined;
  const entryCount = readUint16(payload, ifdStart, littleEndian);

  for (let index = 0; index < entryCount; index += 1) {
    const entry = ifdStart + 2 + index * 12;
    if (entry + 12 > payload.length) return undefined;
    const tag = readUint16(payload, entry, littleEndian);
    if (tag !== 0x0112) continue;
    const type = readUint16(payload, entry + 2, littleEndian);
    const count = readUint32(payload, entry + 4, littleEndian);
    if (type !== 3 || count < 1) return undefined;
    const value = readUint16(payload, entry + 8, littleEndian);
    return value >= 1 && value <= 8 ? value : undefined;
  }

  return undefined;
}

function readUint16(bytes: Uint8Array, offset: number, littleEndian: boolean) {
  if (offset + 2 > bytes.length) throw new JpegMetadataError("Truncated JPEG metadata.");
  return littleEndian
    ? bytes[offset] | (bytes[offset + 1] << 8)
    : (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number, littleEndian: boolean) {
  if (offset + 4 > bytes.length) throw new JpegMetadataError("Truncated JPEG metadata.");
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
  return view.getUint32(0, littleEndian);
}

function startsWithAscii(bytes: Uint8Array, value: string) {
  if (bytes.length < value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function concatenate(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
