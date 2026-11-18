// Protocol checks only: no server, GPU, photos or Hugging Face calls.
// From services/tryon: node --test tests/test_extension.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVER, MAX_IMAGE_BYTES, parseMode, parseResult, imageMime, readResultImage } from '../browser-extension/protocol.mjs';

const resultPath = `/results/${'a'.repeat(32)}.png`;
const payload = { resultImageUrl: `${SERVER}${resultPath}`, latencyMs: 2400 };
const pngHeader = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

test('accepts only the three explicit server modes', () => {
  for (const mode of ['local', 'huggingface', 'mock']) assert.equal(parseMode({ mode }), mode);
  for (const body of [null, {}, { mode: 'ready' }]) assert.throws(() => parseMode(body));
});

test('accepts an exported local image and preserves latency', () => {
  const result = parseResult(payload);
  assert.equal(result.url.href, payload.resultImageUrl);
  assert.equal(result.latencyMs, 2400);
});

test('rejects external, credentialled, alternate-port and non-result URLs', () => {
  for (const resultImageUrl of [
    `https://example.com${resultPath}`, `http://127.0.0.1:8001${resultPath}`,
    `http://localhost:8000${resultPath}`, `http://user:secret@127.0.0.1:8000${resultPath}`,
    `${SERVER}/tryon/upload`, `${SERVER}${resultPath}?download=true`,
    `${SERVER}${resultPath}#fragment`, `${SERVER}/results/not-an-id.png`,
    'data:image/png;base64,aGVsbG8=', 'file:///tmp/result.png', 'javascript:alert(1)',
  ]) assert.throws(() => parseResult({ ...payload, resultImageUrl }));
});

test('rejects incomplete or invalid generation responses', () => {
  for (const body of [null, {}, { ...payload, latencyMs: -1 }, { ...payload, latencyMs: '2400' },
    { ...payload, latencyMs: Infinity }, { ...payload, resultImageUrl: null }]) {
    assert.throws(() => parseResult(body));
  }
});

test('checks file signatures independently of filename and claimed type', async () => {
  assert.equal(await imageMime(new Blob([pngHeader], { type: 'text/plain' })), 'image/png');
  assert.equal(await imageMime(new Blob([new Uint8Array([255, 216, 255])])), 'image/jpeg');
  assert.equal(await imageMime(new Blob(['RIFF1234WEBP'])), 'image/webp');
  await assert.rejects(imageMime(new Blob(['<svg></svg>'], { type: 'image/png' })));
  await assert.rejects(imageMime(new Blob([])));
  await assert.rejects(imageMime(new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)])));
});

test('receives image bytes but refuses MIME mismatches and non-images', async () => {
  const image = await readResultImage(new Response(pngHeader, { headers: { 'Content-Type': 'image/png' } }));
  assert.equal(image.type, 'image/png');
  assert.equal(image.size, pngHeader.byteLength);
  await assert.rejects(readResultImage(new Response(pngHeader, { headers: { 'Content-Type': 'image/jpeg' } })));
  await assert.rejects(readResultImage(new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } })));
});

test('bounds the result size even without a Content-Length header', async () => {
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_IMAGE_BYTES));
      controller.enqueue(new Uint8Array([1]));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'image/png' } });
  await assert.rejects(readResultImage(response), /8 Mo/);
  await assert.rejects(readResultImage(new Response(pngHeader, {
    headers: { 'Content-Type': 'image/png', 'Content-Length': String(MAX_IMAGE_BYTES + 1) },
  })), /8 Mo/);
});
