import { useState, useMemo, useEffect } from 'react';
import { shortSource, longSource, type FileItem } from './data';
import { TAG_SORT } from './config';
import { ChevronRight, Home, ArrowLeft, Search, Layers } from 'lucide-react';
import { CodeCard } from './components/CodeCard';
import { CodeModal } from './components/CodeModal';

export function App() {
  const [history, setHistory] = useState<FileItem[][]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string; prev?: string; initialMode?: 'source' | 'image' } | null>(null);
  const [metadata, setMetadata] = useState<Record<string, { intro?: string; date?: string; prev?: string; tag?: string; star?: number }>>({});
  const [filter, setFilter] = useState<'all' | 'file' | 'directory'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1.5 Flatten files for hash lookup
  const allFiles = useMemo(() => {
    const flatten = (items: FileItem[]): FileItem[] => {
      return items.reduce((acc, item) => {
        acc.push(item);
        if (item.children) acc.push(...flatten(item.children));
        return acc;
      }, [] as FileItem[]);
    };
    return flatten([...shortSource, ...longSource]);
  }, []);

  // 2. Hash routing logic
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) {
        setSelectedFile(null);
        return;
      }
      const item = allFiles.find(f => f.code === hash && f.type === 'file');
      if (item && selectedFile?.path !== item.path) {
        setSelectedFile({ path: item.path, name: item.name, prev: metadata[item.path]?.prev });
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Initial check - only if not already set
    const initialHash = window.location.hash.slice(1);
    if (initialHash && !selectedFile) {
      const item = allFiles.find(f => f.code === initialHash && f.type === 'file');
      if (item) setSelectedFile({ path: item.path, name: item.name, prev: metadata[item.path]?.prev });
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [allFiles]);

  // 3. Sync selectedFile state to Hash and Title
  useEffect(() => {
    if (selectedFile) {
      // Sync Hash
      const item = allFiles.find(f => f.path === selectedFile.path);
      if (item && window.location.hash !== `#${item.code}`) {
        window.location.hash = item.code;
      }
      // Sync Title
      const intro = metadata[selectedFile.path]?.intro;
      document.title = intro || selectedFile.name;
      // Sync Prev image if it loaded later
      if (!selectedFile.prev && metadata[selectedFile.path]?.prev) {
        setSelectedFile(prev => prev ? { ...prev, prev: metadata[selectedFile.path].prev } : null);
      }
    } else {
      if (window.location.hash) {
        window.history.pushState("", "Code Library", window.location.pathname + window.location.search);
      }
      document.title = "Code Library";
    }
  }, [selectedFile, allFiles, metadata]);

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
      const sortA = TAG_SORT[a] || 999;
      const sortB = TAG_SORT[b] || 999;
      if (sortA !== sortB) return sortA - sortB;
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
      const itemsToFetch = [...filteredItems];
      if (selectedFile && !itemsToFetch.find(i => i.path === selectedFile.path)) {
        const item = allFiles.find(i => i.path === selectedFile.path);
        if (item) itemsToFetch.push(item);
      }

      const pendingItems = itemsToFetch.filter(item => !metadata[item.path]);
      if (pendingItems.length === 0) return;

      const results: Record<string, any> = {};
      await Promise.all(pendingItems.map(async (item) => {
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
            results[item.path] = newMeta;
          } catch (e) {
            results[item.path] = {};
          }
        }
      }));

      if (Object.keys(results).length > 0) {
        setMetadata(prev => ({ ...prev, ...results }));
      }
    };
    fetchMetadata();
  }, [filteredItems, selectedFile, allFiles]);

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

  // ai coding: 压缩首页标题、工具栏、分类栏与卡片网格间距，移除标题说明并增加同屏分类列数 2026/09/11: 14:57
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="px-3 py-4 sm:px-5 lg:px-6">
        <div className="mx-auto max-w-[1600px]">
          <header className="mb-4 flex items-center">
            <div className="flex items-center gap-2">
              <Layers className="text-blue-600" size={24} />
              <h1 className="m-0 text-2xl font-black leading-none text-gray-900">Code Library</h1>
            </div>
          </header>

          <nav className="sticky top-2 z-30 mb-5 flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
            <button onClick={() => setHistory([])} className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"><Home size={19} /></button>
            <div className="relative mx-1 min-w-0 flex-1 sm:max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-lg border border-gray-100 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500" />
            </div>
            {history.length > 0 && (
              <>
                <ChevronRight size={16} className="text-gray-400" />
                <button onClick={() => setHistory(history.slice(0, -1))} className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100"><ArrowLeft size={16} />Back</button>
              </>
            )}
            <div className="flex-1" />
            {history.length === 0 && (
              <div className="hidden rounded-lg bg-gray-100 p-1 sm:flex">
                {['all', 'file', 'directory'].map(t => (
                  <button key={t} onClick={() => setFilter(t as any)} className={`rounded-md px-3 py-1.5 text-[11px] font-black transition-all ${filter === t ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t.toUpperCase()}</button>
                ))}
              </div>
            )}
            <div className="hidden rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-tighter text-blue-600 md:block">{history.length === 0 ? 'Home' : `Depth ${history.length}`}</div>
          </nav>

          <div className={history.length === 0 ? "grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] items-start gap-4 pb-6" : ""}>
            {Object.entries(groupedItems).map(([tag, items]) => (
              <section key={tag} className={history.length === 0 ? "animate-in fade-in slide-in-from-bottom-4 duration-700" : ""}>
                {history.length === 0 && (
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full bg-blue-600"></div>
                    <h2 className="m-0 text-base font-black tracking-tight text-gray-800">{tag}</h2>
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-600">{items.length}</span>
                  </div>
                )}
                <div className={history.length === 0 ? "space-y-3" : "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"}>
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
