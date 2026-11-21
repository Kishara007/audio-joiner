import { computeTimelineSegments } from './timeline';
import type { AudioTrack } from './types';

const DEFAULT_OUTPUT_SAMPLE_RATE = 44100;
const CURVE_POINTS = 128;

export function createEqualPowerCurve(
  direction: 'in' | 'out',
  startProgress = 0,
  points = CURVE_POINTS
): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(points * 4));
  const clampedStart = Math.max(0, Math.min(1, startProgress));
  for (let i = 0; i < points; i++) {
    const u = clampedStart + ((1 - clampedStart) * i) / (points - 1);
    curve[i] =
      direction === 'in'
        ? Math.sin(u * (Math.PI / 2))
        : Math.cos(u * (Math.PI / 2));
  }
  return curve;
}

/**
 * Renders all trimmed tracks and equal-power crossfades offline into a unified stereo AudioBuffer.
 */
export async function renderMergedAudio(
  tracks: AudioTrack[],
  sampleRate = DEFAULT_OUTPUT_SAMPLE_RATE
): Promise<AudioBuffer> {
  if (tracks.length === 0) {
    throw new Error('No tracks provided to render.');
  }

  const plan = computeTimelineSegments(tracks);
  const totalSamples = Math.max(1, Math.ceil(plan.totalDuration * sampleRate));
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  for (const seg of plan.segments) {
    const track = tracks[seg.index];
    if (!track) continue;

    const source = offlineCtx.createBufferSource();
    source.buffer = track.buffer;

    const gainNode = offlineCtx.createGain();
    gainNode.gain.setValueAtTime(1, seg.startOffset);

    const fadeInEnd = seg.startOffset + seg.fadeIn;
    const fadeOutStart = seg.endOffset - seg.fadeOut;

    if (seg.fadeIn >= 0.01 && fadeInEnd < fadeOutStart - 0.001) {
      gainNode.gain.setValueCurveAtTime(
        createEqualPowerCurve('in'),
        seg.startOffset,
        seg.fadeIn
      );
    }

    if (seg.fadeOut >= 0.01 && fadeOutStart > fadeInEnd + 0.001) {
      gainNode.gain.setValueAtTime(1, fadeOutStart);
      gainNode.gain.setValueCurveAtTime(
        createEqualPowerCurve('out'),
        fadeOutStart,
        seg.fadeOut
      );
    }

    source.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
    source.start(seg.startOffset, track.trimStart, seg.trimmedDuration);
  }

  return await offlineCtx.startRendering();
}
