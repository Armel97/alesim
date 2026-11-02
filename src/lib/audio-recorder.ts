// PCM WAV recorder for cross-browser speech-to-text uploads.
// Captures microphone audio via Web Audio, downsamples to 16kHz mono, and
// produces a self-contained WAV Blob on stop().

export type RecorderHandle = {
  stop: () => Promise<Blob>;
  cancel: () => void;
  getLevel: () => number;
};

import { AudioConsentDeniedError, logAudioConsent, requestAudioConsent } from "@/lib/audio-consent";

/**
 * Démarre la capture micro. Le consentement RGPD explicite est vérifié AVANT
 * tout appel à getUserMedia ; un refus lève AudioConsentDeniedError.
 */
export async function startRecorder(context = "recorder"): Promise<RecorderHandle> {
  const consented = await requestAudioConsent(context);
  if (!consented) throw new AudioConsentDeniedError();
  logAudioConsent("capture_started", context);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const timeData = new Uint8Array(analyser.fftSize);

  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
  };

  source.connect(analyser);
  source.connect(processor);
  processor.connect(ctx.destination);

  let stopped = false;

  const cleanup = () => {
    stream.getTracks().forEach((t) => t.stop());
    processor.disconnect();
    analyser.disconnect();
    source.disconnect();
    void ctx.close();
  };

  return {
    getLevel: () => {
      analyser.getByteTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / timeData.length) * 3);
    },
    cancel: () => {
      if (stopped) return;
      stopped = true;
      cleanup();
    },
    stop: async () => {
      if (stopped) throw new Error("Recorder already stopped");
      stopped = true;
      const sourceRate = ctx.sampleRate;
      cleanup();
      const merged = mergeChunks(chunks);
      const resampled = downsample(merged, sourceRate, 16000);
      return encodeWav(resampled, 16000);
    },
  };
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  let length = 0;
  for (const c of chunks) length += c.length;
  const out = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function downsample(buffer: Float32Array, from: number, to: number): Float32Array {
  if (to === from) return buffer;
  const ratio = from / to;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < newLength) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
