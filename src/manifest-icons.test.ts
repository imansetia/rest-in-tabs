// The extension icon (design steering file, Extension icon): every icon the
// manifest names exists under public/, and each PNG's size (from its IHDR
// chunk) matches the key it is listed under.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const publicDir = new URL('../public/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', publicDir), 'utf8')) as {
  icons?: Record<string, string>;
  action?: { default_icon?: Record<string, string> };
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from a PNG's IHDR chunk, which always comes first. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect([...bytes.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  expect(bytes.toString('ascii', 12, 16)).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const lists: Array<[string, Record<string, string> | undefined]> = [
  ['icons', manifest.icons],
  ['action.default_icon', manifest.action?.default_icon],
];

describe('manifest icons', () => {
  it('lists 16, 32, 48 and 128 in "icons", and 16 and 32 in action.default_icon', () => {
    expect(Object.keys(manifest.icons ?? {}).sort((a, b) => +a - +b)).toEqual(['16', '32', '48', '128']);
    expect(Object.keys(manifest.action?.default_icon ?? {}).sort((a, b) => +a - +b)).toEqual(['16', '32']);
  });

  for (const [name, icons] of lists) {
    for (const [key, path] of Object.entries(icons ?? {})) {
      it(`${name}["${key}"] = ${path} exists under public/ and is ${key} × ${key}`, () => {
        const file = new URL(path, publicDir);
        expect(existsSync(file)).toBe(true);
        expect(pngSize(readFileSync(file))).toEqual({ width: Number(key), height: Number(key) });
      });
    }
  }
});
