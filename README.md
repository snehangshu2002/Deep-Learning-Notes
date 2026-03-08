# 🧠 Deep Learning Notes — Personal Knowledge Base

A high-performance, full-stack study platform designed for organized deep learning research. Built with a "vibe coding" approach, this project features a modern dark-mode interface, real-time AI assistance, and a custom-built administrative pipeline.

![Deep Learning Notes Banner](https://img.shields.io/badge/Vibe--Coded-With%20AI-orange?style=for-the-badge&logo=openai)
![Tech Stack](https://img.shields.io/badge/Stack-Firebase%20%7C%20GitHub%20API%20%7C%20Mistral-blue?style=for-the-badge)
![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=for-the-badge&logo=vercel)

---

## 💡 Origin Story

This project started from a simple frustration: every time I asked AI to explain a deep learning concept — RNNs, LSTMs, attention mechanisms — I'd get back beautiful, interactive HTML visualizations that would disappear into chat history forever.

So I built a permanent home for them. A website where I can upload those notes, search inside them, and revisit them from anywhere.

---

## ✨ Key Features

- **📂 Dynamic Note Management** — Automatically groups notes by category (RNN, CNN, Transformers, etc.) with real-time sync from Firestore.
- **🔍 Full-Text Search** — Instant search across all notes. Uses **PDF.js** to index content inside PDF files and smart DOM parsing for HTML notes — searches *inside* documents, not just titles.
- **🤖 Integrated AI Assistant** — A RAG-powered (Retrieval-Augmented Generation) chatbot using **Mistral AI** that answers questions based on the specific note you are currently reading.
- **🔀 One-Click AI Fallback** — If Mistral can't explain something well enough, click the ChatGPT or Claude icon and your entire note context + conversation history is automatically copied to clipboard and the AI site opens instantly. Zero copy-paste friction.
- **🛠️ Professional Admin Panel** — Secure dashboard for uploading new notes. Automatically uploads files to GitHub via REST API and syncs metadata to Firestore.
- **📄 Multi-Format Viewer** — Seamlessly view PDFs, interactive HTML notes, and images with built-in zoom controls (50%–250%).
- **📱 Responsive Design** — Fully optimized for mobile and desktop with a collapsible sidebar and auto-hiding UI elements.
- **🔗 Deep Link Navigation** — Every note has a shareable URL via hash-based routing (`#note=id`).

---

## 🏗️ Technical Architecture

This project uses a unique **"Serverless + Git"** architecture:

| Layer | Technology |
|---|---|
| Build Tool | [Vite](https://vitejs.dev/) — modern JS bundler |
| Frontend | Vanilla JS + ES Modules (no framework) |
| Database | [Firebase Firestore](https://firebase.google.com/products/firestore) |
| File Storage | GitHub Repository → served via [jsDelivr CDN](https://www.jsdelivr.com/) |
| Authentication | [Firebase Auth](https://firebase.google.com/products/auth) |
| AI Assistant | [Mistral AI API](https://mistral.ai/) with RAG |
| AI Fallback | One-click context copy to ChatGPT / Claude |
| PDF Parsing | [PDF.js](https://mozilla.github.io/pdf.js/) (client-side, no server needed) |
| Deployment | [Vercel](https://vercel.com/) via GitHub CI |

**Why GitHub as storage?** Files are committed to a GitHub repo and served through the jsDelivr CDN — this gives proper CORS headers, correct MIME types, and free global CDN delivery without needing a paid storage service.

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/snehangshu2002/Deep-Learning-Notes.git
cd Deep-Learning-Notes
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up Environment Variables
Create a `.env` file in the root directory:
```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GITHUB_TOKEN=your_gh_token
VITE_GITHUB_OWNER=your_username
VITE_GITHUB_REPO=your_repo
VITE_GITHUB_BRANCH=main
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```

### 6. Deploy to Vercel
Connect your GitHub repo to [Vercel](https://vercel.com/). Set:
- **Build command:** `npm run build`
- **Output directory:** `dist`
- Add all `.env` variables in Vercel's Environment Variables settings.

---

## 📁 Project Structure

```
├── index.html          # Main app layout (sidebar, iframe viewer, chat widget)
├── admin.html          # Admin dashboard (auth, upload form, file manager)
├── main.js             # Core app — sidebar, search, zoom, ToC, Firebase fetch
├── admin.js            # Admin logic — GitHub API upload/delete, Firestore CRUD
├── chat.js             # AI chatbot — Mistral API, RAG, ChatGPT/Claude fallback
├── firebase.js         # Firebase SDK initialization
├── style.css           # Main design system (dark theme, responsive, animations)
├── admin.css           # Admin-specific styles
├── vite.config.js      # Build configuration
└── public/
    └── notes/          # Local HTML notes live here
```

---

## 🛠️ How to Add Notes

See [`HOW_TO_ADD_NOTES.md`](./HOW_TO_ADD_NOTES.md) for a full guide. The short version:

1. Place your `.html` file in `public/notes/`
2. Register it in the `NOTES` array in `main.js`
3. Or use the **Admin Panel** to upload PDFs, HTML, or images directly from the browser — no code editing required.

---

## 🧪 Project Evolution

This project was built using an **AI-first "vibe coding" methodology**. As the technical director, I defined the architecture, managed the feature set, and used high-level instructions to generate and refine over 1,500+ lines of production-grade JavaScript, CSS, and HTML.

The idea was born from a real workflow: using AI to generate interactive explanations of deep learning concepts, then needing somewhere permanent to store and revisit them.

---

> [!TIP]
> This project is perfect for students who want a centralized, searchable, and AI-powered place for their research notes.

---

## 📄 License

This project is licensed under the **MIT License**. See the [`LICENSE`](./LICENSE) file for details.
