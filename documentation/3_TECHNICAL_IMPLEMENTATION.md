# Technical Implementation Details

This document tracks how specific features are handled under the hood in `App.jsx`.

## Document Storage Flow
1. **Import**: When a user selects a file (PDF or Image), it is read via the `FileReader` API as a `DataURL` (Base64 string).
2. **Persistence**: The Base64 string, along with metadata (title, type, timestamp, color), is stored as an object in the `documents` object store of IndexedDB.
3. **Retrieval**: Upon app launch, the database is queried, and the state is populated with all documents sorted by timestamp.

## Rendering PDFs & Images
- **Images**: Rendered directly using standard `<img>` tags with the `blobUrl`.
- **PDFs**: Handled via `react-pdf`. 
    - A dedicated **Worker** is configured via a CDN to handle the heavy lifting of PDF parsing outside the main UI thread.
    - The viewer maps through all pages and renders them as high-quality canvases.
- **Blob Conversion**: Since we store DataURLs, we use a helper `base64ToBlob` to convert strings back into binary Blobs at runtime. This is crucial for the PDF viewer to function correctly.

## Native Export Strategy
Android handles files differently than browsers. The export logic follows these steps:
1. Serialize the entire IndexedDB content into a JSON string.
2. Use `Filesystem.writeFile` to save this string as a file in the **Cache Directory**.
3. Pass the resulting file **URI** to the `Share.share` plugin.
4. This triggers the native Android dialog, bypassing the limitations of "Browser Downloads" and allowing true system integration.

## Performance Optimizations
- **Static Imports**: Removed all dynamic `import()` calls that were previously used for sandbox compatibility. This results in a smaller, faster-loading APK.
- **Text Layer Suppression**: The PDF viewer disables the `textLayer` and `annotationLayer` by default. This significantly increases rendering speed on mobile devices while keeping the document readable.
- **Z-Index Management**: 
    - Header: `z-[60]`
    - Floating Action Button (Plus): `z-[70]`
    - Modal Viewer: `z-[100]`
    - Status Alerts: `z-[200]`
    - This ensures the UI layers never conflict during complex scroll maneuvers.

## Versioning
The app version is dynamically imported from `package.json`. This ensures that updating the version for a GitHub release automatically updates the version number displayed in the app's Settings menu.
