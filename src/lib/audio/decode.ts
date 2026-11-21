import type { AudioTrack } from './types';

const ACCEPTED_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'wave',
  'ogg',
  'oga',
  'm4a',
  'aac',
  'flac',
  'opus',
  'webm',
]);

const WAVEFORM_BINS = 240;

export function isSupportedAudioFile(file: File): boolean {
  if (file.type && file.type.startsWith('audio/')) {
    return true;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ACCEPTED_EXTENSIONS.has(ext);
}

/**
 * Extracts normalized mono peak amplitudes for waveform visualization.
 */
export function computeWaveformPeaks(buffer: AudioBuffer, binCount = WAVEFORM_BINS): Float32Array {
  const peaks = new Float32Array(binCount);
  const channels = buffer.numberOfChannels;
  const totalLength = buffer.length;

  if (channels === 0 || totalLength === 0) {
    return peaks;
  }

  const channelArrays: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    channelArrays.push(buffer.getChannelData(c));
  }

  const samplesPerBin = Math.max(1, Math.floor(totalLength / binCount));
  // Stride sampling inside very large bins keeps decoding instantaneous on 1-hour tracks.
  const stride = Math.max(1, Math.floor(samplesPerBin / 64));
  let globalMax = 0;

  for (let b = 0; b < binCount; b++) {
    const start = Math.floor((b * totalLength) / binCount);
    const end = Math.min(totalLength, Math.floor(((b + 1) * totalLength) / binCount));
    let binMax = 0;

    for (let i = start; i < end; i += stride) {
      let sumAbs = 0;
      for (let c = 0; c < channels; c++) {
        sumAbs += Math.abs(channelArrays[c]![i] ?? 0);
      }
      const avgAbs = sumAbs / channels;
      if (avgAbs > binMax) {
        binMax = avgAbs;
      }
    }

    peaks[b] = binMax;
    if (binMax > globalMax) {
      globalMax = binMax;
    }
  }

  if (globalMax > 0.0001) {
    const scale = 1 / globalMax;
    for (let b = 0; b < binCount; b++) {
      peaks[b] = Math.min(1, (peaks[b] ?? 0) * scale);
    }
  }

  return peaks;
}

/**
 * Decodes an audio File purely in-browser via Web Audio API.
 */
export async function decodeAudioTrack(
  file: File,
  audioContext: AudioContext
): Promise<AudioTrack> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(arrayBuffer);

  if (!buffer || buffer.duration <= 0 || buffer.length === 0) {
    throw new Error(`Decoded audio buffer is empty for ${file.name}`);
  }

  const peaks = computeWaveformPeaks(buffer);
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    name: file.name,
    fileSize: file.size,
    mimeType: file.type || 'audio/mpeg',
    buffer,
    duration: buffer.duration,
    trimStart: 0,
    trimEnd: buffer.duration,
    crossfade: false,
    peaks,
  };
}
