# 📚 NovelWriter (Offline Novel Writing + AI Assistant)

NovelWriter is a personal writing app for novel authors: **offline-first, local storage, structured management (Volume/Chapter), distraction-free writing**, plus an **optional AI assistant (via API integration)** for brainstorming, outlining, and polishing.

- 📱 Platform: Android
- 🧰 Tech Stack: React Native (Expo) + EAS Build
- 🧾 Repository: <https://github.com/yanyan1115/NovelWriter>

---

## ⬇️ Download & Install

### 🚀 Recommended for Mainland China (Stable Mirror)

| Channel | Link | Notes |
|--------|------|-------|
| 📥 **123Pan Mirror (Recommended)** | [Download APK](https://www.123865.com/s/VwQCvd-5aZd3) | Fast & stable in CN |
| 🌐 **GitHub Pages** | [Official download page](https://yanyan1115.github.io/NovelWriter/) | May require VPN / network tools |
| 🏷️ **GitHub Releases** | [Releases page](https://github.com/yanyan1115/NovelWriter/releases) | May require VPN / network tools |

> ⚠️ Notes:
> - If the 123Pan link expires, please check the latest version on GitHub Releases.
> - On Android, you may need to enable installation from “Unknown sources”.

---

## ✨ Highlights

- 📴 **Offline-first**: write and manage content without internet
- 🔒 **Local storage**: your content stays on-device by default
- 🗂️ **Volume / Chapter structure**: built for long-form writing
- ✍️ **Distraction-free editor**: stay focused on creation
- 🎨 **Themes**: light & dark modes
- 🧰 **Backup & restore**: list / restore / delete backups (auto backup on app start)
- 🤖 **Optional AI assistant**: bring your own API key, enable only when needed

---

## 🤖 AI Assistant (OpenAI-Compatible API)

The chat feature uses an **OpenAI Chat Completions compatible API** (`/chat/completions`) with **SSE streaming** (`stream: true`).

Per chat *session/agent* you can configure:

- 🔑 `API Key`
- 🌐 `API Base URL` (e.g. `https://api.deepseek.com/chat/completions`)
- 🧠 `Model` (e.g. `deepseek-chat`)
- 🧾 `System Prompt`
- 🧪 Sampling params: `temperature`, `presence_penalty`, `frequency_penalty`, `max_tokens`

### Where to configure?

Open a chat, then **“对话设定(Agent)” → “模型 (Model)”** to set `API Key / API Base URL / Model`.

### Privacy note

When AI is enabled and you send messages, **the selected content is transmitted to the API provider you configured**. If no API key is set or AI is not used, no request will be made.

### Optional: punctuation bias (`logit_bias`)

The app optionally supports `logit_bias` (to encourage Chinese punctuation). If the server doesn’t support this field, the client automatically falls back and shows a hint.

---

## 🗄️ Backup & Restore

- Backups are stored as **`.json`** files
- In the backup list you can **restore / delete**
- The app **auto-creates a backup on every launch** (see the backup screen)

> ⚠️ Restore will overwrite current bookshelf data. Use with caution.

---

## 🧑‍💻 Getting Started (Developers, Expo)

1) Install dependencies

```bash
npm install
```

2) Start locally (clear cache)

```bash
npx expo start -c
```

3) Build with EAS (Android / preview)

```bash
eas build -p android --profile preview
```

---

## 🧭 Project Structure

- `src/screens`: screens (bookshelf, editor, chat, backup, etc.)
- `src/components`: reusable components (session panel, settings panels, etc.)
- `src/storage`: local storage & persistence
- `src/styles`: themes & global styles
- `src/utils`: utilities (e.g., LLM API client)

---

## 🤝 Contributing

Issues and PRs are welcome — let’s build a better offline writing tool together!

---

## 📄 License

MIT
