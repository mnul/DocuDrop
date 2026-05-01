# Docu Drop

Docu Drop is a mobile-first, entirely offline web application designed to store and organize travel documents, tickets, and boarding passes. It features a sleek, overlapping stacked-card interface inspired by a digital wallet app.

> **Vibe-coded with Google Gemini** The core logic, user interface, and database architecture of this application were generated iteratively using Google's Gemini model.

---

## Features

- **100% Offline**: Uses the browser's native IndexedDB to permanently store binary files (PDFs and images) locally on your device. No servers, no cloud storage, no privacy concerns.
- **Wallet UI**: Documents are visually organized into a stack of overlapping, color-coded cards for quick visual parsing and a premium feel.
- **Format Support**: Seamlessly accepts both image files (`.jpg`, `.png`) and `.pdf` documents.
- **Integrated Viewer**: Full-screen modal to view images and read PDFs directly within the app.
- **Quality of Life**:
  - Global search for quick access.
  - Instantaneous Dark/Light mode toggling.
  - Persistent storage across browser sessions.

---

## Tech Stack

- **Frontend:** React (via Vite)
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React
- **Storage:** Native IndexedDB API

---

## Local Development

To get Docu Drop running on your machine:

1. **Clone the repository**
   ```bash
   git clone https://github.com/mnul/DocuDrop.git
   cd DocuDrop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

---

## Future Roadmap

### Android Support
This React PWA is designed to be easily wrapped into a native Android APK using tools like Capacitor or AppsGeyser, maintaining its offline capabilities through WebView's access to local storage.