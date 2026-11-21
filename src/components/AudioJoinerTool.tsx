import {
  CheckCircle2,
  Download,
  Layers,
  Loader2,
  Pause,
  Play,
  Plus,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { decodeAudioTrack, isSupportedAudioFile } from '../lib/audio/decode';
import { exportMergedAudio } from '../lib/audio/export';
import { TimelinePlayer } from '../lib/audio/player';
import {
  computeTimelineSegments,
  formatTime,
  mapTimelineToTrackPositions,
  mapTrackTimeToTimeline,
  MIN_CLIP_SECONDS,
  parseTimeInput,
  recomputeTimelineWithAnchor,
} from '../lib/audio/timeline';
import type { AudioTrack, ExportFormat } from '../lib/audio/types';
import { useLocale } from '../lib/useLocale';
import { TrackWaveformRow } from './TrackWaveformRow';

const EMPTY_WAVE_HEIGHTS = [
  28, 52, 76, 44, 90, 62, 100, 48, 82, 68, 94, 42, 74, 56, 86, 38, 60, 32,
];

export function AudioJoinerTool() {
  const { t } = useLocale();

  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineTime, setTimelineTime] = useState(0);

  const [format, setFormat] = useState<ExportFormat>('mp3');
  const [exportState, setExportState] = useState<{
    active: boolean;
    phase: 'rendering' | 'encoding';
    percent: number;
  }>({ active: false, phase: 'rendering', percent: 0 });
  const [readyDownload, setReadyDownload] = useState<{
    url: string;
    filename: string;
  } | null>(null);

  const [startDraft, setStartDraft] = useState('00:00.0');
  const [endDraft, setEndDraft] = useState('00:00.0');
  const [editingField, setEditingField] = useState<'start' | 'end' | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<TimelinePlayer | null>(null);
  const readyUrlRef = useRef<string | null>(null);
  const tracksRef = useRef<AudioTrack[]>([]);
  const timelineTimeRef = useRef(0);

  tracksRef.current = tracks;
  timelineTimeRef.current = timelineTime;

  const setSyncedTimelineTime = useCallback((nextTime: number) => {
    timelineTimeRef.current = nextTime;
    setTimelineTime(nextTime);
  }, []);

  const plan = useMemo(() => computeTimelineSegments(tracks), [tracks]);

  const activeTrack = useMemo(() => {
    if (tracks.length === 0) return null;
    return tracks.find((tr) => tr.id === expandedTrackId) ?? tracks[0] ?? null;
  }, [tracks, expandedTrackId]);

  const activePositions = useMemo(() => {
    if (!isPlaying && timelineTime <= 0) {
      return new Map<string, number>();
    }
    return mapTimelineToTrackPositions(tracks, plan, timelineTime);
  }, [isPlaying, tracks, plan, timelineTime]);

  // Keep Start & End input strings synced with the active track unless user is currently typing in that input.
  useEffect(() => {
    if (!activeTrack) {
      setStartDraft('00:00.0');
      setEndDraft('00:00.0');
      return;
    }
    if (editingField !== 'start') {
      setStartDraft(formatTime(activeTrack.trimStart));
    }
    if (editingField !== 'end') {
      setEndDraft(formatTime(activeTrack.trimEnd));
    }
  }, [activeTrack, editingField]);

  // Cleanup AudioContext, playback, and Blob URLs on unmount.
  useEffect(() => {
    return () => {
      playerRef.current?.stop(false);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close();
      }
      if (readyUrlRef.current) {
        URL.revokeObjectURL(readyUrlRef.current);
      }
    };
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  const stopPlayback = useCallback(() => {
    playerRef.current?.stop(false);
    setIsPlaying(false);
  }, []);

  const clearReadyDownload = useCallback(() => {
    if (readyUrlRef.current) {
      URL.revokeObjectURL(readyUrlRef.current);
      readyUrlRef.current = null;
    }
    setReadyDownload(null);
  }, []);

  const handleFilesAdded = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setErrorMessage(null);
      const validFiles = files.filter(isSupportedAudioFile);
      if (validFiles.length === 0) {
        setErrorMessage(t.tool.errorUnsupportedFile);
        return;
      }

      if (validFiles.length < files.length) {
        setErrorMessage(t.tool.errorUnsupportedFile);
      }

      stopPlayback();
      clearReadyDownload();
      setIsDecoding(true);

      try {
        const ctx = ensureAudioContext();
        const decoded: AudioTrack[] = [];
        let hadDecodeFailure = false;

        for (const file of validFiles) {
          try {
            const track = await decodeAudioTrack(file, ctx);
            decoded.push(track);
          } catch {
            hadDecodeFailure = true;
          }
        }

        if (hadDecodeFailure) {
          setErrorMessage(t.tool.errorDecodeFailed);
        }

        if (decoded.length > 0) {
          setTracks((prev) => [...prev, ...decoded]);
          setExpandedTrackId((prevId) => prevId ?? decoded[0]!.id);
        }
      } finally {
        setIsDecoding(false);
      }
    },
    [
      clearReadyDownload,
      ensureAudioContext,
      stopPlayback,
      t.tool.errorDecodeFailed,
      t.tool.errorUnsupportedFile,
    ]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFilesAdded(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleSelectTrack = (trackId: string) => {
    setExpandedTrackId((prev) => (prev === trackId ? null : trackId));
  };

  const applyTrackMutation = useCallback(
    (mutate: (prev: AudioTrack[]) => AudioTrack[], preferredTrackId?: string) => {
      if (isPlaying) stopPlayback();
      clearReadyDownload();
      const prevTracks = tracksRef.current;
      const nextTracks = mutate(prevTracks);
      if (nextTracks === prevTracks) return;

      const nextTime = recomputeTimelineWithAnchor(
        prevTracks,
        nextTracks,
        timelineTimeRef.current,
        preferredTrackId
      );
      tracksRef.current = nextTracks;
      setTracks(nextTracks);
      setSyncedTimelineTime(nextTime);
    },
    [clearReadyDownload, isPlaying, setSyncedTimelineTime, stopPlayback]
  );

  const handleTrimChange = (trackId: string, trimStart: number, trimEnd: number) => {
    applyTrackMutation(
      (prev) =>
        prev.map((tr) =>
          tr.id === trackId ? { ...tr, trimStart, trimEnd } : tr
        ),
      trackId
    );
  };

  const handleToggleCrossfade = (trackId: string) => {
    applyTrackMutation(
      (prev) =>
        prev.map((tr) =>
          tr.id === trackId ? { ...tr, crossfade: !tr.crossfade } : tr
        ),
      trackId
    );
  };

  const handleMoveTrack = (trackId: string, direction: -1 | 1) => {
    applyTrackMutation((prev) => {
      const idx = prev.findIndex((tr) => tr.id === trackId);
      if (idx === -1) return prev;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      if (!item) return prev;
      next.splice(targetIdx, 0, item);
      // Clear trailing crossfade on new last item if needed
      return next.map((tr, i) =>
        i === next.length - 1 ? { ...tr, crossfade: false } : tr
      );
    });
  };

  const handleDeleteTrack = (trackId: string) => {
    applyTrackMutation((prev) => {
      const idx = prev.findIndex((tr) => tr.id === trackId);
      const filtered = prev.filter((tr) => tr.id !== trackId);
      const cleaned = filtered.map((tr, i) =>
        i === filtered.length - 1 ? { ...tr, crossfade: false } : tr
      );
      if (expandedTrackId === trackId) {
        const fallback = cleaned[Math.min(idx, cleaned.length - 1)]?.id ?? null;
        setExpandedTrackId(fallback);
      }
      return cleaned;
    });
  };

  const startPlaybackAt = useCallback(
    async (offset: number) => {
      if (tracks.length === 0) return;
      const ctx = ensureAudioContext();
      if (!playerRef.current) {
        playerRef.current = new TimelinePlayer();
      }

      const safeOffset =
        offset >= plan.totalDuration - 0.05 ? 0 : Math.max(0, offset);
      setIsPlaying(true);
      setSyncedTimelineTime(safeOffset);

      await playerRef.current.play(
        tracks,
        safeOffset,
        {
          onTimeUpdate: (pos) => setSyncedTimelineTime(pos),
          onEnded: () => {
            setIsPlaying(false);
            setSyncedTimelineTime(0);
          },
        },
        ctx
      );
    },
    [ensureAudioContext, plan.totalDuration, setSyncedTimelineTime, tracks]
  );

  const handleTogglePlay = async () => {
    if (tracks.length === 0) return;
    if (isPlaying) {
      stopPlayback();
      return;
    }
    await startPlaybackAt(timelineTime);
  };

  const handleSeekLocal = async (trackId: string, localTime: number) => {
    const targetTimelinePos = mapTrackTimeToTimeline(tracks, plan, trackId, localTime);
    setSyncedTimelineTime(targetTimelinePos);
    if (isPlaying) {
      await startPlaybackAt(targetTimelinePos);
    }
  };

  const commitTrimInput = (field: 'start' | 'end') => {
    setEditingField(null);
    if (!activeTrack) return;

    if (field === 'start') {
      const parsed = parseTimeInput(startDraft);
      if (parsed === null) {
        setStartDraft(formatTime(activeTrack.trimStart));
        return;
      }
      const clamped = Math.max(
        0,
        Math.min(activeTrack.trimEnd - MIN_CLIP_SECONDS, parsed)
      );
      handleTrimChange(activeTrack.id, clamped, activeTrack.trimEnd);
      setStartDraft(formatTime(clamped));
    } else {
      const parsed = parseTimeInput(endDraft);
      if (parsed === null) {
        setEndDraft(formatTime(activeTrack.trimEnd));
        return;
      }
      const clamped = Math.min(
        activeTrack.duration,
        Math.max(activeTrack.trimStart + MIN_CLIP_SECONDS, parsed)
      );
      handleTrimChange(activeTrack.id, activeTrack.trimStart, clamped);
      setEndDraft(formatTime(clamped));
    }
  };

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleJoinExport = async () => {
    if (tracks.length === 0 || exportState.active) return;

    stopPlayback();
    clearReadyDownload();
    setErrorMessage(null);
    setExportState({ active: true, phase: 'rendering', percent: 5 });

    try {
      const result = await exportMergedAudio(tracks, format, (phase, percent) => {
        setExportState({ active: true, phase, percent });
      });

      const url = URL.createObjectURL(result.blob);
      readyUrlRef.current = url;
      setReadyDownload({ url, filename: result.filename });
      triggerDownload(url, result.filename);
    } catch {
      setErrorMessage(t.tool.errorExportFailed);
    } finally {
      setExportState({ active: false, phase: 'rendering', percent: 0 });
    }
  };

  const hasTracks = tracks.length > 0;

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative mx-auto w-full max-w-4xl rounded-[28px] border border-[#071B2B]/10 bg-white p-3 shadow-[0_20px_50px_-20px_rgba(7,27,43,0.18)] transition-all duration-200 dark:border-[#B9E4E8]/15 dark:bg-[#0C273D] dark:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] sm:p-5 ${
        isDragging ? 'dropzone-active-glow border-[#167D8D]' : ''
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
        onChange={handleFileInputChange}
        className="sr-only"
        aria-label={t.tool.addFiles}
      />

      {/* High-Contrast Studio Canvas (#071B2B light / #051320 dark) */}
      <div
        className={`relative flex min-h-[290px] flex-col justify-between overflow-hidden rounded-2xl bg-[#071B2B] p-4 text-[#EEEEEE] transition-all sm:min-h-[340px] sm:p-6 dark:bg-[#051320] ${
          isDragging ? 'ring-2 ring-[#B9E4E8]' : 'ring-1 ring-white/5'
        }`}
      >
        {/* Drag-over Visual Overlay */}
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-[#071B2B]/88 backdrop-blur-xs">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#167D8D] text-[#B9E4E8] shadow-lg">
              <Upload className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="text-lg font-bold text-white">{t.tool.dropActiveTitle}</p>
            <p className="text-sm text-[#B9E4E8]">{t.tool.dropActiveSubtitle}</p>
          </div>
        )}

        {!hasTracks ? (
          /* EMPTY STATE */
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center sm:py-10">
            {/* Subtle Animated Soundwave Pulse */}
            <div
              className="mb-6 flex h-14 items-end justify-center gap-1.5"
              aria-hidden="true"
            >
              {EMPTY_WAVE_HEIGHTS.map((heightPct, i) => (
                <span
                  key={i}
                  style={{
                    height: `${Math.round((heightPct / 100) * 52)}px`,
                    animationDelay: `${(i * 95) % 1200}ms`,
                  }}
                  className="animate-wave-bar w-1.5 rounded-full bg-gradient-to-t from-[#167D8D] to-[#B9E4E8]"
                />
              ))}
            </div>

            <button
              type="button"
              disabled={isDecoding}
              onClick={() => fileInputRef.current?.click()}
              className="group inline-flex min-h-[56px] items-center gap-3 rounded-full bg-[#167D8D] px-8 py-3.5 text-base font-bold text-white shadow-[0_12px_30px_-8px_rgba(22,125,141,0.75)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#198e9f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B9E4E8] disabled:opacity-70 sm:text-lg"
            >
              {isDecoding ? (
                <Loader2 className="h-6 w-6 animate-spin text-[#B9E4E8]" aria-hidden="true" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#071B2B]/35 text-[#B9E4E8] transition-transform duration-200 group-hover:scale-110">
                  <Plus className="h-5 w-5 stroke-[2.75]" aria-hidden="true" />
                </span>
              )}
              <span>{t.tool.addFiles}</span>
            </button>

            <p className="mt-4 max-w-md text-xs leading-relaxed text-[#B9E4E8]/80 sm:text-sm">
              {t.tool.dropHint}
            </p>
          </div>
        ) : (
          /* TRACK STACK */
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <button
                type="button"
                disabled={isDecoding}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-[#167D8D] px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#198e9f] focus-visible:outline-2 focus-visible:outline-[#B9E4E8] disabled:opacity-60"
              >
                {isDecoding ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#B9E4E8]" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4 text-[#B9E4E8]" aria-hidden="true" />
                )}
                <span>{t.tool.addMoreFiles}</span>
              </button>

              <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-[#B9E4E8]/85">
                <Layers className="h-3.5 w-3.5 text-[#167D8D]" aria-hidden="true" />
                <span>
                  {tracks.length} · {formatTime(plan.totalDuration)}
                </span>
              </span>
            </div>

            <div className="studio-scroll flex max-h-[360px] flex-col gap-2.5 overflow-y-auto pr-0.5">
              {tracks.map((track, idx) => {
                const playheadLocal = activePositions.get(track.id) ?? null;
                return (
                  <TrackWaveformRow
                    key={track.id}
                    track={track}
                    index={idx}
                    totalTracks={tracks.length}
                    isExpanded={activeTrack?.id === track.id}
                    isPlayingTrack={isPlaying && playheadLocal !== null}
                    playheadLocalTime={playheadLocal}
                    t={t}
                    onSelect={handleSelectTrack}
                    onTrimChange={handleTrimChange}
                    onToggleCrossfade={handleToggleCrossfade}
                    onMove={handleMoveTrack}
                    onDelete={handleDeleteTrack}
                    onSeekLocal={handleSeekLocal}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Error Alert inside Canvas if decoding/export fails */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-rose-400/35 bg-rose-950/60 px-4 py-2.5 text-xs font-medium text-rose-100 sm:text-sm"
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              aria-label={t.tool.clearResultAria}
              className="rounded-lg p-1 hover:bg-rose-400/20"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Download Ready Banner */}
      {readyDownload && (
        <div
          role="status"
          className="animate-track-expand mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#167D8D]/35 bg-[#B9E4E8]/35 px-4 py-2.5 text-sm dark:border-[#B9E4E8]/25 dark:bg-[#167D8D]/25"
        >
          <div className="flex min-w-0 items-center gap-2 font-semibold text-[#071B2B] dark:text-[#EEEEEE]">
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-[#167D8D] dark:text-[#B9E4E8]"
              aria-hidden="true"
            />
            <span className="truncate">
              {t.tool.downloadReady} {readyDownload.filename}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={readyDownload.url}
              download={readyDownload.filename}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#167D8D] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#126977]"
            >
              <Download className="h-3.5 w-3.5 text-[#B9E4E8]" aria-hidden="true" />
              <span>{t.tool.downloadAgain}</span>
            </a>
            <button
              type="button"
              onClick={clearReadyDownload}
              aria-label={t.tool.clearResultAria}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#071B2B]/70 hover:bg-[#071B2B]/10 dark:text-[#EEEEEE]/70 dark:hover:bg-[#B9E4E8]/15"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM TRANSPORT BAR */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#EEEEEE]/75 px-3 py-2.5 dark:bg-[#071B2B]/80 sm:px-4 sm:py-3">
        {/* Play/Pause + Merged Timeline Timer */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!hasTracks}
            onClick={handleTogglePlay}
            aria-label={isPlaying ? t.tool.pauseAria : t.tool.playAria}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#167D8D] text-white shadow-sm transition hover:bg-[#126977] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D8D]"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" aria-hidden="true" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
            )}
          </button>

          <div
            aria-live="off"
            className="font-mono text-xs font-semibold tabular-nums text-[#071B2B] dark:text-[#EEEEEE] sm:text-sm"
          >
            <span>{formatTime(timelineTime)}</span>
            <span className="mx-1.5 text-[#071B2B]/40 dark:text-[#B9E4E8]/45">/</span>
            <span className="text-[#455B6E] dark:text-[#B9E4E8]">
              {formatTime(plan.totalDuration)}
            </span>
          </div>
        </div>

        {/* Two-way Synced Precision Start & End Inputs */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-[#455B6E] dark:text-[#B9E4E8]">
            <span>{t.tool.startLabel}</span>
            <input
              type="text"
              inputMode="decimal"
              disabled={!activeTrack}
              value={startDraft}
              onFocus={() => setEditingField('start')}
              onChange={(e) => setStartDraft(e.target.value)}
              onBlur={() => commitTrimInput('start')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              aria-label={t.tool.startLabel}
              className="h-9 w-[76px] rounded-xl border border-[#071B2B]/15 bg-white px-2 text-center font-mono text-xs font-semibold tabular-nums text-[#071B2B] focus:border-[#167D8D] focus:outline-none disabled:opacity-45 dark:border-[#B9E4E8]/20 dark:bg-[#0C273D] dark:text-[#EEEEEE]"
            />
          </label>

          <label className="flex items-center gap-1.5 text-xs font-semibold text-[#455B6E] dark:text-[#B9E4E8]">
            <span>{t.tool.endLabel}</span>
            <input
              type="text"
              inputMode="decimal"
              disabled={!activeTrack}
              value={endDraft}
              onFocus={() => setEditingField('end')}
              onChange={(e) => setEndDraft(e.target.value)}
              onBlur={() => commitTrimInput('end')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              aria-label={t.tool.endLabel}
              className="h-9 w-[76px] rounded-xl border border-[#071B2B]/15 bg-white px-2 text-center font-mono text-xs font-semibold tabular-nums text-[#071B2B] focus:border-[#167D8D] focus:outline-none disabled:opacity-45 dark:border-[#B9E4E8]/20 dark:bg-[#0C273D] dark:text-[#EEEEEE]"
            />
          </label>
        </div>

        {/* Format Selector (mp3 / wav) + Join Pill Button */}
        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-initial">
          <div
            role="group"
            aria-label={t.tool.formatLabel}
            className="inline-flex h-10 items-center rounded-full border border-[#071B2B]/12 bg-white p-1 dark:border-[#B9E4E8]/20 dark:bg-[#0C273D]"
          >
            {(['mp3', 'wav'] as const).map((fmt) => {
              const active = format === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  aria-pressed={active}
                  className={`h-8 rounded-full px-3 text-xs font-bold uppercase tracking-wide transition focus-visible:outline-2 focus-visible:outline-[#167D8D] ${
                    active
                      ? 'bg-[#167D8D] text-white shadow-xs'
                      : 'text-[#455B6E] hover:text-[#071B2B] dark:text-[#B9E4E8]/80 dark:hover:text-white'
                  }`}
                >
                  {fmt === 'mp3' ? t.tool.formatMp3 : t.tool.formatWav}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!hasTracks || exportState.active}
            onClick={handleJoinExport}
            className="relative inline-flex min-h-[44px] min-w-[118px] items-center justify-center gap-2 overflow-hidden rounded-full bg-[#071B2B] px-6 py-2 text-sm font-extrabold text-white shadow-md transition hover:bg-[#0d2b44] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167D8D] dark:bg-[#167D8D] dark:hover:bg-[#198e9f]"
          >
            {exportState.active && (
              <span
                style={{ width: `${exportState.percent}%` }}
                className="absolute inset-y-0 left-0 bg-[#167D8D]/70 transition-all duration-150 dark:bg-[#B9E4E8]/25"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2">
              {exportState.active ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#B9E4E8]" aria-hidden="true" />
                  <span>
                    {exportState.phase === 'rendering'
                      ? t.tool.renderingStatus
                      : `${t.tool.encodingStatus} ${exportState.percent}%`}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-[#B9E4E8]" aria-hidden="true" />
                  <span>{t.tool.joinButton}</span>
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
