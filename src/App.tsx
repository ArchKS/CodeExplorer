import { useState, useMemo, useEffect } from 'react';
import { shortSource, longSource, type FileItem } from './data';
import { ChevronRight, Home, ArrowLeft, Search, Layers } from 'lucide-react';
import { CodeCard } from './components/CodeCard';
import { CodeModal } from './components/CodeModal';

export function App() {
  const [history, setHistory] = useState<FileItem[][]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string; prev?: string; initialMode?: 'source' | 'image' } | null>(null);
  const [metadata, setMetadata] = useState<Record<string, { intro?: string; date?: string; prev?: string; tag?: string; star?: number }>>({});
  const [filter, setFilter] = useState<'all' | 'file' | 'directory'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. 数据过滤与排序
  const filteredItems = useMemo(() => {
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
        (metadata[item.path]?.intro && metadata[item.path].intro!.toLowerCase().includes(query)) ||
        (metadata[item.path]?.tag && metadata[item.path].tag!.toLowerCase().includes(query))
      );
    }

    return [...items].sort((a, b) => {
      // 1. 目录始终排在最后
      if (a.type !== b.type) return a.type === 'directory' ? 1 : -1;

      // 2. 优先按 Star 数量降序排 (越多越靠前)
      const starA = metadata[a.path]?.star || 0;
      const starB = metadata[b.path]?.star || 0;
      if (starA !== starB) return starB - starA;

      // 3. 其次按日期降序排
      const dateA = metadata[a.path]?.date || '';
      const dateB = metadata[b.path]?.date || '';
      if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;

      // 4. 最后按名称升序排
      return a.name.localeCompare(b.name);
    });
  }, [history, filter, searchQuery, metadata]);

  // 2. 方案2核心：按 Tag 分组数据 (仅在根目录分组)
  const groupedItems = useMemo(() => {
    if (history.length > 0) return { "Content": filteredItems };

    const groups: Record<string, FileItem[]> = {};
    filteredItems.forEach(item => {
      const tag = metadata[item.path]?.tag || 'Uncategorized';
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(item);
    });

    const sortedTags = Object.keys(groups).sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });

    const result: Record<string, FileItem[]> = {};
    sortedTags.forEach(tag => { result[tag] = groups[tag]; });
    return result;
  }, [filteredItems, history.length, metadata]);


  useEffect(() => {
    const fetchMetadata = async () => {
      const itemsToFetch = filteredItems.filter(item => !metadata[item.path]);
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
            const tagMatch = text.match(/Tag:\s*(.*)/i);
            const starMatch = text.match(/Star:\s*(\d+)/i);

            const newMeta: { intro?: string; date?: string; prev?: string; tag?: string; star?: number } = { star: 0 };
            if (introMatch) newMeta.intro = introMatch[1].trim();
            if (dateMatch) newMeta.date = dateMatch[1].trim();
            if (tagMatch) newMeta.tag = tagMatch[1].trim();
            if (starMatch) newMeta.star = parseInt(starMatch[1], 10);

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
  }, [filteredItems]);

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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-12 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Layers className="text-blue-600" size={32} />
              <h1 className="text-4xl font-black text-gray-900">Code Library</h1>
            </div>
            <p className="text-lg text-gray-500 font-medium">Automated source code gallery & interactive explorer</p>
          </header>

          <nav className="flex items-center gap-2 mb-10 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm sticky top-4 z-30">
            <button onClick={() => setHistory([])} className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors"><Home size={22} /></button>
            <div className="relative mx-4 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
              <input type="text" placeholder="Search across all categories..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-80 lg:w-[450px] outline-none transition-all" />
            </div>
            {history.length > 0 && (
              <>
                <ChevronRight size={16} className="text-gray-400" />
                <button onClick={() => setHistory(history.slice(0, -1))} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-xl text-sm font-bold text-gray-700 transition-colors"><ArrowLeft size={18} />Back</button>
              </>
            )}
            <div className="flex-1" />
            {history.length === 0 && (
              <div className="flex bg-gray-100 p-1.5 rounded-xl mr-4">
                {['all', 'file', 'directory'].map(t => (
                  <button key={t} onClick={() => setFilter(t as any)} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filter === t ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t.toUpperCase()}</button>
                ))}
              </div>
            )}
            <div className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-black uppercase tracking-tighter">{history.length === 0 ? 'Home' : `Depth ${history.length}`}</div>
          </nav>

          <div className={`${history.length === 0 ? "space-x-6 flex overflow-y-auto pb-10" : ""}`}>
            {Object.entries(groupedItems).map(([tag, items]) => (
              <section key={tag} className={`${history.length == 0 ? "animate-in fade-in slide-in-from-bottom-4 duration-700 min-w-[300px]" : ""}`}>
                {history.length === 0 && (
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-1.5 bg-blue-600 rounded-full"></div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight">{tag}</h2>
                    <span className="px-2.5 py-0.5 bg-gray-200 text-gray-600 text-xs font-bold rounded-md uppercase">{items.length}</span>
                  </div>
                )}
                <div className={history.length == 0 ? "max-w-[270px] space-y-8" : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"}>
                  {items.map((item, index) => (
                    <CodeCard
                      key={`${item.path}-${index}`}
                      name={item.name}
                      type={item.type}
                      intro={metadata[item.path]?.intro}
                      hasPrev={!!metadata[item.path]?.prev}
                      star={metadata[item.path]?.star}
                      onClick={() => handleItemClick(item)}
                      onDownload={(e) => handleDownload(e, item)}
                      onPreviewImage={(e) => handlePreviewImage(e, item)} />
                  ))}
                </div>
              </section>
            ))}
            {filteredItems.length === 0 && <div className="py-32 text-center">
              <div className="text-gray-200 text-6xl mb-4">Empty</div>
              <p className="text-gray-400 font-mono">No matching files found in this view</p>
            </div>}
          </div>
        </div>
      </main>

      {selectedFile && <CodeModal fileName={selectedFile.name} filePath={selectedFile.path} prevImage={selectedFile.prev} initialMode={selectedFile.initialMode} onClose={() => setSelectedFile(null)} />}
    </div>
  );
}

