import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } from "./conversation-intelligence";

export async function prepareConversationAudio(file: Blob, clarity: boolean) {
  if (!file.size || file.size > MAX_AUDIO_BYTES) throw new Error("Choose an audio file smaller than 25 MB.");
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try { decoded = await context.decodeAudioData(await file.arrayBuffer()); }
  finally { await context.close(); }
  if (decoded.duration > MAX_AUDIO_SECONDS) throw new Error("Use a recording of two minutes or less for this first version.");
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const source = offline.createBufferSource(); source.buffer = decoded;
  // Gentle rumble reduction only; this is not a neural denoiser or voice separator.
  if (clarity) { const highpass = offline.createBiquadFilter(); highpass.type = "highpass"; highpass.frequency.value = 80; source.connect(highpass); highpass.connect(offline.destination); }
  else source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering(), samples = rendered.getChannelData(0);
  let energy = 0, clipped = 0;
  for (const n of samples) { energy += n * n; if (Math.abs(n) > .99) clipped++; }
  const rms = Math.sqrt(energy / samples.length);
  if (!Number.isFinite(rms) || rms < .0001) throw new Error("No usable audio detected. Try recording closer to the speaker.");
  return { samples: new Float32Array(samples), duration: decoded.duration,
    warning: rms < .002 ? "Very quiet audio: words may be missing. Check the recording before extracting." : clipped / samples.length > .01 ? "Audio may be clipped. Distorted words need checking." : "" };
}

/** Normalize recorder codec parameters and common browser MIME aliases for private storage. */
export function conversationAudioMime(file: Blob): string {
  const type = file.type.toLowerCase().split(";")[0];
  const aliases: Record<string, string> = { "audio/x-m4a": "audio/mp4", "audio/x-flac": "audio/flac", "audio/wave": "audio/wav" };
  const normalized = aliases[type] || type;
  if (["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/flac", "audio/aac"].includes(normalized)) return normalized;
  if (!type && file instanceof File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const types: Record<string, string> = { wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4", webm: "audio/webm", ogg: "audio/ogg", flac: "audio/flac", aac: "audio/aac" };
    if (ext && types[ext]) return types[ext];
  }
  throw new Error("Use a WAV, MP3, M4A, WebM, Ogg, FLAC or AAC audio file.");
}

export function pcmWav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const text = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => { const n = Math.max(-1, Math.min(1, sample)); view.setInt16(44 + i * 2, n * (n < 0 ? 32768 : 32767), true); });
  return new Blob([buffer], { type: "audio/wav" });
}
