export type ExportFormat = 'mp3' | 'wav';

export interface AudioTrack {
  id: string;
  name: string;
  fileSize: number;
  mimeType: string;
  buffer: AudioBuffer;
  duration: number;
  trimStart: number;
  trimEnd: number;
  /** Enables 3-second equal-power crossfade overlap into the next track */
  crossfade: boolean;
  /** Precomputed normalized mono peak values [0..1] for fast canvas rendering */
  peaks: Float32Array;
}

export interface TimelineSegment {
  trackId: string;
  index: number;
  startOffset: number;
  endOffset: number;
  trimmedDuration: number;
  fadeIn: number;
  fadeOut: number;
}

export interface TimelinePlan {
  segments: TimelineSegment[];
  totalDuration: number;
}

export interface ExportWorkerRequest {
  format: ExportFormat;
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
}

export type ExportWorkerResponse =
  | { type: 'progress'; percent: number }
  | { type: 'done'; buffer: ArrayBuffer; mimeType: string }
  | { type: 'error'; message: string };
