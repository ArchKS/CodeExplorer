import { useState, useMemo, useEffect } from 'react';
import { shortSource, longSource, type FileItem } from './data';
import CodeCard from './components/CodeCard';
import CodeModal from './components/CodeModal';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';

function App() {
  const [history, setHistory] = useState<FileItem[][]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string } | null>(null);
  const [intros, setIntros] = useState<Record<string, string>>({});

  const currentItems = useMemo(() => {
    if (history.length === 0) {
      return [
        ...shortSource.map(item => ({ ...item, section: 'short' })),
        ...longSource.map(item => ({ ...item, section: 'long' }))
      ];
    }
    const currentFolder = history[history.length - 1];
    return currentFolder;
  }, [history]);

  // 自动扫描当前页面文件中的 Intro
  useEffect(() => {
    const fetchIntros = async () => {
      const filesToFetch = currentItems.filter(
        item => item.type === 'file' && !intros[item.path]
      );

      for (const file of filesToFetch) {
        try {
          const response = await fetch(file.path);
          const text = await response.text();
          // 匹配 Intro: 后面直到行尾的内容
          const match = text.match(/Intro:\s*(.*)/i);
          if (match && match[1]) {
            setIntros(prev => ({ ...prev, [file.path]: match[1].trim() }));
          }
        } catch (e) {
          console.error(`Failed to fetch intro for ${file.path}`, e);
        }
      }
    };

    fetchIntros();
  }, [currentItems]);

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'directory') {
      setHistory([...history, item.children || []]);
    } else {
      setSelectedFile({ path: item.path, name: item.name });
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
    if (item.type === 'file') {
      const link = document.createElement('a');
      link.href = item.path;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert('Folder download not implemented in pure frontend (requires zipping)');
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
