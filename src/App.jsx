import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Moon, Sun, Plus, X, FileText,
  Trash2, Settings, Download, Upload, ZoomIn, ZoomOut,
  Loader2, CheckCircle2, AlertCircle 
} from 'lucide-react';

// Capacitor & PDF Imports
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Document, Page, pdfjs } from 'react-pdf';

// High-performance Zoom/Pan Library
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// App Version pulled dynamically from package.json
import { version as VERSION } from '../package.json';

// Configure PDF Worker for Production/Android
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Helper for converting stored base64 data to Blobs for viewing
const base64ToBlob = (base64, type) => {
  try {
    const binStr = atob(base64.split(',')[1]);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = binStr.charCodeAt(i);
    return new Blob([arr], { type });
  } catch (e) {
    console.error("Blob conversion error", e);
    return null;
  }
};

// --- IndexedDB Logic ---
const DB_NAME = 'DocuDropDB';
const STORE_NAME = 'documents';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onerror = () => reject('Database error');
  });
};

const loadDocuments = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject('Load failed');
  });
};

const saveDocument = async (doc) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).put(doc);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Save failed');
  });
};

const deleteDoc = async (id) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
};

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  const refreshDocs = () => {
    loadDocuments().then(data => {
      setDocuments(data.sort((a, b) => b.timestamp - a.timestamp));
    }).catch(console.error);
  };

  useEffect(() => {
    refreshDocs();
    
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.body.style.backgroundColor = isDarkMode ? '#111827' : '#F3F4F6';
  }, [isDarkMode]);

  useEffect(() => {
    if (status) {
      const t = setTimeout(() => setStatus(null), 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const title = prompt('Document Title:') || file.name.split('.')[0];
      await saveDocument({
        id: Date.now().toString(),
        title,
        type: file.type,
        data: ev.target.result,
        color: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][documents.length % 5],
        timestamp: Date.now()
      });
      refreshDocs();
      setStatus({ type: 'success', message: 'Added' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const exportData = async () => {
    try {
      const data = await loadDocuments();
      if (data.length === 0) return setStatus({ type: 'error', message: 'Vault empty' });

      const fileName = (prompt("Backup name:", `docudrop_backup_${new Date().toISOString().split('T')[0]}`) || "backup") + ".json";
      setIsProcessing(true);

      const json = JSON.stringify(data);

      const result = await Filesystem.writeFile({
        path: fileName,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      await Share.share({
        title: 'Docu Drop Backup',
        url: result.uri,
        dialogTitle: 'Export'
      });

      setStatus({ type: 'success', message: 'Export Ready' });
      setIsSettingsOpen(false);
    } catch (err) {
      console.error("Export error:", err);
      setStatus({ type: 'error', message: 'Export Failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (window.confirm(`Import ${imported.length} items?`)) {
          setIsProcessing(true);
          for (const d of imported) await saveDocument(d);
          refreshDocs();
          setStatus({ type: 'success', message: 'Imported' });
          setIsSettingsOpen(false);
        }
      } catch (err) {
        setStatus({ type: 'error', message: 'Invalid File' });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredDocs = documents.filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors font-sans pb-24">
      {status && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 border ${status.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'}`}>
            {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span className="text-sm font-bold uppercase tracking-tight">{status.message}</span>
          </div>
        </div>
      )}

      <header className="px-6 pt-12 pb-6 flex justify-between items-center sticky top-0 z-[60] bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur-md">
        <h1 className="text-3xl font-black">Docu Drop</h1>
        <div className="flex gap-2">
          <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="p-2.5 bg-gray-200 dark:bg-gray-800 rounded-full"><Search size={20} /></button>
          <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-2.5 bg-gray-200 dark:bg-gray-800 rounded-full"><Settings size={20} /></button>
        </div>
      </header>

      {isSettingsOpen && (
        <div className="px-6 mb-6">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border dark:border-gray-700">
            {isProcessing ? (
              <div className="flex flex-col items-center p-6 gap-2"><Loader2 className="animate-spin text-blue-500" /><span className="text-[10px] font-bold opacity-50 uppercase">Syncing</span></div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={exportData} className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl active:scale-95 transition-transform">
                    <Download size={20} className="text-blue-500 mb-1" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Export</span>
                  </button>
                  <button onClick={() => importInputRef.current.click()} className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl active:scale-95 transition-transform">
                    <Upload size={20} className="text-emerald-500 mb-1" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Import</span>
                  </button>
                  <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl active:scale-95 transition-transform">
                    {isDarkMode ? <Sun size={20} className="text-yellow-500 mb-1" /> : <Moon size={20} className="text-indigo-500 mb-1" />}
                    <span className="text-[9px] font-black uppercase tracking-widest">Theme</span>
                  </button>
                </div>
                <div className="text-center border-t dark:border-gray-700 pt-3">
                  <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">DocuDrop v{VERSION}</p>
                </div>
              </div>
            )}
            <input type="file" accept=".json" className="hidden" ref={importInputRef} onChange={importData} />
          </div>
        </div>
      )}

      {isSearchOpen && (
        <div className="px-6 mb-6">
          <input 
            type="text" 
            placeholder="Search vault..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="w-full p-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 dark:border-gray-700 outline-none shadow-lg"
          />
        </div>
      )}

      <main className="px-6 flex flex-col pt-4 pb-80 snap-y snap-mandatory">
        {filteredDocs.map((doc, index) => (
          <div 
            key={doc.id} 
            style={{
              backgroundColor: doc.color,
              marginTop: index === 0 ? '0' : '-110px',
              top: `${110 + (index * 12)}px`,
              zIndex: index
            }}
            onClick={() => {
              const b = base64ToBlob(doc.data, doc.type);
              if (b) {
                setBlobUrl(URL.createObjectURL(b));
                setSelectedDoc(doc);
              }
            }} 
            className="sticky snap-center min-h-[12rem] p-6 rounded-[2.5rem] shadow-2xl flex flex-col justify-between active:scale-[0.98] transition-all cursor-pointer border border-white/10 text-white"
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
                  {doc.type.includes('pdf') ? 'Digital Document' : 'Image Pass'}
                </span>
                <h3 className="font-bold text-2xl tracking-tight leading-tight truncate max-w-[220px]">{doc.title}</h3>
              </div>
              <FileText size={24} className="opacity-40" />
            </div>
            
            <div className="flex justify-between items-end">
              <p className="text-[10px] opacity-60 uppercase font-black tracking-tighter">
                {new Date(doc.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                {doc.type.includes('pdf') ? 'PDF' : 'IMG'}
              </div>
            </div>
          </div>
        ))}
      </main>

      <input type="file" accept="image/*,application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
      <button onClick={() => fileInputRef.current.click()} className="fixed bottom-10 right-8 w-20 h-20 bg-blue-600 text-white rounded-3xl shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-[70]"><Plus size={40} /></button>

      {selectedDoc && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <TransformWrapper initialScale={1} minScale={0.5} maxScale={5}>
            {({ zoomIn, zoomOut }) => (
              <div className="flex flex-col h-full w-full">
                <header className="p-5 flex justify-between items-center bg-black/50 text-white backdrop-blur-md z-20">
                  <h2 className="font-bold truncate max-w-[40%]">{selectedDoc.title}</h2>
                  <div className="flex gap-4 items-center">
                    <div className="flex bg-white/10 rounded-xl p-1 gap-1">
                      <button onClick={() => zoomOut()} className="p-1.5 active:bg-white/20 rounded-lg"><ZoomOut size={18} /></button>
                      <button onClick={() => zoomIn()} className="p-1.5 active:bg-white/20 rounded-lg"><ZoomIn size={18} /></button>
                    </div>
                    <Trash2 onClick={() => { if(window.confirm('Delete permanently?')) { deleteDoc(selectedDoc.id); refreshDocs(); setSelectedDoc(null); setBlobUrl(null); } }} className="text-red-500 cursor-pointer" />
                    <X onClick={() => { setSelectedDoc(null); setBlobUrl(null); setNumPages(null); }} className="cursor-pointer" />
                  </div>
                </header>

                <main className="flex-1 overflow-hidden bg-black">
                  <TransformComponent
                    wrapperStyle={{ width: '100vw', height: 'calc(100vh - 80px)' }}
                    contentStyle={{ minWidth: '100vw', minHeight: 'calc(100vh - 80px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}
                  >
                    <div className="w-full flex flex-col items-center p-4">
                      {selectedDoc.type.includes('image') ? (
                        <img src={blobUrl} className="max-w-full h-auto rounded-xl shadow-2xl" alt="" />
                      ) : (
                        <Document 
                          file={blobUrl} 
                          onLoadSuccess={({numPages}) => setNumPages(numPages)}
                          loading={<div className="text-white font-bold opacity-30 uppercase tracking-widest mt-20">Opening PDF...</div>}
                        >
                          {Array.from(new Array(numPages || 0), (_, i) => (
                            <Page 
                              key={i} 
                              pageNumber={i+1} 
                              scale={1.4} 
                              width={window.innerWidth - 32} 
                              className="mb-6 rounded-lg shadow-2xl overflow-hidden" 
                              renderTextLayer={false} 
                              renderAnnotationLayer={false} 
                            />
                          ))}
                        </Document>
                      )}
                    </div>
                  </TransformComponent>
                </main>
              </div>
            )}
          </TransformWrapper>
        </div>
      )}
    </div>
  );
}