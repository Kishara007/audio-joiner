import { Mp3Encoder } from '@breezystack/lamejs';
import type { ExportWorkerRequest, ExportWorkerResponse } from '../lib/audio/types';

const MP3_BITRATE_KBPS = 192;
const MP3_CHUNK_SAMPLES = 1152 * 32;
const WAV_CHUNK_SAMPLES = 65536;

function floatToInt16Sample(sample: number): number {
  const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
  return clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function postProgress(percent: number): void {
  const msg: ExportWorkerResponse = {
    type: 'progress',
    percent: Math.min(100, Math.max(0, Math.round(percent))),
  };
  self.postMessage(msg);
}

function encodeWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number
): ArrayBuffer {
  const totalSamples = left.length;
  const numChannels = 2;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = totalSamples * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let writeOffset = 44;
  let lastReported = -1;

  for (let start = 0; start < totalSamples; start += WAV_CHUNK_SAMPLES) {
    const end = Math.min(totalSamples, start + WAV_CHUNK_SAMPLES);
    for (let i = start; i < end; i++) {
      view.setInt16(writeOffset, floatToInt16Sample(left[i] ?? 0), true);
      view.setInt16(writeOffset + 2, floatToInt16Sample(right[i] ?? 0), true);
      writeOffset += 4;
    }

    const pct = Math.round((end / totalSamples) * 100);
    if (pct !== lastReported) {
      lastReported = pct;
      postProgress(pct);
    }
  }

  return buffer;
}

function encodeMp3(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number
): ArrayBuffer {
  const encoder = new Mp3Encoder(2, sampleRate, MP3_BITRATE_KBPS);
  const totalSamples = left.length;
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  const leftInt16 = new Int16Array(MP3_CHUNK_SAMPLES);
  const rightInt16 = new Int16Array(MP3_CHUNK_SAMPLES);
  let lastReported = -1;

  for (let start = 0; start < totalSamples; start += MP3_CHUNK_SAMPLES) {
    const chunkLen = Math.min(MP3_CHUNK_SAMPLES, totalSamples - start);
    for (let i = 0; i < chunkLen; i++) {
      leftInt16[i] = floatToInt16Sample(left[start + i] ?? 0);
      rightInt16[i] = floatToInt16Sample(right[start + i] ?? 0);
    }

    const leftSlice =
      chunkLen === MP3_CHUNK_SAMPLES ? leftInt16 : leftInt16.subarray(0, chunkLen);
    const rightSlice =
      chunkLen === MP3_CHUNK_SAMPLES ? rightInt16 : rightInt16.subarray(0, chunkLen);

    const encoded = encoder.encodeBuffer(leftSlice, rightSlice);
    if (encoded.length > 0) {
      const copy = new Uint8Array(encoded);
      chunks.push(copy);
      totalBytes += copy.byteLength;
    }

    const pct = Math.round(((start + chunkLen) / totalSamples) * 98);
    if (pct !== lastReported) {
      lastReported = pct;
      postProgress(pct);
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    const copy = new Uint8Array(flushed);
    chunks.push(copy);
    totalBytes += copy.byteLength;
  }

  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  postProgress(100);
  return output.buffer;
}

self.onmessage = (event: MessageEvent<ExportWorkerRequest>) => {
  try {
    const { format, sampleRate, left, right } = event.data;
    if (format === 'wav') {
      const buffer = encodeWav(left, right, sampleRate);
      const response: ExportWorkerResponse = {
        type: 'done',
        buffer,
        mimeType: 'audio/wav',
      };
      self.postMessage(response, { transfer: [buffer] });
      return;
    }

    const buffer = encodeMp3(left, right, sampleRate);
    const response: ExportWorkerResponse = {
      type: 'done',
      buffer,
      mimeType: 'audio/mpeg',
    };
    self.postMessage(response, { transfer: [buffer] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Audio export failed in worker.';
    const response: ExportWorkerResponse = { type: 'error', message };
    self.postMessage(response);
  }
};
