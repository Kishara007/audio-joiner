import { ArrowDown, ArrowUp, Shuffle, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import type { TranslationDictionary } from '../i18n';
import { formatTime, MIN_CLIP_SECONDS } from '../lib/audio/timeline';
import type { AudioTrack } from '../lib/audio/types';

interface TrackWaveformRowProps {
  track: AudioTrack;
  index: number;
  totalTracks: number;
  isExpanded: boolean;
  isPlayingTrack: boolean;
  playheadLocalTime: number | null;
  t: TranslationDictionary;
  onSelect: (trackId: string) => void;
  onTrimChange: (trackId: string, trimStart: number, trimEnd: number) => void;
  onToggleCrossfade: (trackId: string) => void;
  onMove: (trackId: string, direction: -1 | 1) => void;
  onDelete: (trackId: string) => void;
  onSeekLocal: (trackId: string, localTime: number) => void;
}

export function TrackWaveformRow({
  track,
  index,
  totalTracks,
  isExpanded,
  isPlayingTrack,
  playheadLocalTime,
  t,
  onSelect,
  onTrimChange,
  onToggleCrossfade,
  onMove,
  onDelete,
  onSeekLocal,
}: TrackWaveformRowProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformWrapRef = useRef<HTMLDivElement | null>(null);
  const draggingHandleRef = useRef<'start' | 'end' | null>(null);

  const canCrossfade = totalTracks > 1 && index < totalTracks - 1;
  const startPct = track.duration > 0 ? (track.trimStart / track.duration) * 100 : 0;
  const endPct = track.duration > 0 ? (track.trimEnd / track.duration) * 100 : 100;
  const trimmedDuration = Math.max(0, track.trimEnd - track.trimStart);

  // Draw crisp HiDPI waveform + trimmed zones + live playhead on canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const startX = (track.trimStart / track.duration) * w;
    const endX = (track.trimEnd / track.duration) * w;

    // Dimmed outer trimmed zones (only emphasized when expanded)
    if (isExpanded) {
      ctx.fillStyle = 'rgba(3, 12, 20, 0.56)';
      if (startX > 0) {
        ctx.fillRect(0, 0, startX, h);
      }
      if (endX < w) {
        ctx.fillRect(endX, 0, w - endX, h);
      }
    }

    // Center baseline
    ctx.fillStyle = 'rgba(185, 228, 232, 0.14)';
    ctx.fillRect(0, h / 2 - 0.5, w, 1);

    // Waveform peak bars
    const peaks = track.peaks;
    const barCount = peaks.length;
    const step = w / barCount;
    const barWidth = Math.max(1.5, step * 0.68);
    const maxAmp = (h * (isExpanded ? 0.84 : 0.72)) / 2;

    for (let i = 0; i < barCount; i++) {
      const peak = peaks[i] ?? 0;
      const x = i * step + (step - barWidth) / 2;
      const centerRatio = (i + 0.5) / barCount;
      const inSelectedZone =
        centerRatio >= track.trimStart / track.duration &&
        centerRatio <= track.trimEnd / track.duration;

      const barHalf = Math.max(1.5, peak * maxAmp);
      const y = h / 2 - barHalf;
      const barH = barHalf * 2;

      if (inSelectedZone) {
        // Gradient between Ocean Teal and Soft Aqua for active clip
        ctx.fillStyle = isExpanded ? '#B9E4E8' : '#167D8D';
      } else {
        ctx.fillStyle = 'rgba(185, 228, 232, 0.22)';
      }

      const radius = Math.min(2, barWidth / 2);
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, radius);
      ctx.fill();
    }

    // Crossfade ramp indicator at right edge of active trim if enabled
    if (isExpanded && track.crossfade && canCrossfade && endX - startX > 16) {
      const fadeDuration = Math.min(3.0, trimmedDuration * 0.45);
      const fadeWidth = (fadeDuration / track.duration) * w;
      const fadeStartX = Math.max(startX, endX - fadeWidth);
      const grad = ctx.createLinearGradient(fadeStartX, 0, endX, 0);
      grad.addColorStop(0, 'rgba(22, 125, 141, 0)');
      grad.addColorStop(1, 'rgba(185, 228, 232, 0.34)');
      ctx.fillStyle = grad;
      ctx.fillRect(fadeStartX, 0, endX - fadeStartX, h);
    }

    // Active trim border lines
    if (isExpanded) {
      ctx.fillStyle = '#167D8D';
      ctx.fillRect(Math.max(0, startX - 1), 0, 2, h);
      ctx.fillRect(Math.min(w - 2, endX - 1), 0, 2, h);
    }

    // Live playhead sweep line
    if (playheadLocalTime !== null && track.duration > 0) {
      const playX = Math.max(0, Math.min(w, (playheadLocalTime / track.duration) * w));
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#B9E4E8';
      ctx.shadowBlur = 8;
      ctx.fillRect(playX - 1, 0, 2, h);
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(playX, 6, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#B9E4E8';
      ctx.fill();
    }

    ctx.restore();
  }, [
    track.peaks,
    track.trimStart,
    track.trimEnd,
    track.duration,
    track.crossfade,
    canCrossfade,
    trimmedDuration,
    isExpanded,
    playheadLocalTime,
  ]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  useEffect(() => {
    const wrap = waveformWrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      drawWaveform();
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [drawWaveform]);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const wrap = waveformWrapRef.current;
      if (!wrap || track.duration <= 0) return 0;
      const rect = wrap.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * track.duration;
    },
    [track.duration]
  );

  const handleTrimPointerDown = (
    handle: 'start' | 'end',
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    e.preventDefault();
    draggingHandleRef.current = handle;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleTrimPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const handle = draggingHandleRef.current;
    if (!handle) return;
    e.stopPropagation();
    const pointerTime = timeFromClientX(e.clientX);
    if (handle === 'start') {
      const nextStart = Math.max(0, Math.min(track.trimEnd - MIN_CLIP_SECONDS, pointerTime));
      onTrimChange(track.id, nextStart, track.trimEnd);
    } else {
      const nextEnd = Math.min(
        track.duration,
        Math.max(track.trimStart + MIN_CLIP_SECONDS, pointerTime)
      );
      onTrimChange(track.id, track.trimStart, nextEnd);
    }
  };

  const handleTrimPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingHandleRef.current) {
      draggingHandleRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if capture already released.
      }
    }
  };

  const handleHandleKeyDown = (
    handle: 'start' | 'end',
    e: React.KeyboardEvent<HTMLDivElement>
  ) => {
    const step = e.shiftKey ? 1.0 : 0.1;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (handle === 'start') {
        onTrimChange(track.id, Math.max(0, track.trimStart - step), track.trimEnd);
      } else {
        onTrimChange(
          track.id,
          track.trimStart,
          Math.max(track.trimStart + MIN_CLIP_SECONDS, track.trimEnd - step)
        );
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (handle === 'start') {
        onTrimChange(
          track.id,
          Math.min(track.trimEnd - MIN_CLIP_SECONDS, track.trimStart + step),
          track.trimEnd
        );
      } else {
        onTrimChange(
          track.id,
          track.trimStart,
          Math.min(track.duration, track.trimEnd + step)
        );
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const clickedTime = timeFromClientX(e.clientX);
    const clampedLocal = Math.max(track.trimStart, Math.min(track.trimEnd, clickedTime));
    onSeekLocal(track.id, clampedLocal);
  };

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => onSelect(track.id)}
        aria-label={`${index + 1}. ${track.name} — ${t.tool.expandTrackAria}`}
        className={`group relative flex h-[38px] w-full items-center gap-3 overflow-hidden rounded-xl border px-3 text-left transition ${
          isPlayingTrack
            ? 'border-[#B9E4E8]/70 bg-[#0E2940]'
            : 'border-[#B9E4E8]/12 bg-[#0B2236] hover:border-[#167D8D]/70 hover:bg-[#0E2940]'
        } focus-visible:outline-2 focus-visible:outline-[#B9E4E8]`}
      >
        <span className="z-10 max-w-[46%] shrink-0 truncate text-xs font-semibold text-[#EEEEEE] sm:max-w-[35%] sm:text-sm">
          {index + 1}. {track.name}
        </span>

        <div ref={waveformWrapRef} className="relative h-6 min-w-0 flex-1">
          <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
        </div>

        <div className="z-10 flex shrink-0 items-center gap-2">
          {track.crossfade && canCrossfade && (
            <span className="hidden rounded-full bg-[#167D8D]/40 px-2 py-0.5 text-[10px] font-semibold text-[#B9E4E8] sm:inline-flex">
              {t.tool.crossfadeBadge}
            </span>
          )}
          <span className="font-mono text-xs tabular-nums text-[#B9E4E8]/85">
            {formatTime(trimmedDuration)}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`animate-track-expand relative flex items-stretch gap-2 sm:gap-3 ${
        isPlayingTrack ? 'ring-1 ring-[#B9E4E8]/40 rounded-2xl' : ''
      }`}
    >
      {/* Main Expanded Track Card */}
      <div className="min-w-0 flex-1 rounded-2xl border border-[#167D8D]/65 bg-[#0A2033] p-3 shadow-lg sm:p-4">
        {/* Track Header: Numbered title + Crossfade toggle in top-right */}
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelect(track.id)}
            aria-label={`${index + 1}. ${track.name} — ${t.tool.collapseTrackAria}`}
            className="flex min-w-0 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-[#B9E4E8]"
          >
            <span className="truncate text-sm font-bold text-[#EEEEEE] sm:text-base">
              {index + 1}. {track.name}
            </span>
            <span className="shrink-0 rounded-full bg-[#167D8D]/25 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#B9E4E8]">
              {formatTime(trimmedDuration)}
            </span>
          </button>

          <button
            type="button"
            disabled={!canCrossfade}
            onClick={() => onToggleCrossfade(track.id)}
            title={
              canCrossfade ? t.tool.crossfadeTooltip : t.tool.crossfadeDisabledTooltip
            }
            aria-label={
              canCrossfade ? t.tool.crossfadeTooltip : t.tool.crossfadeDisabledTooltip
            }
            aria-pressed={canCrossfade ? track.crossfade : false}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-[#B9E4E8] ${
              !canCrossfade
                ? 'cursor-not-allowed border border-[#B9E4E8]/10 bg-transparent text-[#EEEEEE]/35'
                : track.crossfade
                ? 'border border-[#B9E4E8] bg-[#167D8D] text-white shadow-sm'
                : 'border border-[#B9E4E8]/25 bg-[#071B2B]/70 text-[#B9E4E8] hover:border-[#B9E4E8]/60'
            }`}
          >
            <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t.tool.crossfadeLabel}</span>
          </button>
        </div>

        {/* Interactive Waveform Canvas (~112px height) + Draggable Trim Handles */}
        <div className="relative pb-6">
          <div
            ref={waveformWrapRef}
            className="relative h-[112px] w-full select-none overflow-hidden rounded-xl bg-[#051320] ring-1 ring-[#B9E4E8]/15"
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              aria-label={t.tool.waveformAria}
              className="block h-full w-full cursor-pointer"
            />

            {/* Left Trim Handle */}
            <div
              role="slider"
              tabIndex={0}
              aria-label={t.tool.trimStartHandleAria}
              aria-valuemin={0}
              aria-valuemax={Number(Math.max(0, track.trimEnd - MIN_CLIP_SECONDS).toFixed(1))}
              aria-valuenow={Number(track.trimStart.toFixed(1))}
              onPointerDown={(e) => handleTrimPointerDown('start', e)}
              onPointerMove={handleTrimPointerMove}
              onPointerUp={handleTrimPointerUp}
              onPointerCancel={handleTrimPointerUp}
              onKeyDown={(e) => handleHandleKeyDown('start', e)}
              style={{ left: `${startPct}%` }}
              className="group absolute top-0 bottom-0 z-20 -ml-2.5 flex w-5 cursor-ew-resize touch-none items-center justify-center focus-visible:outline-none"
            >
              <span className="flex h-full w-1.5 flex-col items-center justify-center rounded-full bg-[#B9E4E8] shadow-[0_0_10px_rgba(185,228,232,0.7)] transition group-hover:w-2 group-focus-visible:ring-2 group-focus-visible:ring-white">
                <span className="h-5 w-3 rounded-sm bg-[#167D8D] border border-[#B9E4E8]" />
              </span>
            </div>

            {/* Right Trim Handle */}
            <div
              role="slider"
              tabIndex={0}
              aria-label={t.tool.trimEndHandleAria}
              aria-valuemin={Number(Math.min(track.duration, track.trimStart + MIN_CLIP_SECONDS).toFixed(1))}
              aria-valuemax={Number(track.duration.toFixed(1))}
              aria-valuenow={Number(track.trimEnd.toFixed(1))}
              onPointerDown={(e) => handleTrimPointerDown('end', e)}
              onPointerMove={handleTrimPointerMove}
              onPointerUp={handleTrimPointerUp}
              onPointerCancel={handleTrimPointerUp}
              onKeyDown={(e) => handleHandleKeyDown('end', e)}
              style={{ left: `${endPct}%` }}
              className="group absolute top-0 bottom-0 z-20 -ml-2.5 flex w-5 cursor-ew-resize touch-none items-center justify-center focus-visible:outline-none"
            >
              <span className="flex h-full w-1.5 flex-col items-center justify-center rounded-full bg-[#B9E4E8] shadow-[0_0_10px_rgba(185,228,232,0.7)] transition group-hover:w-2 group-focus-visible:ring-2 group-focus-visible:ring-white">
                <span className="h-5 w-3 rounded-sm bg-[#167D8D] border border-[#B9E4E8]" />
              </span>
            </div>
          </div>

          {/* Live MM:SS.d Timestamps below trim handles */}
          <div className="pointer-events-none relative mt-1.5 h-4 text-[11px] font-mono tabular-nums text-[#B9E4E8]">
            <span
              style={{
                left: `${Math.max(4, Math.min(82, startPct))}%`,
              }}
              className="absolute -translate-x-1/2 rounded bg-[#071B2B]/90 px-1.5 py-0.5 text-[#B9E4E8]"
            >
              {formatTime(track.trimStart)}
            </span>
            <span
              style={{
                left: `${Math.max(18, Math.min(96, endPct))}%`,
              }}
              className="absolute -translate-x-1/2 rounded bg-[#071B2B]/90 px-1.5 py-0.5 text-[#B9E4E8]"
            >
              {formatTime(track.trimEnd)}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Vertical Control Pill (Move Up, Delete, Move Down) */}
      <div className="flex flex-col items-center justify-center gap-1 self-center rounded-2xl border border-[#B9E4E8]/18 bg-[#0E2940] p-1.5 shadow-lg">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(track.id, -1)}
          aria-label={t.tool.moveUpAria}
          title={t.tool.moveUpAria}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#B9E4E8] transition hover:bg-[#167D8D]/40 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[#B9E4E8]"
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onDelete(track.id)}
          aria-label={t.tool.deleteTrackAria}
          title={t.tool.deleteTrackAria}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-rose-300"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          disabled={index === totalTracks - 1}
          onClick={() => onMove(track.id, 1)}
          aria-label={t.tool.moveDownAria}
          title={t.tool.moveDownAria}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#B9E4E8] transition hover:bg-[#167D8D]/40 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[#B9E4E8]"
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
