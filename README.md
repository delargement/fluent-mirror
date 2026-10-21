# Fluent Mirror

A monitor-first language practice app. Spoken input appears above; a separate correction model reflects it more naturally below while GPT-Live keeps the conversation going.

## Features

- German, French, Spanish, and English; six conversation levels.
- Flow, Coach, and Shadow modes, word-level diffs, explanations, browser pronunciation playback, focus mode, and microphone/audio controls.
- WebRTC voice integration using GPT-Live, with captions grouped at natural pauses. A separate Responses request produces structured corrections.
- Session review, plain text export, and saved phrases. Browser-local persistence; no recordings stored by this app.
- Clearly labeled demo conversations, usable without a key or microphone.

## Live API setup

Set the server-side `OPENAI_API_KEY` secret through Sites and deploy a new version to activate live voice and free-form corrections. Optional `OPENAI_VOICE_MODEL` and `OPENAI_TEXT_MODEL` override the defaults `gpt-live-1` and `gpt-5.6-luna`. Never expose a standard API key to the browser. A ChatGPT plan does not supply API authentication for this application.

Live provider access has not been tested without configured API credentials. The interface and no-key paths are independently usable. The initial hosted Site is private; authenticated identity and same-origin JSON requests are required for API operations. Keep the Site private unless adding appropriate shared usage controls.

The app treats a 1.8 second transcript delivery pause as an application grouping heuristic, not a provider-guaranteed completed turn. Deltas and approximate timeline boundaries are retained in memory while grouping. GPT-Live has no completed-transcript-turn event. Corrections can arrive after an assistant response. No pronunciation scores are inferred from text.

## Development

Use the Sites project scripts in `package.json` and the supplied hosting workflow. Run `node scripts/run-framework.mjs dev` for supported development or use the managed preview supervisor. Build with the Sites build helper.

## Official API references

- https://developers.openai.com/api/docs/guides/voice-webrtc
- https://developers.openai.com/api/docs/guides/live-conversations
- https://developers.openai.com/api/docs/guides/structured-outputs
