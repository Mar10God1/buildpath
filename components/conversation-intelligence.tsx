"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS, MAX_TRANSCRIPT_LENGTH, type ConversationAction, type TranscriptSegment } from "@/lib/conversation-intelligence";
import { prepareConversationAudio, pcmWav, conversationAudioMime } from "@/lib/conversation-audio";
import styles from "./conversation-intelligence.module.css";

type SavedConversation = { id: string; title: string | null; raw_text: string | null; storage_path: string | null; created_at: string };
type Draft = { id: string; proposed_value: ConversationAction & { evidence_id: string }; status: string };
const messageOf = (error: unknown) => error && typeof error === "object" && "message" in error ? String(error.message) : "Something went wrong. Your current draft is still here.";
const time = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

export function ConversationIntelligence({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState(""), [transcript, setTranscript] = useState(""), [reviewed, setReviewed] = useState(false);
  const [clarity, setClarity] = useState(true), [recording, setRecording] = useState(false), [busy, setBusy] = useState(false), [starting, setStarting] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [message, setMessage] = useState(""), [warning, setWarning] = useState(""), [micStatus, setMicStatus] = useState("");
  const [file, setFile] = useState<Blob | null>(null), [audioUrl, setAudioUrl] = useState(""), [enhancedUrl, setEnhancedUrl] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]), [savedId, setSavedId] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedConversation[]>([]), [drafts, setDrafts] = useState<Draft[]>([]);
  const [permission, setPermission] = useState<"loading" | "write" | "read" | "none">("loading");
  const worker = useRef<Worker | null>(null), recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), active = useRef(true);
  const uploadedPath = useRef<string | null>(null), evidenceId = useRef<string | null>(null);
  const transcriptionAttempt = useRef(0);

  async function load() {
    const s = createClient();
    const access = await s.rpc("project_permission_summary", { target_project: projectId });
    if (access.error) throw access.error;
    if (!access.data?.view_documents) { setPermission("none"); return; }
    setPermission(access.data.upload_documents ? "write" : "read");
    const [h, d] = await Promise.all([
      s.from("evidence").select("id,title,raw_text,storage_path,created_at").eq("project_id", projectId).eq("source_system", "conversation_intelligence").order("created_at", { ascending: false }).limit(20),
      s.from("extraction_candidates").select("id,proposed_value,status").eq("project_id", projectId).eq("proposed_value->>source", "conversation_intelligence").eq("status", "pending").order("created_at", { ascending: false }).limit(40),
    ]);
    if (h.error || d.error) throw h.error || d.error;
    if (active.current) { setHistory(h.data || []); setDrafts((d.data || []) as Draft[]); }
  }
  useEffect(() => {
    active.current = true; load().catch(e => setMessage(messageOf(e)));
    return () => {
      active.current = false; transcriptionAttempt.current++; worker.current?.terminate();
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current) { recorder.current.onstop = null; if (recorder.current.state !== "inactive") recorder.current.stop(); }
      stream.current?.getTracks().forEach(t => t.stop());
    };
  }, [projectId]); // Parent keys this component by project to discard cross-project drafts.
  useEffect(() => { if (!file) { setAudioUrl(""); return; } const url = URL.createObjectURL(file); setAudioUrl(url); return () => URL.revokeObjectURL(url); }, [file]);
  useEffect(() => () => { if (enhancedUrl) URL.revokeObjectURL(enhancedUrl); }, [enhancedUrl]);

  function stop() { if (timer.current) clearTimeout(timer.current); if (recorder.current?.state === "recording") recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); setRecording(false); }
  async function start() {
    if (starting || recording || busy) return;
    setStarting(true); setMessage("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Recording is unavailable in this browser. Upload audio or paste a transcript instead.");
      const input = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: clarity, echoCancellation: true, autoGainControl: true }, video: false });
      if (!active.current) { input.getTracks().forEach(t => t.stop()); return; }
      stream.current = input;
      const settings = input.getAudioTracks()[0].getSettings();
      setMicStatus(settings.noiseSuppression === true ? "Microphone noise reduction enabled" : "Microphone noise reduction unavailable or off");
      const media = new MediaRecorder(input), chunks: BlobPart[] = [];
      media.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      media.onerror = () => { stop(); setMessage("Recording failed. Try uploading a recording instead."); };
      media.onstop = () => { input.getTracks().forEach(t => t.stop()); if (active.current) { uploadedPath.current = null; evidenceId.current = null; setFile(new Blob(chunks, { type: media.mimeType })); setRecording(false); setSegments([]); setTranscript(""); setReviewed(false); setEnhancedUrl(""); setWarning(""); setMessage("Recording ready. Transcribe it, then check important details."); } };
      recorder.current = media; media.start(1000); setRecording(true);
      timer.current = setTimeout(stop, MAX_AUDIO_SECONDS * 1000);
    } catch (error) { stream.current?.getTracks().forEach(t => t.stop()); setMessage(messageOf(error)); }
    finally { setStarting(false); }
  }
  function chooseFile(input: HTMLInputElement) {
    const next = input.files?.[0]; input.value = ""; if (!next) return;
    if (next.size > MAX_AUDIO_BYTES) { setMessage("Choose a recording smaller than 25 MB."); return; }
    try { conversationAudioMime(next); } catch (error) { setMessage(messageOf(error)); return; }
    uploadedPath.current = null; evidenceId.current = null;
    setFile(next); setSegments([]); setTranscript(""); setReviewed(false); setEnhancedUrl(""); setWarning(""); setMessage(""); setMicStatus("Uploaded audio: microphone noise reduction does not apply");
    if (!title) setTitle(next.name.replace(/\.[^.]+$/, ""));
  }
  async function transcribe() {
    if (!file) return;
    const attempt = ++transcriptionAttempt.current;
    setBusy(true); setTranscribing(true); setMessage("Preparing recording…"); setReviewed(false);
    try {
      const audio = await prepareConversationAudio(file, clarity);
      if (!active.current || attempt !== transcriptionAttempt.current) return;
      setWarning(audio.warning);
      setEnhancedUrl(URL.createObjectURL(pcmWav(audio.samples)));
      worker.current?.terminate();
      const w = new Worker(new URL("../workers/conversation-transcription.worker.ts", import.meta.url), { type: "module" }); worker.current = w;
      w.onerror = () => { setBusy(false); setTranscribing(false); setMessage("Local transcription could not start. You can still paste a transcript."); w.terminate(); };
      w.onmessage = event => {
        if (event.data.type === "progress") setMessage(event.data.message);
        if (event.data.type === "error") { setBusy(false); setTranscribing(false); setMessage(event.data.message); w.terminate(); }
        if (event.data.type === "complete") {
          const result = event.data.result;
          setTranscript(String(result.text || "").trim());
          setSegments((result.chunks || []).map((c: { text: string; timestamp: [number, number | null] }) => ({ start: c.timestamp[0], end: c.timestamp[1], text: c.text })));
          setMessage("Transcript ready. Check it against the audio and replace uncertain words with [unclear]."); setBusy(false); setTranscribing(false); w.terminate();
        }
      };
      w.postMessage({ audio: audio.samples }, [audio.samples.buffer]);
    } catch (error) { setBusy(false); setTranscribing(false); setMessage(messageOf(error)); }
  }
  function cancelTranscription() { transcriptionAttempt.current++; worker.current?.terminate(); setBusy(false); setTranscribing(false); setMessage("Transcription cancelled. Your recording is still available."); }

  async function saveAndExtract() {
    if (!reviewed || !title.trim() || transcript.trim().length < 5) { setMessage("Add a title and review the transcript first."); return; }
    setBusy(true); setMessage("Saving conversation…");
    try {
      const s = createClient(), session = await s.auth.getSession();
      if (!session.data.session) throw new Error("Sign in again before saving.");
      let id = savedId;
      if (!id) {
        evidenceId.current ??= crypto.randomUUID(); const nextId = evidenceId.current;
        if (file && !uploadedPath.current) {
          const contentType = conversationAudioMime(file);
          const extensions: Record<string, string> = { "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/flac": "flac", "audio/aac": "aac" };
          const path = `${projectId}/conversation-${nextId}.${extensions[contentType] || "webm"}`;
          const upload = await s.storage.from("project-evidence").upload(path, file, { contentType, upsert: false });
          if (upload.error && String(upload.error.statusCode) !== "409") throw upload.error;
          uploadedPath.current = path;
        }
        const save = await s.from("evidence").upsert({ id: nextId, project_id: projectId, evidence_type: "meeting_transcript", title: title.trim(), raw_text: transcript.trim(),
          source_system: "conversation_intelligence", storage_path: uploadedPath.current, created_by: session.data.session.user.id,
          metadata: { source: "conversation_intelligence", transcript_reviewed: true, recognition: segments.length ? "whisper-base.en-local" : "manual",
            original_segments: segments, speaker_identification: "unavailable", clarity_filter: clarity, mic_noise_reduction: micStatus, automation_execution: false } }, { onConflict: "id" });
        if (save.error) throw save.error;
        id = nextId; setSavedId(id);
      }
      setMessage("Conversation saved. Extracting draft actions…");
      const result = await fetch("/api/conversations/extract", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.data.session.access_token}` }, body: JSON.stringify({ evidenceId: id }) });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Extraction failed. Retry from the saved conversation.");
      setMessage(`Conversation saved. ${data.candidateCount} draft item(s) available for review. Nothing has been sent or scheduled.`); await load();
    } catch (error) { setMessage(messageOf(error)); await load().catch(() => {}); }
    finally { setBusy(false); }
  }
  function newConversation() { setTitle(""); setTranscript(""); setSegments([]); setFile(null); setEnhancedUrl(""); setReviewed(false); setSavedId(null); setMessage(""); setWarning(""); uploadedPath.current = null; evidenceId.current = null; }
  async function playSaved(item: SavedConversation) {
    if (!item.storage_path) return;
    const result = await createClient().storage.from("project-evidence").createSignedUrl(item.storage_path, 300);
    if (result.error) setMessage(result.error.message); else window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const locked = busy || recording || starting || !!savedId;
  return <section className={styles.root}>
    <header><p className={styles.kicker}>CONVERSATION INTELLIGENCE · FIRST VERSION</p><h2>Turn conversations into next steps</h2><p>Record or upload up to two minutes. Transcribe on this device, check the words, and extract draft actions.</p></header>
    {permission === "loading" && <p>Checking project access…</p>}
    {permission === "none" && <p>You need permission to read project evidence.</p>}
    {permission === "write" && <div className={styles.card}>
      <div className={styles.actions}><button disabled={busy || starting || !!savedId} onClick={recording ? stop : start}>{recording ? "Stop recording" : starting ? "Opening microphone…" : "Record conversation"}</button>
        <label className={styles.upload}>Upload audio<input aria-label="Upload audio" type="file" accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg" disabled={locked} onChange={e => chooseFile(e.currentTarget)} /></label>
        <label><input type="checkbox" checked={clarity} disabled={locked} onChange={e => setClarity(e.target.checked)} /> Reduce rumble / request microphone noise reduction</label></div>
      <p className={styles.muted}>{micStatus || "Place the microphone close to the speaker. Overlapping voices and heavy noise can still obscure words."}</p>
      {audioUrl && <div className={styles.audio}><label>Captured / uploaded audio<audio controls src={audioUrl} /></label>{enhancedUrl && <label>Transcription input (16 kHz{clarity ? ", rumble reduced" : ""})<audio controls src={enhancedUrl} /></label>}</div>}
      {file && <button disabled={locked} onClick={transcribe}>Transcribe recording</button>}
      {transcribing && <button className={styles.secondary} onClick={cancelTranscription}>Cancel transcription</button>}
      <p className={styles.muted}>The first transcription downloads a speech model. Audio transcription runs locally; reviewed text is sent to the project’s AI service when you extract actions. This version transcribes after recording and does not separate speakers.</p>
      {warning && <p role="status" className={styles.warning}>{warning}</p>}
      <label className={styles.field}>Conversation title<input disabled={locked} value={title} onChange={e => setTitle(e.target.value)} placeholder="Site walkthrough or client discussion" /></label>
      {segments.length > 0 && <details><summary>Original machine transcript with timestamps · speakers unidentified</summary>{segments.map((s, i) => <p key={i}><button className={styles.timestamp} onClick={() => { const audio = document.getElementById(`conversation-playback-${projectId}`) as HTMLAudioElement | null; if (audio) { audio.currentTime = s.start; void audio.play(); } }}>{time(s.start)}</button> {s.text}</p>)}<audio id={`conversation-playback-${projectId}`} controls src={audioUrl} /></details>}
      <label className={styles.field}>Reviewable transcript<textarea disabled={locked} value={transcript} maxLength={MAX_TRANSCRIPT_LENGTH} onChange={e => { setTranscript(e.target.value); setReviewed(false); }} placeholder="Transcribe audio or paste a transcript. Use [unclear] wherever you cannot verify a word." /></label>
      <label className={styles.review}><input type="checkbox" checked={reviewed} disabled={locked} onChange={e => setReviewed(e.target.checked)} /> I checked the transcript, especially names, dates, quantities and amounts.</label>
      <div className={styles.actions}><button disabled={busy || recording || starting || !reviewed || !title.trim() || transcript.trim().length < 5} onClick={saveAndExtract}>{savedId ? "Retry extraction" : "Save & extract draft actions"}</button>{savedId && <button disabled={busy} className={styles.secondary} onClick={newConversation}>New conversation</button>}</div>
    </div>}
    {message && <p role="status" className={styles.message}>{message}</p>}
    {permission !== "none" && <><div className={styles.card}><h3>Draft actions for review</h3><p className={styles.muted}>These are structured suggestions for future automations. Confirm missing details before using them.</p>
      {!drafts.length && <p>No conversation drafts waiting for review.</p>}{drafts.map(d => <article key={d.id} className={styles.draft}><small>{d.proposed_value.kind?.replaceAll("_", " ")} · draft</small><h4>{d.proposed_value.title}</h4><blockquote>{d.proposed_value.source_quote}</blockquote>
        <dl>{d.proposed_value.fields?.map((f, i) => <div key={i}><dt>{f.key}</dt><dd>{f.value || "Unknown"}{f.needs_confirmation ? " · confirm" : ""}</dd></div>)}</dl>
        {!!d.proposed_value.missing_info?.length && <p className={styles.warning}>To confirm: {d.proposed_value.missing_info.join("; ")}</p>}
        <a download="conversation-action.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ ...d.proposed_value, state: "draft", requires_confirmation: true }, null, 2))}`}>Export structured draft</a>
      </article>)}</div>
      <div className={styles.card}><h3>Saved conversations</h3>{!history.length && <p>No conversations saved yet.</p>}{history.map(h => <details key={h.id}><summary>{h.title || "Conversation"} · {new Date(h.created_at).toLocaleDateString()}</summary><p className={styles.transcript}>{h.raw_text}</p>{h.storage_path && <button className={styles.secondary} onClick={() => playSaved(h)}>Listen to source audio</button>}{permission === "write" && <button className={styles.secondary} disabled={busy || recording || starting} onClick={() => { newConversation(); setTitle(h.title || "Conversation"); setTranscript(h.raw_text || ""); setReviewed(true); setSavedId(h.id); }}>Open saved transcript / retry extraction</button>}</details>)}</div></>}
  </section>;
}
