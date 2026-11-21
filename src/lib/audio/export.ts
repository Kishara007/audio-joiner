import { renderMergedAudio } from './render';
import type { AudioTrack, ExportFormat, ExportWorkerRequest, ExportWorkerResponse } from './types';

export interface ExportResult {
  blob: Blob;
  filename: string;
}

/**
 * Renders merged audio via OfflineAudioContext and encodes in a dedicated Web Worker.
 */
export async function exportMergedAudio(
  tracks: AudioTrack[],
  format: ExportFormat,
  onProgress: (phase: 'rendering' | 'encoding', percent: number) => void
): Promise<ExportResult> {
  onProgress('rendering', 10);
  const renderedBuffer = await renderMergedAudio(tracks);
  onProgress('encoding', 0);

  const leftChannel = renderedBuffer.getChannelData(0);
  const rightChannel =
    renderedBuffer.numberOfChannels > 1
      ? renderedBuffer.getChannelData(1)
      : leftChannel;

  // Clone into standalone ArrayBuffers so transfer leaves the AudioBuffer intact if needed.
  const left = new Float32Array(leftChannel);
  const right = new Float32Array(rightChannel);

  const worker = new Worker(
    new URL('../../workers/audioExport.worker.ts', import.meta.url),
    { type: 'module' }
  );

  try {
    const result = await new Promise<{ buffer: ArrayBuffer; mimeType: string }>(
      (resolve, reject) => {
        worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) => {
          const msg = event.data;
          if (msg.type === 'progress') {
            onProgress('encoding', msg.percent);
          } else if (msg.type === 'done') {
            resolve({ buffer: msg.buffer, mimeType: msg.mimeType });
          } else if (msg.type === 'error') {
            reject(new Error(msg.message));
          }
        };

        worker.onerror = (err) => {
          reject(new Error(err.message || 'Worker execution failed.'));
        };

        const payload: ExportWorkerRequest = {
          format,
          sampleRate: renderedBuffer.sampleRate,
          left,
          right,
        };

        worker.postMessage(payload, [left.buffer, right.buffer]);
      }
    );

    const blob = new Blob([result.buffer], { type: result.mimeType });
    const baseName = buildExportFilename(tracks, format);
    return { blob, filename: baseName };
  } finally {
    worker.terminate();
  }
}

function buildExportFilename(tracks: AudioTrack[], format: ExportFormat): string {
  const first = tracks[0]?.name.replace(/\.[^.]+$/, '').trim();
  const safeBase = first
    ? first.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)
    : 'audio';
  return `${safeBase || 'audio'}-joined.${format}`;
}
