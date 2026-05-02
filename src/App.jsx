import React, { useState, useEffect, useRef } from 'react';
import { Search, Moon, Sun, Plus, X, FileText, Image as ImageIcon, Trash2, Settings, Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

// NOTE: For your local project, ensure you have run: npm install react-pdf
// The following imports are handled dynamically to prevent preview errors
let Document = null;
let Page = null;
let pdfjs = null;

/**
 * PDF Worker Configuration
 * We use a dynamic check to only initialize PDF features if the library is present.
 * In your local Android Studio project, make sure react-pdf is installed.
 */
const initializePdf = async () => {
  try {
    const reactPdf = await import('react-pdf');
    Document = reactPdf.Document;
    Page = reactPdf.Page;
    pdfjs = reactPdf.pdfjs;
    
    // Set worker from CDN for better compatibility
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
    return true;
  } catch (e) {
    console.warn("react-pdf not found. PDF rendering will be disabled in this preview.");
    return false;
  }
};

// --- IndexedDB Configuration ---
const DB_NAME = 'DocuDropDB';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject('Error opening database');
    request.onsuccess = (e) => resolve(e.target.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const saveDocument = async (doc) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(doc);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Save failed');
  });
};

const loadDocuments = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject('Load failed');
  });
};

const deleteDocumentDB = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Delete failed');
  });
};

const base64ToBlob = (base64, type) => {
  try {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type });
  } catch (e) {
    return null;
  }
};

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [pdfReady, setPdfReady] = useState(false);
  
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

  const refreshDocs = () => {
    loadDocuments().then(data => {
      setDocuments(data.sort((a, b) => b.timestamp - a.timestamp));
    }).catch(console.error);
  };

  useEffect(() => {
    refreshDocs();
    initializePdf().then(ready => setPdfReady(ready));
    
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#111827';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#F3F4F6';
    }
  }, [isDarkMode]);

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  // Status message auto-hide
  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      const title = prompt('Enter document title:') || file.name.split('.')[0];
      const newDoc = {
        id: Date.now().toString(),
        title: title,
        type: file.type,
        data: base64Data,
        color: colors[documents.length % colors.length],
        timestamp: Date.now()
      };
      await saveDocument(newDoc);
      refreshDocs();
      setStatus({ type: 'success', message: 'Document added to vault.' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSelectDoc = (doc) => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const blob = base64ToBlob(doc.data, doc.type);
    if (!blob) {
      setStatus({ type: 'error', message: 'Failed to process document data.' });
      return;
    }
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    setNumPages(null);
    setSelectedDoc(doc);
  };

  const exportData = async () => {
    try {
      const data = await loadDocuments();
      if (data.length === 0) {
        setStatus({ type: 'error', message: 'No documents to export.' });
        return;
      }

      const defaultName = `docudrop_backup_${new Date().toISOString().split('T')[0]}`;
      const fileName = prompt("Enter backup filename:", defaultName) || defaultName;
      const fullFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;

      setIsProcessing(true);
      
      // Delay to allow UI processing state to show
      setTimeout(async () => {
        try {
          const json = JSON.stringify(data);
          const blob = new Blob([json], { type: 'application/json' });
          
          // Using Share API first for Android integration
          if (navigator.share) {
            const file = new File([blob], fullFileName, { type: 'application/json' });
            try {
              await navigator.share({
                files: [file],
                title: 'Docu Drop Backup',
                text: 'Vault Export'
              });
              setStatus({ type: 'success', message: 'Export initiated.' });
            } catch (shareErr) {
              if (shareErr.name !== 'AbortError') {
                downloadFallback(blob, fullFileName);
              }
            }
          } else {
            downloadFallback(blob, fullFileName);
          }
        } catch (innerErr) {
          setStatus({ type: 'error', message: 'Memory error: backup too large.' });
        } finally {
          setIsProcessing(false);
          setIsSettingsOpen(false);
        }
      }, 200);

    } catch (err) {
      setIsProcessing(false);
      setStatus({ type: 'error', message: 'Failed to read database.' });
    }
  };

  const downloadFallback = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus({ type: 'success', message: 'Download triggered.' });
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedDocs = JSON.parse(event.target.result);
        if (!Array.isArray(importedDocs)) throw new Error('Invalid backup format');
        
        if (window.confirm(`Import ${importedDocs.length} documents? This merges with existing data.`)) {
          setIsProcessing(true);
          for (const doc of importedDocs) {
            await saveDocument(doc);
          }
          refreshDocs();
          setIsProcessing(false);
          setStatus({ type: 'success', message: `Imported ${importedDocs.length} documents.` });
          setIsSettingsOpen(false);
        }
      } catch (err) {
        setStatus({ type: 'error', message: 'Invalid backup file format.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredDocs = documents.filter(d => 
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans pb-24">
      {/* Toast Notification */}
      {status && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            status.type === 'success' 
            ? 'bg-emerald-500 border-emerald-400 text-white' 
            : 'bg-red-500 border-red-400 text-white'
          }`}>
            {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="font-bold text-sm">{status.message}</span>
          </div>
        </div>
      )}

      <header className="px-6 pt-12 pb-6 flex justify-between items-center sticky top-0 z-50 bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur-sm">
        <h1 className="text-3xl font-black tracking-tight flex items-baseline gap-2">
          Docu Drop <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded border border-blue-500/20 uppercase tracking-widest">v0.1</span>
        </h1>
        <div className="flex gap-2 items-center">
          <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full active:scale-95 transition-transform">
            <Search size={20} />
          </button>
          <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full active:scale-95 transition-transform">
            <Settings size={20} />
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full active:scale-95 transition-transform">
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {isSettingsOpen && (
        <div className="px-6 mb-6 animate-in slide-in-from-top duration-300">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest opacity-50 px-1">Backup & Restore</h2>
            
            {isProcessing ? (
              <div className="flex items-center justify-center p-6 gap-3">
                <Loader2 className="animate-spin text-blue-500" />
                <span className="text-sm font-medium">Processing Data...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={exportData}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-2xl transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                >
                  <Download size={24} className="text-blue-500" />
                  <span className="font-bold text-xs uppercase tracking-tighter">Export</span>
                </button>
                <button 
                  onClick={() => importInputRef.current.click()}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-2xl transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                >
                  <Upload size={24} className="text-emerald-500" />
                  <span className="font-bold text-xs uppercase tracking-tighter">Import</span>
                </button>
              </div>
            )}
            <input type="file" accept=".json" className="hidden" ref={importInputRef} onChange={importData} />
            <p className="text-[10px] text-center opacity-40 italic">Use export to save a JSON file to your device.</p>
          </div>
        </div>
      )}

      {isSearchOpen && (
        <div className="px-6 mb-4">
          <input 
            type="text" 
            placeholder="Search vault..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500 shadow-sm transition-all" 
          />
        </div>
      )}

      <main className="px-6 relative flex flex-col items-center">
        {filteredDocs.length === 0 ? (
          <div className="mt-20 text-center text-gray-400 opacity-50 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
              <FileText size={32} />
            </div>
            <p className="font-medium">Vault is currently empty</p>
          </div>
        ) : (
          <div className="relative w-full max-w-sm" style={{ height: `${(filteredDocs.length - 1) * 70 + 220}px` }}>
            {filteredDocs.map((doc, index) => (
              <div 
                key={doc.id} 
                onClick={() => handleSelectDoc(doc)} 
                className="absolute w-full rounded-2xl shadow-xl transition-all cursor-pointer overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:-translate-y-2 active:scale-[0.98]" 
                style={{ top: `${index * 70}px`, zIndex: index, height: '220px', transformOrigin: 'top center' }}
              >
                <div className="h-16 w-full px-5 flex items-center justify-between" style={{ backgroundColor: doc.color }}>
                  <h2 className="font-bold text-white truncate pr-4 drop-shadow-md">{doc.title}</h2>
                  {doc.type.includes('image') ? <ImageIcon color="white" size={20} /> : <FileText color="white" size={20} />}
                </div>
                <div className="p-4 h-[calc(100%-4rem)] flex items-center justify-center">
                  {doc.type.includes('image') ? (
                    <div className="w-full h-full bg-cover bg-center rounded-lg shadow-inner" style={{ backgroundImage: `url(${doc.data})` }} />
                  ) : (
                    <div className="w-full h-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
                      <FileText size={32} className="text-gray-400 mb-2" />
                      <span className="text-gray-400 text-[10px] font-black tracking-widest uppercase">PDF DOCUMENT</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <input type="file" accept="image/*,application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
      
      <button 
        onClick={() => fileInputRef.current.click()} 
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 active:scale-90 transition-transform hover:bg-blue-700"
      >
        <Plus size={32} />
      </button>

      {/* Fullscreen Viewer */}
      {selectedDoc && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex justify-between items-center p-4 bg-black/50 text-white border-b border-white/10">
            <h2 className="font-bold text-xl truncate pr-4">{selectedDoc.title}</h2>
            <div className="flex gap-4">
              <button 
                onClick={async () => { if(window.confirm('Permanently delete this document?')){ await deleteDocumentDB(selectedDoc.id); refreshDocs(); setSelectedDoc(null); setStatus({ type: 'success', message: 'Deleted.' }); } }} 
                className="p-2 bg-red-600 rounded-full"
              >
                <Trash2 size={20} />
              </button>
              <button onClick={() => { setSelectedDoc(null); setBlobUrl(null); }} className="p-2 bg-gray-800 rounded-full"><X size={20} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center">
            {selectedDoc.type.includes('image') ? (
              <img src={blobUrl} alt={selectedDoc.title} className="max-w-full rounded-lg shadow-2xl" />
            ) : (
              <div className="w-full h-full flex flex-col items-center">
                {pdfReady && Document ? (
                  <Document
                    file={blobUrl}
                    onLoadSuccess={({numPages}) => setNumPages(numPages)}
                    loading={<div className="text-white mt-10">Preparing document...</div>}
                    className="flex flex-col items-center"
                  >
                    {Array.from(new Array(numPages || 0), (el, index) => (
                      <Page 
                        key={index} 
                        pageNumber={index + 1} 
                        width={Math.min(window.innerWidth - 32, 600)} 
                        className="mb-4 shadow-2xl rounded-sm overflow-hidden" 
                        renderTextLayer={false} 
                        renderAnnotationLayer={false} 
                      />
                    ))}
                  </Document>
                ) : (
                  <div className="text-white mt-20 text-center flex flex-col items-center gap-4">
                    <AlertCircle size={48} className="text-yellow-500" />
                    <p className="max-w-xs text-sm opacity-70">
                      PDF preview library not installed in this environment. 
                      <br/><br/>
                      Run <b>npm install react-pdf</b> in your local project to enable viewer.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}