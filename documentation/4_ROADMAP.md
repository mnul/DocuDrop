# DocuDrop Roadmap

## Current State (v0.1.1)
- [x] Vertical "Wallet" Carousel UI.
- [x] IndexedDB persistent storage.
- [x] PDF and Image support.
- [x] Search functionality.
- [x] Native Android Export (Share Sheet) and Import.
- [x] Dark Mode support.
- [x] Dynamic versioning from `package.json`.

## Short-Term Goals (Next Releases)

### 1. Document Management
- **Make opened items zoomable**: Opened items (cards) are currently not zoomable and can end up very small. Implement a pinch-to-zoom gesture.
- **Reorganizing Cards**: Implement a long-press and drag-and-drop system to allow users to manually reorder their stack.
- **Easier Deletion**: Add swipe-to-delete gestures on the cards in the main view to complement the current permanent deletion inside the viewer.

### 2. Android System Integration
- **Share-To-DocuDrop**: Register the app as a recipient for the Android "Share" menu. This will allow users to send a PDF from their Email or Browser directly into the DocuDrop vault without opening the app first.

## Long-Term Vision
- **Encryption**: Add optional biometric (Fingerprint/Face) lock for the entire vault.
- **OCR Preview**: Automatically extract text from documents to improve search results.
