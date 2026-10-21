# Fluent Mirror

**Speak freely. See a clearer reflection of your words.**

Fluent Mirror is a language-practice app that shows what you said above a more natural version below. Highlighted changes and short explanations help you learn without losing the flow of a conversation.

[Try the demo](https://delargement.github.io/fluent-mirror/) · [Report an issue](https://github.com/delargement/fluent-mirror/issues)

> The demo link becomes available after this repository is uploaded and GitHub Pages is enabled. The public demo uses prepared examples: no API key, microphone access, or AI usage charges.

## Features

- **A two-panel speech mirror:** original sentences, corrected versions, and word-level highlights.
- **Four languages:** German, French, Spanish, and English.
- **Flow, Coach, and Shadow:** quiet feedback, visible explanations, or listening and repeating.
- **Pronunciation playback:** listen with voices available in your browser and operating system.
- **Saved phrases and session history:** bookmark useful corrections, revisit sessions, and export them as text.
- **Focus mode and responsive layout:** practice on desktop, tablet, or mobile.

## Try a demo

1. Choose a language and select **Try a demo**.
2. Watch a sample sentence appear above its prepared correction.
3. Use **Next sample** to continue, or switch between Flow, Coach, and Shadow.
4. Open **Why this works**, listen to the corrected sentence, or bookmark a phrase.
5. Select **End session** to review or export your session.

Samples repeat after the last example. Topic, level, and correction-style settings do not generate new content in the demo. Pronunciation voices vary by device; missing voices do not prevent the rest of the demo from working.

## Demo versus live practice

| | GitHub Pages demo | Full app |
| --- | --- | --- |
| Conversation | Prepared sentences and replies | Live AI voice conversation |
| Corrections | Prepared examples | Corrections of your own speech or typed text |
| Microphone | Never requested | Required for live voice |
| API key | Not needed | Server-side key required |
| AI API charges | None | Usage-based billing |
| Hosting | Static GitHub Pages | Server/Worker hosting, originally OpenAI Sites |

GitHub Pages serves the demo only. Live voice and personal corrections require server endpoints. The live integration is experimental and has not been verified end to end with configured API credentials.

## Run locally

### Requirements

- Node.js **22.13 or newer**; Node.js 22 LTS is recommended.
- **pnpm 11.25.0**, matching the version pinned in package.json. If needed, install it with `npm install --global pnpm@11.25.0`.

### Demo — no API key needed

```powershell
git clone https://github.com/delargement/fluent-mirror.git
cd fluent-mirror
pnpm install --frozen-lockfile
pnpm dev:demo
```

Open **http://localhost:5174**. To check the production demo build:

```powershell
pnpm build:demo
pnpm preview:demo
```

Open **http://localhost:4173**. The static output is generated in `dist-demo/`.

### Full app — optional live API

Create `.dev.vars` beside `package.json`:

```dotenv
OPENAI_API_KEY=your_key_here
```

Run `pnpm dev` and open **http://localhost:5173**. The home page starts the sign-in flow automatically. On localhost, the development plugin creates a local test session; the hosted app uses ChatGPT sign-in. Allow microphone access for live voice. Restart the server after changing environment variables.

Optional server variables: `OPENAI_VOICE_MODEL` and `OPENAI_TEXT_MODEL`. The current defaults are `gpt-live-1` and `gpt-4.1-nano`. OpenAI API usage is billed separately from ChatGPT subscriptions. End live sessions when finished.

Corrections focus on speech: punctuation and capitalization are ignored, and unfinished phrases are kept intact. Punctuation-only edits are suppressed even if a model returns them. Corrections start after roughly 0.9 seconds without a transcript delta (1.3 seconds for very short fragments), with up to two requests in flight. Each result updates its original sentence, so a slow response does not reorder the transcript. Ending a session cancels pending requests. The console records model and request/queue timing without logging speech or API keys. Run `pnpm test:corrections` for focused regression checks.

Keep `.dev.vars` local; `.dev.vars*` and `.env*` are ignored by Git. Hosted live practice needs the key configured as a server-side secret. Never put an API key in frontend code, a public repository, or GitHub Pages.

## Publish on GitHub Pages

The included `.github/workflows/pages.yml` builds the demo and deploys pushes to the repository's default branch (main or master). Pull requests build without deploying.

1. Upload or push the project to GitHub, including the hidden `.github` folder and `pnpm-lock.yaml`. Exclude local environment files, `node_modules`, and build output.
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Push a commit to the default branch, or select **Actions → Deploy demo to GitHub Pages → Run workflow**.
5. Wait for the build and deploy jobs to pass. The workflow shows the live URL.

For this repository, the expected URL is **https://delargement.github.io/fluent-mirror/**. Update the README links if you fork or rename the repository. Relative asset paths support hosting under a repository subdirectory.

No API key or repository secrets are needed. The workflow publishes only `dist-demo/`, containing the browser bundle and assets. GitHub Pages must be available for your repository's visibility and plan.

See [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Privacy and limitations

- Settings, saved phrases, and history stay in localStorage on the current browser and origin. They do not sync; clearing site data removes them.
- The public demo does not record audio or send sentences to an AI service. Pronunciation playback uses browser/system voices; processing depends on the selected voice. Fonts load from Google Fonts.
- Live mode sends speech and correction text to OpenAI. This app does not save audio recordings.
- Live transcript grouping uses a pause heuristic; corrections may arrive after the conversation has moved on. Text corrections do not measure pronunciation accuracy.
- The full app uses server authentication and same-origin checks. A public live deployment needs appropriate usage controls.

## Project structure

```text
app/                         Full app entry, layout, styles, and API routes
components/fluent-mirror.tsx  Shared interface and demo interactions
lib/mirror.ts                Prepared samples, types, and word-diff helpers
demo/                        Static browser entry for GitHub Pages
vite.demo.config.ts          Isolated demo build configuration
.github/workflows/pages.yml  Demo build and deployment workflow
```

Built with React, TypeScript, Vite/Vinext, Tailwind CSS, and Lucide icons. The full app uses Cloudflare Worker tooling through OpenAI Sites.

## Contributing

Bug reports and focused pull requests are welcome. Include your browser, reproduction steps, and a screenshot for UI issues. Run `pnpm build:demo` before submitting changes. Never include API keys or personal session exports in issues or pull requests.
