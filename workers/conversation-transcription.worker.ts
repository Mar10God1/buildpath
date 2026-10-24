import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
env.allowLocalModels = false;
env.backends.onnx.wasm!.numThreads = 1;
let transcriber: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
self.onmessage = async (event: MessageEvent<{ audio: Float32Array }>) => {
  try {
    transcriber ??= pipeline<"automatic-speech-recognition">("automatic-speech-recognition", "Xenova/whisper-base.en", {
      device: "wasm", dtype: "q8", revision: "95bf40a508535962c6483ead40270b2e32267508",
      progress_callback: progress => self.postMessage({ type: "progress", message: progress.status === "progress" ? "Downloading speech model…" : "Preparing local transcription…" }),
    });
    const model = await transcriber;
    self.postMessage({ type: "progress", message: "Transcribing on this device…" });
    const result = await model(event.data.audio, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 });
    self.postMessage({ type: "complete", result: Array.isArray(result) ? result[0] : result });
  } catch (error) {
    transcriber = null;
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Local transcription failed. You can still paste a transcript." });
  }
};
