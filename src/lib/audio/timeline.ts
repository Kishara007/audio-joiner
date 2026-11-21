import type { AudioTrack, TimelinePlan, TimelineSegment } from './types';

export const CROSSFADE_SECONDS = 3.0;
export const MIN_CLIP_SECONDS = 0.1;

/**
 * Formats seconds into MM:SS.d (or H:MM:SS.d for >= 1 hour).
 */
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const totalTenths = Math.round(safe * 10);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}.${tenths}`;
  }
  return `${mm}:${ss}.${tenths}`;
}

/**
 * Parses MM:SS.d, HH:MM:SS.d, or plain numeric seconds into seconds.
 */
export function parseTimeInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const val = Number.parseFloat(trimmed);
    return Number.isFinite(val) && val >= 0 ? val : null;
  }

  const parts = trimmed.split(':');
  if (parts.length === 2 || parts.length === 3) {
    const nums = parts.map((p) => Number.parseFloat(p));
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) {
      return null;
    }
    if (parts.length === 2) {
      const [m = 0, s = 0] = nums;
      return m * 60 + s;
    }
    const [h = 0, m = 0, s = 0] = nums;
    return h * 3600 + m * 60 + s;
  }

  return null;
}

/**
 * Builds the non-destructive merged timeline segments with clamped equal-power crossfades.
 */
export function computeTimelineSegments(tracks: AudioTrack[]): TimelinePlan {
  if (tracks.length === 0) {
    return { segments: [], totalDuration: 0 };
  }

  const segments: TimelineSegment[] = [];

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]!;
    const trimmedDuration = Math.max(MIN_CLIP_SECONDS, track.trimEnd - track.trimStart);

    let startOffset = 0;
    let fadeIn = 0;

    if (i > 0) {
      const prevTrack = tracks[i - 1]!;
      const prevSeg = segments[i - 1]!;
      if (prevTrack.crossfade) {
        // Clamp crossfade to 45% of either clip so adjacent overlaps never collide.
        const maxSafe = Math.min(CROSSFADE_SECONDS, prevSeg.trimmedDuration * 0.45, trimmedDuration * 0.45);
        fadeIn = maxSafe >= 0.05 ? maxSafe : 0;
        prevSeg.fadeOut = fadeIn;
      }
      startOffset = Math.max(0, prevSeg.endOffset - fadeIn);
    }

    segments.push({
      trackId: track.id,
      index: i,
      startOffset,
      endOffset: startOffset + trimmedDuration,
      trimmedDuration,
      fadeIn,
      fadeOut: 0,
    });
  }

  const totalDuration = segments.reduce((max, seg) => Math.max(max, seg.endOffset), 0);
  return { segments, totalDuration };
}

/**
 * Maps a timeline position (seconds) to local source times per active track.
 */
export function mapTimelineToTrackPositions(
  tracks: AudioTrack[],
  plan: TimelinePlan,
  timelinePosition: number
): Map<string, number> {
  const positions = new Map<string, number>();

  for (const seg of plan.segments) {
    if (timelinePosition >= seg.startOffset && timelinePosition <= seg.endOffset) {
      const track = tracks[seg.index];
      if (!track) continue;
      const elapsedInSeg = timelinePosition - seg.startOffset;
      const localTime = Math.min(track.trimEnd, Math.max(track.trimStart, track.trimStart + elapsedInSeg));
      positions.set(track.id, localTime);
    }
  }

  return positions;
}

/**
 * Computes the timeline position corresponding to clicking inside a specific track at localTime.
 */
export function mapTrackTimeToTimeline(
  tracks: AudioTrack[],
  plan: TimelinePlan,
  trackId: string,
  localTime: number
): number {
  const seg = plan.segments.find((s) => s.trackId === trackId);
  const track = tracks.find((t) => t.id === trackId);
  if (!seg || !track) return 0;

  const clampedLocal = Math.max(track.trimStart, Math.min(track.trimEnd, localTime));
  return seg.startOffset + (clampedLocal - track.trimStart);
}

/**
 * Preserves the playhead's local position on its current track when tracks are trimmed,
 * crossfaded, reordered, or deleted so dragging a trim handle does not push the playhead forward.
 */
export function recomputeTimelineWithAnchor(
  oldTracks: AudioTrack[],
  newTracks: AudioTrack[],
  oldTimelineTime: number,
  preferredTrackId?: string
): number {
  if (oldTimelineTime <= 0 || newTracks.length === 0) {
    return 0;
  }

  const oldPlan = computeTimelineSegments(oldTracks);
  const oldPositions = mapTimelineToTrackPositions(oldTracks, oldPlan, oldTimelineTime);

  let anchorTrackId: string | undefined;
  if (
    preferredTrackId &&
    oldPositions.has(preferredTrackId) &&
    newTracks.some((tr) => tr.id === preferredTrackId)
  ) {
    anchorTrackId = preferredTrackId;
  } else {
    for (const [trackId] of oldPositions) {
      if (newTracks.some((tr) => tr.id === trackId)) {
        anchorTrackId = trackId;
        break;
      }
    }
  }

  const newPlan = computeTimelineSegments(newTracks);
  if (!anchorTrackId) {
    return 0;
  }

  const oldLocalTime = oldPositions.get(anchorTrackId);
  const newTrack = newTracks.find((tr) => tr.id === anchorTrackId);
  if (oldLocalTime === undefined || !newTrack) {
    return Math.min(oldTimelineTime, newPlan.totalDuration);
  }

  const clampedLocal = Math.max(newTrack.trimStart, Math.min(newTrack.trimEnd, oldLocalTime));
  return mapTrackTimeToTimeline(newTracks, newPlan, anchorTrackId, clampedLocal);
}
