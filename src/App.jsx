import React, { useState, useEffect, useRef } from 'react';
import { Search, Moon, Sun, Plus, X, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';

// --- IndexedDB Helper Functions ---
const DB_NAME = 'DocuDropDB';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject('Failed to open IndexedDB');
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
    request.onerror = () => reject('Failed to save document');
  });
};

const loadDocuments = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject('Failed to load documents');
  });
};

const deleteDocumentDB = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Failed to delete document');
  });
};

// --- Main App Component ---
export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const fileInputRef = useRef(null);

  // Colors for the top bar of the cards
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

  useEffect(() => {
    // Load offline documents on startup
    loadDocuments().then(data => {
      // Sort by newest first
      setDocuments(data.sort((a, b) => b.timestamp - a.timestamp));
    }).catch(console.error);

    // Apply dark mode class to body for full screen background
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#111827'; // gray-900
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#F3F4F6'; // gray-100
    }
  }, [isDarkMode]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      const title = prompt('Enter a title for this document:') || file.name.split('.')[0];
      
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
        console.error('Error saving to offline database:', err);
      }
    };
    reader.readAsDataURL(file); // Convert to base64 for reliable offline storage/rendering
    e.target.value = ''; // Reset input
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this document?')) {
      await deleteDocumentDB(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      setSelectedDoc(null);
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans pb-24`}>
      
      {/* Header */}
      <header className="px-6 pt-12 pb-6 flex justify-between items-center sticky top-0 z-50 bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur-sm">
        <h1 className="text-3xl font-black tracking-tight">Docu Drop</h1>
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
            autoFocus
          />
        </div>
      )}

      {/* Wallet Stack UI */}
      <main className="px-6 relative flex flex-col items-center">
        {filteredDocs.length === 0 ? (
          <div className="mt-20 text-center text-gray-500 dark:text-gray-400">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>No documents found.</p>
            <p className="text-sm mt-2">Tap the + button to add one.</p>
          </div>
        ) : (
          <div 
            className="relative w-full max-w-sm" 
            style={{ height: `${(filteredDocs.length - 1) * 70 + 220}px` }}
          >
            {filteredDocs.map((doc, index) => (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className="absolute w-full rounded-2xl shadow-xl transition-all duration-300 cursor-pointer overflow-hidden bg-white dark:bg-gray-800 hover:-translate-y-2"
                style={{ 
                  top: `${index * 70}px`, 
                  zIndex: index,
                  height: '220px',
                  transformOrigin: 'top center',
                }}
              >
                {/* Solid Color Top Bar */}
                <div 
                  className="h-16 w-full px-5 flex items-center justify-between" 
                  style={{ backgroundColor: doc.color }}
                >
                  <h2 className="font-bold text-white text-lg truncate pr-4 drop-shadow-sm">{doc.title}</h2>
                  {doc.type.includes('image') ? <ImageIcon color="white" size={20} /> : <FileText color="white" size={20} />}
                </div>
                
                {/* Card Body Preview */}
                <div className="p-4 h-[calc(100%-4rem)] bg-white dark:bg-gray-800 flex items-center justify-center border-x border-b border-gray-200 dark:border-gray-700 rounded-b-2xl">
                  {doc.type.includes('image') ? (
                    <div className="w-full h-full bg-cover bg-center rounded-lg" style={{ backgroundImage: `url(${doc.data})` }} />
                  ) : (
                    <div className="w-full h-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                      <span className="text-gray-400 font-medium">PDF Document</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button for Upload */}
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

      {/* Fullscreen Document Viewer Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col backdrop-blur-md">
          <div className="flex justify-between items-center p-4 bg-black/50 text-white">
            <h2 className="font-bold text-xl truncate pr-4">{selectedDoc.title}</h2>
            <div className="flex gap-4">
              <button onClick={() => handleDelete(selectedDoc.id)} className="p-2 bg-red-600/80 rounded-full hover:bg-red-600">
                <Trash2 size={20} />
              </button>
              <button onClick={() => setSelectedDoc(null)} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700">
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            {selectedDoc.type.includes('image') ? (
               <img src={selectedDoc.data} alt={selectedDoc.title} className="max-w-full max-h-full object-contain rounded-lg" />
            ) : (
               <iframe src={selectedDoc.data} className="w-full h-full bg-white rounded-lg" title={selectedDoc.title} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}