import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectPublicJpeg,
  JpegMetadataError,
  sanitizePublicJpeg
} from "@/lib/jpeg-metadata";

test("public JPEG sanitizer strips private metadata without touching ICC or scan bytes", () => {
  const scan = new Uint8Array([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0x00, 0x33, 0xff, 0xd9]);
  const jpeg = join(
    new Uint8Array([0xff, 0xd8]),
    segment(0xe0, ascii("JFIF\u0000")),
    segment(0xe1, exifWithOrientation(6)),
    segment(0xe1, ascii("http://ns.adobe.com/xap/1.0/\u0000private")),
    segment(0xe2, ascii("ICC_PROFILE\u0000profile")),
    segment(0xed, ascii("Photoshop 3.0\u0000location")),
    segment(0xee, ascii("Adobe")),
    segment(0xfe, ascii("private comment")),
    scan
  );

  const before = inspectPublicJpeg(jpeg);
  assert.equal(before.orientation, 6);
  assert.deepEqual(before.unsafeSegments, ["APP1", "APP13", "COM"]);

  const sanitized = sanitizePublicJpeg(jpeg);
  assert.equal(sanitized.orientation, 6);
  assert.deepEqual(inspectPublicJpeg(sanitized.bytes).unsafeSegments, []);
  assert.equal(includesAscii(sanitized.bytes, "ICC_PROFILE\u0000profile"), true);
  assert.equal(includesAscii(sanitized.bytes, "Adobe"), true);
  assert.equal(includesAscii(sanitized.bytes, "private comment"), false);
  assert.deepEqual(sanitized.bytes.slice(-scan.length), scan);
});

test("public JPEG inspection rejects malformed segment lengths", () => {
  const malformed = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x20, 0x01]);
  assert.throws(() => inspectPublicJpeg(malformed), JpegMetadataError);
});

function segment(marker: number, payload: Uint8Array) {
  const length = payload.length + 2;
  return join(
    new Uint8Array([0xff, marker, length >> 8, length & 0xff]),
    payload
  );
}

function exifWithOrientation(orientation: number) {
  return new Uint8Array([
    ...ascii("Exif\u0000\u0000"),
    0x49, 0x49,
    0x2a, 0x00,
    0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01,
    0x03, 0x00,
    0x01, 0x00, 0x00, 0x00,
    orientation, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00
  ]);
}

function ascii(value: string) {
  return new Uint8Array(Array.from(value, (character) => character.charCodeAt(0)));
}

function includesAscii(bytes: Uint8Array, value: string) {
  const needle = ascii(value);
  return bytes.some((_, index) =>
    index + needle.length <= bytes.length &&
    needle.every((byte, needleIndex) => bytes[index + needleIndex] === byte)
  );
}

function join(...chunks: Uint8Array[]) {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
