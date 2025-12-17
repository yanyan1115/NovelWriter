# NovelWriter App（小说作家应用）

**NovelWriter App** is a mobile writing application designed for novel authors. It provides a clean, efficient, and powerful creative environment, allowing you to capture inspiration, build worlds, and write stories anytime, anywhere. The project is built with **React Native** and currently supports Android.

**NovelWriter App** 是一款专为小说创作者设计的移动端写作工具。它提供了一个简洁、高效且功能强大的创作环境，让你可以随时随地捕捉灵感、构建世界、撰写故事。项目采用 **React Native** 构建，目前支持 Android 平台。

---

## ✨ Core Features / 核心功能

### 📚 Bookshelf & Story Structure Management / 书架与结构管理

Organize your novels with a clear **Volume / Chapter** hierarchy, making long-form stories easy to manage.
支持 **卷 / 章** 两级目录结构，帮助你清晰地组织和管理长篇小说内容。

### ✍️ Immersive Editor / 沉浸式编辑器

A distraction-free writing interface that keeps your focus on storytelling.
提供无干扰的写作界面，让注意力始终聚焦在文字创作本身。

### 🤖 AI Writing Assistance (Optional) / AI 写作辅助（可选）

Integrated AI assistant features for:
集成 AI 辅助模块，可用于：

* Sparking creative ideas / 激发创作灵感
* Generating story outlines / 生成故事大纲
* Polishing and rewriting text / 辅助润色与改写文本

> AI features are optional and disabled by default. Users must configure their own API key.
> AI 功能为可选模块，默认关闭，需用户自行配置 API Key。

### 🎨 Customizable Themes / 个性化主题

Built-in light and dark themes with easy switching to suit different writing environments.
内置日间 / 夜间模式，支持主题切换，适应不同写作环境，减轻视觉疲劳。

### 🔒 Offline-First & Local Data Storage / 离线优先与数据本地化

All content is stored locally on your device, enabling **offline writing** and ensuring data privacy.
所有创作内容默认保存在本地设备中，支持 **离线写作**，保障数据隐私与安全。

### 🔄 Backup & Restore / 备份与恢复

Reliable backup and restore mechanisms to protect your work from accidental loss.
提供可靠的备份与恢复机制，防止意外丢失重要创作内容。

---

## 🗂️ Project Structure / 项目结构

* `src/screens` — Application screens (bookshelf, editor, AI assistant, etc.)  
  应用页面（书架、编辑器、AI 助手等）
* `src/components` — Reusable UI components  
  可复用 UI 组件
* `src/storage` — Local data persistence and storage logic  
  本地数据存储与持久化
* `src/styles` — Global styles and theme management  
  全局样式与主题管理
* `src/utils` — Shared utility functions (e.g. AI API wrappers)  
  通用工具函数（如 AI 接口封装）

---

## 🛠️ Tech Stack / 技术栈

* **Framework / 框架**: React Native
* **Language / 语言**: JavaScript
* **State Management / 状态管理**: React Context API
* **Data Storage / 数据存储**: AsyncStorage (or other local storage solutions)
* **Navigation / 导航**: React Navigation

---

## 🚀 Getting Started / 快速开始

1. **Clone the repository / 克隆仓库**

   ```bash
   git clone https://github.com/your-username/novel-author-app.git
   cd novel-author-app
   ```

2. **Install dependencies / 安装依赖**

   ```bash
   npm install
   ```

3. **Run the app / 运行应用**

   * Android:

     ```bash
     npx react-native run-android
     ```

---

## 🤝 Contributing / 贡献

Issues and Pull Requests are welcome to help improve NovelWriter App.

欢迎提交 **Issues** 或 **Pull Requests**，一起让 NovelWriter App 变得更好。

---

## 📄 License

This project is licensed under the MIT License.

本项目采用 MIT License。
