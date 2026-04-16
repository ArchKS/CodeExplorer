import { useState, useMemo, useEffect } from 'react';
import { shortSource, longSource, type FileItem } from './data';
import CodeCard from './components/CodeCard';
import CodeModal from './components/CodeModal';
import { ChevronRight, Home, ArrowLeft, Search } from 'lucide-react';

function App() {
  const [history, setHistory] = useState<FileItem[][]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string; prev?: string; initialMode?: 'source' | 'image' } | null>(null);
  const [metadata, setMetadata] = useState<Record<string, { intro?: string; date?: string; prev?: string; tag?: string }>>({});
  const [filter, setFilter] = useState<'all' | 'file' | 'directory'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const currentItems = useMemo(() => {
    let items: FileItem[] = [];
    if (history.length === 0) {
      items = [
        ...shortSource.map(item => ({ ...item, section: 'short' })),
        ...longSource.map(item => ({ ...item, section: 'long' }))
      ];
      if (filter !== 'all') {
        items = items.filter(item => item.type === filter);
      }
    } else {
      items = history[history.length - 1];
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(query) || 
        (metadata[item.path]?.intro && metadata[item.path].intro!.toLowerCase().includes(query))
      );
    }

    return [...items].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? 1 : -1;
      const dateA = metadata[a.path]?.date || '';
      const dateB = metadata[b.path]?.date || '';
      if (dateA && dateB) return dateB.localeCompare(dateA);
      if (dateA) return -1;
      if (dateB) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [history, filter, searchQuery, metadata]);

  useEffect(() => {
    const fetchMetadata = async () => {
      const itemsToFetch = currentItems.filter(item => !metadata[item.path]);
      for (const item of itemsToFetch) {
        let fetchPath = '';
        if (item.type === 'file') fetchPath = item.path;
        else if (item.type === 'directory') {
          const readme = item.children?.find(c => c.name.toLowerCase() === 'readme.md');
          if (readme) fetchPath = readme.path;
        }

        if (fetchPath) {
          try {
            const response = await fetch(fetchPath);
            const text = await response.text();
            const introMatch = text.match(/Intro:\s*(.*)/i);
            const dateMatch = text.match(/Date:\s*(.*)/i);
            const prevMatch = text.match(/Prev:\s*(.*)/i);
            
            const newMeta: { intro?: string; date?: string; prev?: string } = {};
            if (introMatch) newMeta.intro = introMatch[1].trim();
            if (dateMatch) newMeta.date = dateMatch[1].trim();
            if (prevMatch) {
              const rawPath = prevMatch[1].trim();
              if (rawPath.startsWith('.')) {
                const baseUrl = item.path.substring(0, item.path.lastIndexOf('/'));
                const parts = baseUrl.split('/').filter(Boolean);
                const relParts = rawPath.split('/').filter(Boolean);
                for (const p of relParts) {
                  if (p === '..') parts.pop();
                  else if (p !== '.') parts.push(p);
                }
                newMeta.prev = '/' + parts.join('/');
              } else {
                newMeta.prev = rawPath.startsWith('/') ? rawPath : '/' + rawPath;
              }
            }
            setMetadata(prev => ({ ...prev, [item.path]: newMeta }));
          } catch (e) {
            setMetadata(prev => ({ ...prev, [item.path]: {} }));
          }
        }
      }
    };
    fetchMetadata();
  }, [currentItems]);

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'directory') setHistory([...history, item.children || []]);
    else {
      if (/\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(item.name)) window.open(item.path, '_blank');
      else setSelectedFile({ path: item.path, name: item.name, prev: metadata[item.path]?.prev });
    }
  };

  const handlePreviewImage = (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    setSelectedFile({ path: item.path, name: item.name, prev: metadata[item.path]?.prev, initialMode: 'image' });
  };

  const triggerDownload = (path: string, name: string) => {
    const link = document.createElement('a');
    link.href = path; link.download = name;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleDownload = (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    if (item.type === 'file') triggerDownload(item.path, item.name);
    else if (item.children) {
      if (confirm(`准备下载文件夹 "${item.name}" 中的所有文件？`)) {
        const dlAll = (files: FileItem[]) => files.forEach(f => f.type === 'file' ? triggerDownload(f.path, f.name) : dlAll(f.children || []));
        dlAll(item.children);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Code Explorer</h1>
          <p className="text-lg text-gray-500 font-medium">Pure frontend code source viewer</p>
        </header>

        <nav className="flex items-center gap-2 mb-8 bg-white p-3 rounded-xl border border-gray-200 shadow-sm sticky top-4 z-30">
          <button onClick={() => setHistory([])} className="p-2 hover:bg-gray-100 rounded-xl text-gray-600"><Home size={20} /></button>
          <div className="relative mx-3 hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
            <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-64 lg:w-96 outline-none transition-all" />
          </div>
          {history.length > 0 && (
            <>
              <ChevronRight size={16} className="text-gray-400" />
              <button onClick={() => setHistory(history.slice(0, -1))} className="flex items-center gap-1 px-4 py-2 hover:bg-gray-100 rounded-xl text-sm font-bold text-gray-700"><ArrowLeft size={16} />Back</button>
            </>
          )}
          <div className="flex-1" />
          {history.length === 0 && (
            <div className="flex bg-gray-100 p-1 rounded-xl mr-3">
              {['all', 'file', 'directory'].map(t => (
                <button key={t} onClick={() => setFilter(t as any)} className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${filter === t ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{t.toUpperCase()}</button>
              ))}
            </div>
          )}
          <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter">{history.length === 0 ? 'Home' : `Depth ${history.length}`}</div>
        </nav>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {currentItems.map((item, index) => (
            <CodeCard key={`${item.path}-${index}`} name={item.name} type={item.type} intro={metadata[item.path]?.intro} hasPrev={!!metadata[item.path]?.prev} onClick={() => handleItemClick(item)} onDownload={(e) => handleDownload(e, item)} onPreviewImage={(e) => handlePreviewImage(e, item)} />
          ))}
          {currentItems.length === 0 && <div className="col-span-full py-20 text-center text-gray-300 font-mono text-lg">No items found</div>}
        </div>
      </div>

      {selectedFile && <CodeModal fileName={selectedFile.name} filePath={selectedFile.path} prevImage={selectedFile.prev} initialMode={selectedFile.initialMode} onClose={() => setSelectedFile(null)} />}
    </div>
  );
}

export default App;
