# 📚 NovelWriter（离线小说创作 + AI 助手）

> 🌍 **English README**: [README.en.md](./README.en.md)

NovelWriter 是一款为小说作者打造的个人写作 App：**离线优先、本地存储、结构化管理（卷/章）、沉浸式写作**，并提供 **可选的 AI 助手（通过 API 接入）**，用于灵感/大纲/润色等写作辅助。

- 📱 平台：Android
- 🧰 技术栈：React Native（Expo）+ EAS Build
- 🧾 仓库：<https://github.com/yanyan1115/NovelWriter>

---

## ⬇️ 下载与安装（普通用户）

### 🚀 国内用户推荐（稳定下载）

| 下载渠道 | 链接 | 备注 |
|---------|------|------|
| 📥 **123 云盘（推荐）** | [点击下载](https://www.123865.com/s/VwQCvd-5aZd3) | 国内高速下载 |
| 🌐 **GitHub Pages** | [官网下载页](https://yanyan1115.github.io/NovelWriter/) | 可能需要网络工具 |
| 🏷️ **GitHub Releases** | [Releases 页面](https://github.com/yanyan1115/NovelWriter/releases) | 可能需要网络工具 |

> ⚠️ 注意：
> - 如果 123 云盘链接失效，请检查 [GitHub Releases](https://github.com/yanyan1115/NovelWriter/releases) 获取最新版本
> - 安装时若提示"未知来源"，请先开启"允许安装未知来源应用"权限

---

## ✨ 亮点功能

- 📴 **离线优先**：无网络也能写作与管理内容
- 🔒 **本地存储**：内容默认仅保存在设备本地，保护隐私
- 🗂️ **卷 / 章结构**：适合长篇小说的目录化管理
- ✍️ **沉浸式编辑**：减少干扰，专注创作
- 🎨 **主题切换**：支持浅色 / 深色主题
- 🧰 **备份与恢复**：备份列表管理、恢复、删除（应用启动时会自动创建备份）
- 🤖 **AI 助手（可选）**：通过 API Key 接入，按需开启，不强制依赖

---

## 🤖 AI 助手（可选，OpenAI 兼容接口）

本项目的 AI 对话采用 **OpenAI Chat Completions 兼容接口**（`/chat/completions`），并使用 **SSE 流式输出**（`stream: true`）。

你可以在应用内为每个「会话 / 智能体」单独配置：

- 🔑 `API Key`
- 🌐 `API Base URL`（示例：`https://api.deepseek.com/chat/completions`）
- 🧠 `Model`（示例：`deepseek-chat`）
- 🧾 `System Prompt`（系统提示词）
- 🧪 采样参数：`temperature` / `presence_penalty` / `frequency_penalty` / `max_tokens`

### ⚙️ 在哪里配置？

在对话页打开 **「对话设定(Agent)」→「模型」** 即可填写 `API Key / API Base URL / Model`。

### 🛡️ 隐私提示

当你启用 AI 并发送消息时，**你选择发送的内容会被传输到你填写的 API 服务提供方**；未配置 Key 或不使用 AI 时，不会产生请求。

### ✳️ 可选：标点保护（logit_bias）

应用支持可选的 `logit_bias`（用于提高中文标点输出倾向）。若你所使用的服务端不支持该字段，客户端会自动回退并提示。

---

## 🗄️ 备份与恢复

- 📦 备份文件为 **`.json`**
- 📋 支持在备份列表中：**恢复 / 删除**
- 🕒 应用会在**每次启动时自动创建备份**（见备份页提示）

> ⚠️ 注意：恢复会覆盖当前书架数据，请谨慎操作。

---

## 🧑‍💻 开发者快速开始（Expo）

1) 安装依赖

```bash
npm install
```

2) 本地启动（清缓存）

```bash
npx expo start -c
```

3) EAS 打包（Android / preview）

```bash
eas build -p android --profile preview
```

---

## 🧭 项目结构

- `src/screens`：页面（书架、编辑器、对话、备份等）
- `src/components`：通用组件（会话面板、设定面板等）
- `src/storage`：本地数据存储与持久化
- `src/styles`：主题与全局样式
- `src/utils`：工具函数（如 LLM API 客户端封装）

---

## 🤝 贡献

欢迎提交 Issues / PR，一起完善更好用的离线写作工具。

---

## 📄 License

MIT
