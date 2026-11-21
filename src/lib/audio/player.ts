import { createEqualPowerCurve } from './render';
import { computeTimelineSegments } from './timeline';
import type { AudioTrack } from './types';

export interface PlaybackCallbacks {
  onTimeUpdate: (timelinePosition: number) => void;
  onEnded: () => void;
}

/**
 * Coordinates real-time Web Audio API preview playback of the merged timeline.
 */
export class TimelinePlayer {
  private ctx: AudioContext | null = null;
  private activeNodes: AudioBufferSourceNode[] = [];
  private rafId: number | null = null;
  private playStartCtxTime = 0;
  private playStartOffset = 0;
  private totalDuration = 0;
  private isPlaying = false;
  private callbacks: PlaybackCallbacks | null = null;

  public async play(
    tracks: AudioTrack[],
    fromOffset: number,
    callbacks: PlaybackCallbacks,
    sharedContext?: AudioContext
  ): Promise<void> {
    this.stop(false);

    if (tracks.length === 0) return;

    const plan = computeTimelineSegments(tracks);
    if (plan.totalDuration <= 0) return;

    const clampedOffset = Math.max(0, Math.min(plan.totalDuration - 0.01, fromOffset));
    const ctx = sharedContext ?? this.ctx ?? new AudioContext();
    this.ctx = ctx;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const startTime = ctx.currentTime + 0.03;
    this.playStartCtxTime = startTime;
    this.playStartOffset = clampedOffset;
    this.totalDuration = plan.totalDuration;
    this.callbacks = callbacks;
    this.isPlaying = true;

    for (const seg of plan.segments) {
      if (seg.endOffset <= clampedOffset) continue;
      const track = tracks[seg.index];
      if (!track) continue;

      const source = ctx.createBufferSource();
      source.buffer = track.buffer;

      const gainNode = ctx.createGain();
      const skipped = Math.max(0, clampedOffset - seg.startOffset);
      const when = startTime + Math.max(0, seg.startOffset - clampedOffset);
      const sourceOffset = track.trimStart + skipped;
      const playDuration = Math.max(0.01, seg.trimmedDuration - skipped);

      const fadeInEnd = seg.startOffset + seg.fadeIn;
      const fadeOutStart = seg.endOffset - seg.fadeOut;

      // Schedule fade-in if playback hasn't passed the end of fade-in.
      if (seg.fadeIn >= 0.01 && clampedOffset < fadeInEnd - 0.005) {
        const progress = Math.max(0, (clampedOffset - seg.startOffset) / seg.fadeIn);
        const remainingFade = fadeInEnd - Math.max(seg.startOffset, clampedOffset);
        const curveStartWhen = when;
        if (remainingFade >= 0.01) {
          gainNode.gain.setValueCurveAtTime(
            createEqualPowerCurve('in', progress),
            curveStartWhen,
            remainingFade
          );
        } else {
          gainNode.gain.setValueAtTime(1, when);
        }
      } else if (seg.fadeOut >= 0.01 && clampedOffset >= fadeOutStart) {
        // Playback started directly inside the fade-out tail.
        const progress = Math.max(0, Math.min(1, (clampedOffset - fadeOutStart) / seg.fadeOut));
        const remainingFade = seg.endOffset - clampedOffset;
        if (remainingFade >= 0.01) {
          gainNode.gain.setValueCurveAtTime(
            createEqualPowerCurve('out', progress),
            when,
            remainingFade
          );
        } else {
          gainNode.gain.setValueAtTime(0, when);
        }
      } else {
        gainNode.gain.setValueAtTime(1, when);
      }

      // Schedule full fade-out if playback starts before fadeOutStart.
      if (seg.fadeOut >= 0.01 && clampedOffset < fadeOutStart) {
        const outWhen = startTime + (fadeOutStart - clampedOffset);
        gainNode.gain.setValueAtTime(1, outWhen);
        gainNode.gain.setValueCurveAtTime(
          createEqualPowerCurve('out', 0),
          outWhen,
          seg.fadeOut
        );
      }

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(when, sourceOffset, playDuration);
      this.activeNodes.push(source);
    }

    const tick = () => {
      if (!this.isPlaying || !this.ctx) return;
      const elapsed = Math.max(0, this.ctx.currentTime - this.playStartCtxTime);
      const pos = this.playStartOffset + elapsed;

      if (pos >= this.totalDuration) {
        this.callbacks?.onTimeUpdate(this.totalDuration);
        this.stop(true);
        return;
      }

      this.callbacks?.onTimeUpdate(pos);
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  public stop(notifyEnded = false): void {
    this.isPlaying = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    for (const node of this.activeNodes) {
      try {
        node.stop();
      } catch {
        // Ignore already-stopped nodes.
      }
      try {
        node.disconnect();
      } catch {
        // Ignore already-disconnected nodes.
      }
    }
    this.activeNodes = [];

    if (notifyEnded) {
      this.callbacks?.onEnded();
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
