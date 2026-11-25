import test from 'node:test';
import assert from 'node:assert/strict';
import {WebGpuElectrostatics} from '../src/emergence/gpu-physics.js';

test('WebGPU electrostatics degrades cleanly when compute is unavailable', async () => {
  const original = globalThis.navigator;
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    assert.equal(await WebGpuElectrostatics.create(), null);
  } finally {
    if (original === undefined) delete globalThis.navigator;
    else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original });
  }
});
