# Calls & Texts — BuildPath and ConsultationPath

One shared module is available in both authenticated workspaces. Project selection is explicit; imported conversations never guess which job or engagement they belong to. Records use the existing `evidence` table and its project-role RLS, with `source_system = path_communications` and a versioned metadata envelope. No new migration or unrelated pending pilot migration is required.

## Available without phone-provider setup

- Save selected pasted messages, call notes or transcripts with contact, number, direction and date.
- Import CSV or JSON from an iPhone or Android. File preview happens locally, records start unselected, and only selected records are submitted. Stable IDs skip duplicate imports within the project.
- Search the latest 200 saved records. Conversation recaps and suggested follow-ups use the already-approved Anthropic integration when configured. Explicitly save suggestions as pending timeline tasks/changes. Scope/pricing are never approved automatically.
- Calls are metadata/notes, not audio. No automatic device inbox sync, call recording, iMessage access, RCS history or MMS backup import is claimed.

## iPhone

Use Calls & Texts → My phone → iPhone. Paste selected messages or call notes, or import an existing export converted to the template. A CSV must use `kind,contact,phone,direction,occurredAt,text`; `kind` is `sms` or `call`. Dates must include a timezone. JSON accepts an array or `{records:[...]}` with the same fields. Do not upload an entire phone backup. This web app does not have access to iOS Messages or Phone databases. It does not send texts as iMessage or silently capture ordinary cellular calls.

## Android pilot companion

`mobile/android` contains a native Kotlin exporter for direct installation/testing. Open it in Android Studio with SDK 35, JDK 17 and Gradle 8.9; build the debug APK. It requests READ_SMS and READ_CALL_LOG separately when the corresponding load button is tapped, loads at most 500 recent records, starts with nothing selected, and writes only selected records through Android's file picker. It has no Internet, microphone, send-SMS, accessibility or background permissions. Upload the exported JSON through My phone → Android. OEM restrictions may prevent these permissions even on a directly installed build; file/paste import remains available. Device/release validation is still required before distribution.

This is not a Play Store release: Google Play restricts SMS/call-log access to qualifying default handlers or approved exceptions. Do not publish this permission-bearing pilot to Play as an ordinary project-management app. A public release needs an approved distribution/handler design or retains the file-import workflow.

## Optional business provider: Twilio

No paid service is enabled by this code. Before activation, obtain explicit owner approval for the provider costs and business number. Configure the approved account and number in Twilio, complete any applicable messaging registration/recipient opt-in, and set these server-only environment variables:

```
PATH_PHONE_ENABLED=true
TWILIO_ACCOUNT_SID=<account SID>
TWILIO_AUTH_TOKEN=<auth token>
SUPABASE_SERVICE_ROLE_KEY=<server-only key>
PATH_PHONE_WEBHOOK_ORIGIN=https://<public canonical deployment origin>
PATH_PHONE_ROUTES=[{"projectId":"<existing project UUID>","number":"+15125551234","forwardTo":"+15125559876"}]
```

Use POST `/api/communications/twilio` as the incoming-message and incoming-call webhook. The exact URL must be public/reachable by Twilio and match PATH_PHONE_WEBHOOK_ORIGIN; Vercel deployment protection can prevent provider delivery. One business number routes to one configured project; never configure duplicate numbers. The route forwards incoming calls to forwardTo, logs incoming calls, receives texts/media metadata, and sends outbound SMS through the Business line screen. Recording is off. It does not provision or port numbers, make outbound calls in-app, transcribe audio automatically. Signed status callbacks update message delivery and forwarded-call duration; queued text status is not delivery confirmation. Multi-job automatic matching, general provider OAuth and a graphical admin connection wizard are future work.

Twilio signatures are checked against the canonical HTTPS URL plus all form parameters before service-role writes, and AccountSid must match. Provider event IDs are deterministic for replay safety. Outbound SMS reserves an evidence ID before contacting the provider; uncertain delivery is marked and never automatically retried. Media download uses project RLS and server-only credentials; redirecting provider media is currently reported unavailable rather than forwarding credentials to another host.

## Validation

Run `npx tsc --noEmit`, `npx next build`, and `node --test tests/communications*.test.cjs` (Node 24). Provider integration needs an approved test number/account and a reachable webhook. Android needs an emulator/device and SDK build. Test iPhone file selection/paste on device before treating it as a mobile release.

## Primary platform references

- https://www.twilio.com/docs/usage/security
- https://www.twilio.com/docs/messaging/api/message-resource
- https://www.twilio.com/docs/voice/twiml/dial
- https://developer.android.com/reference/android/provider/Telephony.Sms
- https://developer.android.com/reference/android/provider/CallLog.Calls
- https://developer.android.com/training/data-storage/shared/documents-files
- https://support.google.com/googleplay/android-developer/answer/10208820
- https://developer.apple.com/documentation/MessageUI
