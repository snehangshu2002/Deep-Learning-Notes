# 🧠 Deep Learning Notes — Personal Knowledge Base

A high-performance, full-stack study platform designed for organized deep learning research. Built with a "vibe coding" approach, this project features a modern dark-mode interface, real-time AI assistance, and a custom-built administrative pipeline.

![Deep Learning Notes Banner](https://img.shields.io/badge/Vibe--Coded-With%20AI-orange?style=for-the-badge&logo=openai)
![Tech Stack](https://img.shields.io/badge/Stack-Firebase%20%7C%20GitHub%20API%20%7C%20Mistral-blue?style=for-the-badge)

---

## ✨ Key Features

- **📂 Dynamic Note Management**: Automatically groups notes by category (RNN, CNN, Transformers, etc.) with real-time sync from Firestore.
- **🔍 Full-Text Search**: Instant search across all notes. Uses **PDF.js** to index content inside PDF files and smart DOM parsing for HTML notes.
- **🤖 Integrated AI Assistant**: A RAG-powered (Retrieval-Augmented Generation) chatbot using **Mistral AI** that answers questions based on the specific note you are reading.
- **🛠️ Professional Admin Panel**: Secure dashboard for uploading new notes. Automatically uploads files to GitHub via REST API and syncs metadata to Firestore.
- **📄 Multi-Format Viewer**: Seamlessly view PDFs, interactive HTML notes, and images with built-in zoom controls (50%–250%).
- **📱 Responsive Design**: Fully optimized for mobile and desktop with a collapsible sidebar and auto-hiding UI elements.

## 🏗️ Technical Architecture

This project uses a unique "Serverless + Git" architecture:
- **Hosting**: Deployed via [Vite](https://vitejs.dev/) for fast performance.
- **Database**: [Firebase Firestore](https://firebase.google.com/products/firestore) for metadata and note cataloging.
- **Storage**: Files are stored in a **GitHub Repository** and served through the **jsDelivr CDN** to ensure proper CORS headers and MIME types.
- **Authentication**: [Firebase Auth](https://firebase.google.com/products/auth) for secure administrative access.
- **AI Integration**: [Mistral AI API](https://mistral.ai/) for the study assistant, with clipboard-based fallbacks to ChatGPT and Claude.

## 🚀 Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/snehangshu-code/Deep-Learning-Notes.git
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   VITE_FIREBASE_API_KEY=your_key
   VITE_FIREBASE_AUTH_DOMAIN=your_domain
   VITE_FIREBASE_PROJECT_ID=your_id
   VITE_GITHUB_TOKEN=your_gh_token
   VITE_GITHUB_OWNER=your_username
   VITE_GITHUB_REPO=your_repo
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```

## 🛠️ Project Evolution
This project was built using an **AI-first "vibe coding" methodology**. As the technical director, I defined the architecture, managed the state-space of the application, and used high-level instructions to generate and refine over 1,500+ lines of production-grade JavaScript, CSS, and HTML.

---

> [!TIP]
> This project is perfect for students who want a centralized, searchable, and AI-powered place for their research notes.

## 📄 License
This project is licensed under the **MIT License**. See the `LICENSE` file for details.
