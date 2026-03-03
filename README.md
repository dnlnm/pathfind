# <img src="./public/favicon.ico" width="32" height="32" valign="middle"> PathFind

[![Next.js](https://img.shields.io/badge/Next.js-15%2F16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-FTS5-003B57?style=for-the-badge&logo=sqlite)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

**PathFind** is a premium, self-hosted, AI-assisted personal bookmark and collection manager. Built with **Next.js 16** and **Tailwind CSS 4**, it provides a centralized, beautiful space to collect, organize, and instantly retrieve links, articles, and media from across the web.

![PathFind Ecosystem Mockup](pathfind_ecosystem_mockup_1772558683406.png)

---

## 🌐 The PathFind Ecosystem

PathFind is more than just a web app. It's a complete cross-platform bookmarking solution:

- **[PathFind Web](https://github.com/dnlnm/pathfind)**: The core self-hosted server and dashboard.
- **[PathFind Extension](https://github.com/dnlnm/pathfind-ext)**: Browser extension for Chrome, Edge, and Firefox.
- **[PathFind iOS](https://github.com/dnlnm/pathfind-ios)**: Native SwiftUI mobile app for iPhone.
- **[PathFind Android](https://github.com/dnlnm/pathfind-kt)**: Native Kotlin & Compose mobile app.

---

## ✨ Features

- **🧠 AI-Powered Insights**: Integrates with **Google Gemini** to automatically summarize content, extract key points, and suggest organization.
- **🖼️ Rich Media Clipping**: Automatically fetches high-quality thumbnails, favicons, and metadata for every link you save.
- **🔍 Lightning-Fast Search**: Instant full-text search (FTS5) across titles, descriptions, and notes.
- **📁 Organized Collections**: Create custom collections and use nested tags to keep your digital life structured.
- **📥 Smart Workflows**: Built-in "Read Later" and "Archive" states to help you manage your digital consumption.
- **🤖 Automations**: 
  - **GitHub Sync**: Automatically import your starred repositories.
  - **Reddit Sync**: Keep track of your saved Reddit posts via RSS.
  - **Telegram Bot**: Save links via a dedicated Telegram bot on the go.
- **📱 PWA Ready**: Install PathFind as an app on your phone with native share sheet integration.

---

## 🚀 Getting Started

### Option 1: Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/dnlnm/pathfind.git
   cd pathfind
   ```
2. Configure your environment:
   ```bash
   cp .env.sample .env
   # Edit .env with your ADMIN_EMAIL, ADMIN_PASSWORD, and AI keys
   ```
3. Launch:
   ```bash
   docker-compose up -d
   ```
4. Access at `http://localhost:3000`.

### Option 2: Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Setup environment**:
   Create a `.env` file (refer to `.env.sample`).
3. **Run development server**:
   ```bash
   npm run dev
   ```

---

## 🛠 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **Database**: [SQLite](https://www.sqlite.org/) via `better-sqlite3` (with [sqlite-vec](https://github.com/asg017/sqlite-vec) for embeddings)
- **Auth**: [Auth.js (NextAuth)](https://authjs.dev/)
- **AI**: [Google Generative AI (Gemini)](https://ai.google.dev/)
- **PWA**: [@ducanh2912/next-pwa](https://github.com/ducanh2912/next-pwa)

---

## 🤝 Contributing

We welcome contributions! Please feel free to open issues or submit pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

