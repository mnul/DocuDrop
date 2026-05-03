# Architectural Decisions & Concepts

DocuDrop follows a modern "Hybrid Native" architecture. This allows for rapid UI development using the React ecosystem while utilizing native Android capabilities.

## The Tech Stack

### 1. Frontend: React & Vite
- **Vite**: Chosen as the build tool for its extremely fast Hot Module Replacement (HMR) and optimized build pipeline.
- **React 19**: Provides a declarative way to manage the complex UI states (search, settings, document selection).

### 2. Styling: Tailwind CSS 4
- Used for utility-first styling.
- Leverages modern CSS features like `backdrop-blur` for the header and `snap-y` for the wallet carousel.
- Implements a robust Dark Mode system that respects system preferences but allows manual overrides.

### 3. Bridge: Capacitor (Ionic)
- Capacitor acts as the bridge between the Web App and the Android OS.
- **Plugins Used**:
    - `@capacitor/filesystem`: Essential for writing temporary JSON files during the export process.
    - `@capacitor/share`: Provides access to the native Android Share Sheet, allowing users to save backups to Drive, Email, or other apps.

### 4. Storage: IndexedDB
- Instead of simple `localStorage` (which has size limits and performance issues), DocuDrop uses **IndexedDB**.
- **Why?**: It allows for storing large binary objects (Base64 encoded files) and provides a non-blocking, transactional database environment within the WebView.

## Key Design Concepts

### The "Sticky Squeeze" Carousel
The vertical scrolling list uses a unique combination of `sticky` positioning and dynamic `top` offsets based on the card index.
- **Overlapping**: Cards have a negative top margin to look like a stack.
- **Squeezing**: As the user scrolls up, cards "pile up" at the top of the viewport. Only a sliver of the previous card remains visible, mimicking the behavior of an accordion or a physical wallet.

### Color Coding
To aid visual recognition, cards are automatically assigned a color from a curated high-contrast palette during import. This allows users to associate specific documents (e.g., "The Blue Card") with their content without reading the title.