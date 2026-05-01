import React, { useState, useEffect, useRef } from 'react';
import { Search, Moon, Sun, Plus, X, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';

// --- IndexedDB Helfer ---
const DB_NAME = 'DocuDropDB';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject('IndexedDB konnte nicht geöffnet werden');
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
    request.onerror = () => reject('Dokument speichern fehlgeschlagen');
  });
};

const loadDocuments = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject('Dokumente laden fehlgeschlagen');
  });
};

const deleteDocumentDB = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Löschen fehlgeschlagen');
  });
};

// Hilfsfunktion: Base64 zu Blob (Wichtig für Android WebViews)
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

  // Cleanup für Blob-URLs
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      const title = prompt('Titel für dieses Dokument:') || file.name.split('.')[0];
      
      const newDoc = {
        id: Date.now().toString(),
        title: title,
        type: file.type,
        data: base64Data,
        color: colors[documents.length % colors.length],
        timestamp: Date.now()
      };

      try {
        await saveDocument(newDoc);
        setDocuments(prev => [newDoc, ...prev]);
      } catch (err) {
        console.error('Speicherfehler:', err);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSelectDoc = (doc) => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const blob = base64ToBlob(doc.data, doc.type);
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    setSelectedDoc(doc);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Dokument unwiderruflich löschen?')) {
      await deleteDocumentDB(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      setSelectedDoc(null);
      setBlobUrl(null);
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans pb-24">
      
      {/* Header */}
      <header className="px-6 pt-12 pb-6 flex justify-between items-center sticky top-0 z-50 bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur-sm">
        <h1 className="text-3xl font-black tracking-tight">Docu Drop</h1>
        <div className="flex gap-4 items-center">
          <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full">
            <Search size={20} />
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full">
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Suche */}
      {isSearchOpen && (
        <div className="px-6 mb-4">
          <input
            type="text"
            placeholder="Dokumente durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
      )}

      {/* Karten Stapel */}
      <main className="px-6 relative flex flex-col items-center">
        {filteredDocs.length === 0 ? (
          <div className="mt-20 text-center text-gray-500 dark:text-gray-400">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>Keine Dokumente gefunden.</p>
          </div>
        ) : (
          <div 
            className="relative w-full max-w-sm" 
            style={{ height: `${(filteredDocs.length - 1) * 70 + 220}px` }}
          >
            {filteredDocs.map((doc, index) => (
              <div
                key={doc.id}
                onClick={() => handleSelectDoc(doc)}
                className="absolute w-full rounded-2xl shadow-xl transition-all duration-300 cursor-pointer overflow-hidden bg-white dark:bg-gray-800 hover:-translate-y-2 border border-gray-200 dark:border-gray-700"
                style={{ 
                  top: `${index * 70}px`, 
                  zIndex: index,
                  height: '220px',
                  transformOrigin: 'top center',
                }}
              >
                <div 
                  className="h-16 w-full px-5 flex items-center justify-between" 
                  style={{ backgroundColor: doc.color }}
                >
                  <h2 className="font-bold text-white text-lg truncate pr-4 drop-shadow-sm">{doc.title}</h2>
                  {doc.type.includes('image') ? <ImageIcon color="white" size={20} /> : <FileText color="white" size={20} />}
                </div>
                
                <div className="p-4 h-[calc(100%-4rem)] flex items-center justify-center">
                  {doc.type.includes('image') ? (
                    <div className="w-full h-full bg-cover bg-center rounded-lg shadow-inner" style={{ backgroundImage: `url(${doc.data})` }} />
                  ) : (
                    <div className="w-full h-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
                      <FileText size={32} className="text-gray-400 mb-2" />
                      <span className="text-gray-400 font-medium text-xs uppercase tracking-widest">PDF</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <input 
        type="file" 
        accept="image/*,application/pdf" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
      />
      <button 
        onClick={() => fileInputRef.current.click()}
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-50 hover:bg-blue-700"
      >
        <Plus size={32} />
      </button>

      {/* Viewer Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col backdrop-blur-md">
          <div className="flex justify-between items-center p-4 bg-black/50 text-white border-b border-white/10">
            <h2 className="font-bold text-xl truncate pr-4">{selectedDoc.title}</h2>
            <div className="flex gap-4">
              <button onClick={() => handleDelete(selectedDoc.id)} className="p-2 bg-red-600/80 rounded-full hover:bg-red-600">
                <Trash2 size={20} />
              </button>
              <button onClick={() => { setSelectedDoc(null); setBlobUrl(null); }} className="p-2 bg-gray-800 rounded-full">
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            {selectedDoc.type.includes('image') ? (
               <img src={blobUrl} alt={selectedDoc.title} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
            ) : (
               <div className="w-full h-full flex flex-col items-center">
                 {/* Hinweis: In Android APKs kann ein iframe für PDFs weiß bleiben. */}
                 {/* In diesem Fall ist react-pdf (canvas rendering) zwingend notwendig. */}
                 <iframe 
                  src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                  className="w-full h-full bg-white rounded-lg shadow-2xl" 
                  title={selectedDoc.title} 
                 />
                 <p className="text-white/50 text-[10px] mt-2 italic text-center">
                   Hinweis: Falls dieses Fenster weiß bleibt, unterstützt dein System kein natives PDF-Rendering im WebView.
                 </p>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}