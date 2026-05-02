import React, { useState, useEffect, useRef } from 'react';
import { Search, Moon, Sun, Plus, X, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

// CSS for react-pdf (Required for rendering PDF pages correctly)
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// PDF Worker configuration
// Using CDN for better compatibility across environments
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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

// Helper: Base64 to Blob (Optimized for memory management in WebViews)
const base64ToBlob = (base64, type) => {
  const byteCharacters = atob(base64.split(',')[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type });
};

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const fileInputRef = useRef(null);

  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

  useEffect(() => {
    loadDocuments().then(data => {
      setDocuments(data.sort((a, b) => b.timestamp - a.timestamp));
    }).catch(console.error);

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
      setDocuments(prev => [newDoc, ...prev]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSelectDoc = (doc) => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const blob = base64ToBlob(doc.data, doc.type);
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    setNumPages(null);
    setSelectedDoc(doc);
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const filteredDocs = documents.filter(d => 
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans pb-24">
      {/* Header */}
      <header className="px-6 pt-12 pb-6 flex justify-between items-center sticky top-0 z-50 bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur-sm">
        <h1 className="text-3xl font-black tracking-tight">
          Docu Drop <span className="text-xs font-normal opacity-50">v0.1</span>
        </h1>
        <div className="flex gap-4 items-center">
          <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full active:scale-95 transition-transform">
            <Search size={20} />
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full active:scale-95 transition-transform">
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Search Bar */}
      {isSearchOpen && (
        <div className="px-6 mb-4">
          <input 
            type="text" 
            placeholder="Search documents..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" 
          />
        </div>
      )}

      {/* Card Stack (Wallet UI) */}
      <main className="px-6 relative flex flex-col items-center">
        {filteredDocs.length === 0 ? (
          <div className="mt-20 text-center text-gray-500 opacity-50">
            <FileText size={48} className="mx-auto mb-4" />
            <p>No documents found</p>
          </div>
        ) : (
          <div className="relative w-full max-w-sm" style={{ height: `${(filteredDocs.length - 1) * 70 + 220}px` }}>
            {filteredDocs.map((doc, index) => (
              <div 
                key={doc.id} 
                onClick={() => handleSelectDoc(doc)} 
                className="absolute w-full rounded-2xl shadow-xl transition-all cursor-pointer overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:-translate-y-2" 
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
                      <span className="text-gray-400 text-xs font-bold tracking-widest uppercase">PDF</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) */}
      <input type="file" accept="image/*,application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
      <button 
        onClick={() => fileInputRef.current.click()} 
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 active:scale-90 transition-transform hover:bg-blue-700"
      >
        <Plus size={32} />
      </button>

      {/* Fullscreen Viewer Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col backdrop-blur-md">
          <div className="flex justify-between items-center p-4 bg-black/50 text-white border-b border-white/10">
            <h2 className="font-bold text-xl truncate pr-4">{selectedDoc.title}</h2>
            <div className="flex gap-4">
              <button 
                onClick={async () => { if(window.confirm('Delete this document permanently?')){ await deleteDocumentDB(selectedDoc.id); setDocuments(d => d.filter(x => x.id !== selectedDoc.id)); setSelectedDoc(null); } }} 
                className="p-2 bg-red-600 rounded-full hover:bg-red-700"
              >
                <Trash2 size={20} />
              </button>
              <button onClick={() => { setSelectedDoc(null); setBlobUrl(null); }} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700">
                <X size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center">
            {selectedDoc.type.includes('image') ? (
              <img src={blobUrl} alt={selectedDoc.title} className="max-w-full rounded-lg shadow-2xl" />
            ) : (
              <div className="w-full h-full flex flex-col items-center">
                <Document
                  file={blobUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<div className="text-white mt-10 text-center">Preparing document...</div>}
                  error={<div className="text-red-500 mt-10 font-bold text-center">Loading error. Please re-upload the file.</div>}
                  className="flex flex-col items-center"
                >
                  {Array.from(new Array(numPages), (el, index) => (
                    <Page 
                      key={`page_${index + 1}`} 
                      pageNumber={index + 1} 
                      width={Math.min(window.innerWidth - 32, 600)} 
                      className="mb-4 shadow-2xl rounded-sm overflow-hidden" 
                      renderTextLayer={false} 
                      renderAnnotationLayer={false} 
                    />
                  ))}
                </Document>
                {numPages && (
                  <p className="text-white/40 text-[10px] mt-4 mb-8 italic">
                    {numPages} {numPages === 1 ? 'page' : 'pages'} loaded
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}