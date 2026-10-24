# Shared Conversation Intelligence

BuildPath and ConsultationPath expose **Conversations** in their project workspaces. The shared flow is:

1. Record a microphone or upload an audio file, up to two minutes / 25 MB.
2. Transcribe locally in a web worker using quantized Whisper Base English, pinned to a model revision.
3. Listen to the captured audio and compare the timestamped machine transcript with an editable transcript. Mark uncertain words `[unclear]` and check names, quantities, dates, and amounts.
4. Explicitly confirm transcript review, then save the source recording and reviewed text as private project evidence.
5. Use the existing approved Claude integration to extract reviewable structured action drafts. These are persisted in `extraction_candidates` and can be exported as JSON for future automation adapters.

## Audio processing and limitations

This is an initial capture, transcription, and extraction implementation, not a validated solution for every loud environment. Supported microphones are asked to enable native noise suppression, echo cancellation, and automatic gain control. The interface reports the microphone's actual noise-suppression setting. Uploaded audio does not acquire microphone noise suppression retroactively.

The transcription input is resampled to mono 16 kHz, with optional gentle 80 Hz high-pass filtering to reduce rumble. Both the original captured/uploaded recording and the transcription input can be played before saving. Silence is rejected; very quiet or clipped input raises a warning. This filter is not a neural denoiser and does not separate overlapping speakers.

Transcription occurs after recording, not continuously during a conversation. This English-only first version has no speaker diarization, calibrated word confidence, live earbud monitoring, phone-provider audio ingestion, or external automation execution. All machine text starts unverified. Manual correction and `[unclear]` are intentional requirements until stronger recognition and uncertainty estimation are validated on representative recordings.

The model and WASM runtime download on first use from Hugging Face / jsDelivr and may be cached by the browser. Transcription runs on the device. Saving uploads original audio and reviewed text to existing private Supabase storage; extracting actions sends reviewed text to the existing Claude service. No new paid transcription provider is enabled.

## Structured drafts and evidence

Action kinds: task, material request, reschedule, change order, decision, contact, risk. Each action includes a source quote, individual fields with supporting quotes, missing information, and an automation object with `state: draft` and `requires_confirmation: true`.

The server independently rejects actions without an exact supporting quotation. A field without an exact source-supported value becomes `null` and requires confirmation. Dates and numbers remain as spoken; the extractor cannot silently turn "Friday" into a guessed calendar date. `[unclear]` passages cannot support extracted facts. Recognition confidence is left unknown rather than fabricated.

Extraction uses the signed-in user's Supabase client and project permissions; it requires both `view_documents` and `upload_documents`. Existing table and storage RLS apply. Stable job/candidate IDs prevent repeat requests from duplicating drafts. Failed extraction leaves saved audio and transcript available for retry.

No source conversation automatically places orders, sends messages, changes a schedule, or records payments. Future adapters must resolve missing fields and obtain the required review before acting.

## Deployment configuration

No new tables or migrations. The existing private `project-evidence` bucket retains its 25 MB limit and RLS policies. Its MIME allowlist was extended to include WAV, MP3, M4A/MP4 audio, WebM, Ogg, FLAC, and AAC, preserving existing document/image types. New installations must make the equivalent storage configuration update.

Existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and approved `ANTHROPIC_API_KEY` configuration is reused. AI extraction reports a clear unavailable message if the AI key is absent; locally transcribed text can still be preserved as evidence.

## Verification

- `npm run test:conversations` on Node 22+ covers unsupported / unclear quotations, invented field normalization, authorization, the transcript-review gate, draft persistence, idempotency, and extraction-failure retries. Route tests use a database double and never call a paid model.
- TypeScript check and optimized Next.js production build pass.
- Chrome production-build test: real WAV decoding, local WASM worker inference, timestamp rendering, review gating, and resetting review after transcript edits. No browser exceptions observed; the workspace fits a 390 px viewport without horizontal overflow.
- A clean 22-word JFK sample from the Transformers.js documentation transcribed correctly with the initial Tiny model after ignoring punctuation/case.
- The same sample mixed with deterministic colored noise and 60 Hz rumble at 5 dB signal-to-noise ratio produced 3 word errors / 22 words with Tiny, including loss of "ask"; Base produced 1 error / 22 words and preserved "ask not". This small synthetic comparison motivated selecting Base. It is not a real-world accuracy claim or evidence that the rumble filter improves intelligibility.

Next validation should use consented job-site and client-meeting recordings, measuring names, quantities, amounts, dates, negation, speaker overlap, word error rate, and correct/incorrect extracted actions. A dedicated neural denoiser and speaker separation remain subsequent work.
