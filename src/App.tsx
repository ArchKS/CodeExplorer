import { useState, useMemo, useEffect } from 'react';
import { shortSource, longSource, type FileItem } from './data';
import CodeCard from './components/CodeCard';
import CodeModal from './components/CodeModal';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';

function App() {
  const [history, setHistory] = useState<FileItem[][]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string } | null>(null);
  const [intros, setIntros] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'file' | 'directory'>('all');

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
    return items;
  }, [history, filter]);

  // 自动扫描当前页面文件或目录（README.md）中的 Intro
  useEffect(() => {
    const fetchIntros = async () => {
      const itemsToFetch = currentItems.filter(item => !intros[item.path]);

      for (const item of itemsToFetch) {
        let fetchPath = '';
        if (item.type === 'file') {
          fetchPath = item.path;
        } else if (item.type === 'directory') {
          const readme = item.children?.find(c => c.name.toLowerCase() === 'readme.md');
          if (readme) {
            fetchPath = readme.path;
          }
        }

        if (fetchPath) {
          try {
            const response = await fetch(fetchPath);
            const text = await response.text();
            const match = text.match(/Intro:\s*(.*)/i);
            if (match && match[1]) {
              setIntros(prev => ({ ...prev, [item.path]: match[1].trim() }));
            }
          } catch (e) {
            console.error(`Failed to fetch intro for ${item.path}`, e);
          }
        }
      }
    };

    fetchIntros();
  }, [currentItems]);

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'directory') {
      setHistory([...history, item.children || []]);
    } else {
      const isImage = /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(item.name);
      if (isImage) {
        window.open(item.path, '_blank');
      } else {
        setSelectedFile({ path: item.path, name: item.name });
      }
    }
  };

  const goBack = () => {
    setHistory(history.slice(0, -1));
  };

  const goHome = () => {
    setHistory([]);
  };

  const handleDownload = (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();

    const triggerDownload = (path: string, name: string) => {
      const link = document.createElement('a');
      link.href = path;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const downloadAll = (files: FileItem[]) => {
      files.forEach((f) => {
        if (f.type === 'file') {
          triggerDownload(f.path, f.name);
        } else if (f.children) {
          downloadAll(f.children);
        }
      });
    };

    if (item.type === 'file') {
      triggerDownload(item.path, item.name);
    } else if (item.children) {
      if (confirm(`准备下载文件夹 "${item.name}" 中的所有文件，是否继续？`)) {
        downloadAll(item.children);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8 w-full">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Code Explorer</h1>
          <p className="text-lg text-gray-500">Pure frontend code source viewer</p>
        </header>

        <nav className="flex items-center gap-2 mb-6 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={goHome}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            title="Home"
          >
            <Home size={20} />
          </button>
          
          {history.length > 0 && (
            <>
              <ChevronRight size={16} className="text-gray-400" />
              <button
                onClick={goBack}
                className="flex items-center gap-1 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors text-sm font-semibold text-gray-700"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            </>
          )}

          <div className="flex-1" />

          {history.length === 0 && (
            <div className="flex bg-gray-100 p-1 rounded-lg mr-4">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  filter === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('file')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  filter === 'file' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Files
              </button>
              <button
                onClick={() => setFilter('directory')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  filter === 'directory' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Folders
              </button>
            </div>
          )}
          
          <div className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-500 uppercase tracking-widest">
            {history.length === 0 ? 'Root' : `Level ${history.length}`}
          </div>
        </nav>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {currentItems.map((item, index) => (
            <CodeCard
              key={`${item.path}-${index}`}
              name={item.name}
              type={item.type}
              intro={item.intro || intros[item.path]}
              onClick={() => handleItemClick(item)}
              onDownload={(e) => handleDownload(e, item)}
            />
          ))}
          {currentItems.length === 0 && (
            <div className="col-span-full py-20 text-center">
               <div className="text-gray-300 mb-4 font-mono text-lg">Empty directory</div>
            </div>
          )}
        </div>
      </div>

      {selectedFile && (
        <CodeModal
          fileName={selectedFile.name}
          filePath={selectedFile.path}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}

export default App;
