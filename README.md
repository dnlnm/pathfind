# Pathfind

Pathfind is a powerful, self-hosted, AI-assisted personal bookmark and collection manager. Built with Next.js 15, it provides a centralized place to collect, organize, and quickly retrieve links, articles, repositories, and media across the web.

## ✨ Features

- **Rich Bookmark Management**: Save links and organize them using Tags and Collections. Keep your inbox clear with "Archive" and "Read Later" workflows.
- **Automated Metadata & Thumbnails**: Automatically fetches titles, descriptions, favicons, and high-quality thumbnails for saved URLs.
- **Lightning Fast Search**: Powered by SQLite FTS5 for instant Full-Text Search across titles, descriptions, URLs, and notes.
- **AI-Powered**: Integrates Google Generative AI (Gemini) to help summarize and optionally organize your curated content.
- **Companion Apps & Integrations**:
  - **Chrome Extension**: Quickly save the page you're viewing directly into Pathfind.
  - **PWA Share Sheet integration**: Send links to Pathfind straight from your mobile OS's native share menu.
  - **Telegram Bot**: Message a dedicated bot to instantly save links while on the go.
  - **GitHub Sync**: Automatically sync your GitHub starred repositories.
  - **Reddit Sync**: Automatically import your saved Reddit posts via RSS.
- **Modern, Responsive UI**: A beautiful, desktop and mobile-friendly interface designed with Tailwind CSS and Radix UI (shadcn/ui), complete with automatic dark mode.
- **Designed for Self-Hosting**: A robust Next.js app running with Better-SQLite3 means zero complex external database setup. Everything runs locally out of the box.

## 🚀 Getting Started

You can run Pathfind either through Docker (recommended for production) or locally using Node.js.

### Option 1: Docker (Recommended)

1. Clone the repository and navigate to the root directory.
2. Create your `.env` file from the example below.
3. Start the application:
   ```bash
   docker-compose up -d
   ```
4. Access the app at `http://localhost:3000`. Your database will persist in the mapped `./data` directory.

### Option 2: Local Setup

1. **Install Dependencies**
   ```bash
   npm install
   # or yarn / pnpm / bun
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   AUTH_SECRET="your-random-strong-secret-in-production"
   ADMIN_EMAIL="admin@pathfind.local"
   ADMIN_PASSWORD="super-strong-password"
   
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   AUTH_URL="http://localhost:3000"
   AUTH_TRUST_HOST=true
   
   # Optional Integrations
   # TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
   # TELEGRAM_BOT_USERNAME="your_bot_username"
   ```

3. **Start the Development Server**
   ```bash
   npm run dev
   ```
   *(For experimental HTTPS locally, run `npm run dev:https`)*

4. Open [http://localhost:3000](http://localhost:3000) and login with your configured admin credentials.

## 🧩 Browser Extension

Pathfind comes with a companion Chrome extension that makes clipping web pages frictionless. Located inside the `chrome-extension` directory, it connects securely to your personal instance using API Tokens (you can generate API keys directly from your Settings page).

1. Navigate to the `chrome-extension/` folder.
2. Follow its setup instructions to build and load the unpacked extension in Chrome/Edge/Brave.

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: SQLite (via `better-sqlite3`)
- **Authentication**: NextAuth.js (Auth.js)
- **Styling**: Tailwind CSS, CSS Variables, Shadcn UI
- **AI Integration**: `@google/generative-ai` SDK
- **PWA**: Next-PWA for offline support & app-like behavior

## 🤝 Contributing

Contributions, issues, and feature requests are very welcome! Feel free to review the issue tracker or submit a Pull Request.
