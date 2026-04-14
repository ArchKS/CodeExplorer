import { useState, useMemo, useEffect } from 'react'
import JSZip from 'jszip'
import { 
  FileCode, 
  FolderArchive, 
  Download, 
  Search,
  Code2,
  X,
  Copy,
  Terminal,
  Clock,
  User,
  Info,
  CheckCircle2,
  Box,
  Layers,
  Sparkles
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { motion, AnimatePresence } from 'framer-motion'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Import shortSource files as raw strings
const shortFiles = import.meta.glob('../shortSource/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// Import longSource files to know the structure and contents for zipping
const longFiles = import.meta.glob('../longSource/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

interface Metadata {
  filename: string;
  name: string;
  usage: string;
  createTime: string;
  author: string;
  content: string;
  language: string;
}

interface Project {
  name: string;
  files: Record<string, string>;
}

function App() {
  const [selectedScript, setSelectedScript] = useState<Metadata | null>(null);
  const [activeTab, setActiveTab] = useState<'short' | 'long'>('short');
  const [searchQuery, setSearchQuery] = useState('');

  // Process short scripts
  const scripts = useMemo(() => {
    return Object.entries(shortFiles).map(([path, content]) => {
      const filename = path.split('/').pop() || '';
      const ext = filename.split('.').pop() || '';
      const lines = content.split('\n').slice(0, 15);
      const metadata: Metadata = {
        filename,
        name: filename,
        usage: '暂无用法说明',
        createTime: '未知',
        author: '未知',
        content,
        language: ext === 'js' ? 'javascript' : ext === 'py' ? 'python' : ext === 'ts' ? 'typescript' : ext
      };

      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.includes('名称:')) metadata.name = trimmedLine.split('名称:')[1].trim();
        if (trimmedLine.includes('用法:')) metadata.usage = trimmedLine.split('用法:')[1].trim();
        if (trimmedLine.includes('创建时间:')) metadata.createTime = trimmedLine.split('创建时间:')[1].trim();
        if (trimmedLine.includes('作者:')) metadata.author = trimmedLine.split('作者:')[1].trim();
      });

      return metadata;
    });
  }, []);

  // Process long projects
  const projects = useMemo(() => {
    const grouped: Record<string, Record<string, string>> = {};
    Object.entries(longFiles).forEach(([path, content]) => {
      const parts = path.split('/');
      const longSourceIdx = parts.indexOf('longSource');
      if (longSourceIdx !== -1 && parts.length > longSourceIdx + 1) {
        const projectName = parts[longSourceIdx + 1];
        const internalPath = parts.slice(longSourceIdx + 2).join('/');
        if (!grouped[projectName]) grouped[projectName] = {};
        if (internalPath) {
          grouped[projectName][internalPath] = content;
        }
      }
    });
    return Object.entries(grouped).map(([name, files]): Project => ({ name, files }));
  }, []);

  const filteredScripts = scripts.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const downloadProject = async (project: Project) => {
    const zip = new JSZip();
    Object.entries(project.files).forEach(([path, content]) => {
      zip.file(path, content);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadScript = (script: Metadata) => {
    const blob = new Blob([script.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = script.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyScript = (script: Metadata) => {
    navigator.clipboard.writeText(script.content);
    // You could add a toast notification here
  };

  // Close modal on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedScript(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f8fa] text-[#24292f] font-sans selection:bg-blue-200">
      {/* Header (GitHub Style) */}
      <header className="bg-[#24292f] text-white py-4 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Code2 className="w-8 h-8 text-white" />
          <span className="font-semibold text-lg tracking-tight">CodeHub Repository</span>
        </div>
        <div className="relative w-64 hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search files or projects..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#24292f] border border-[#57606a] rounded-md text-sm text-white placeholder-slate-400 focus:outline-none focus:bg-white focus:text-slate-900 focus:border-blue-500 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        {/* Repository Header Area */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between border-b border-[#d0d7de] pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#0969da] flex items-center gap-2">
              <span className="text-[#57606a]">local</span>
              <span className="text-[#57606a]">/</span>
              <span>workspace</span>
            </h1>
            <p className="text-[#57606a] mt-1 text-sm">
              Local scripts and project directories, organized and ready to use.
            </p>
          </div>
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('short')}
              className={cn(
                "pb-2 text-sm font-semibold transition-all border-b-2 relative top-[17px]",
                activeTab === 'short' ? "text-[#24292f] border-[#fd8c73]" : "text-[#57606a] border-transparent hover:border-[#d0d7de]"
              )}
            >
              Single Scripts <span className="ml-1 px-2 py-0.5 bg-[#d0d7de] text-[#24292f] rounded-full text-xs">{scripts.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('long')}
              className={cn(
                "pb-2 text-sm font-semibold transition-all border-b-2 relative top-[17px]",
                activeTab === 'long' ? "text-[#24292f] border-[#fd8c73]" : "text-[#57606a] border-transparent hover:border-[#d0d7de]"
              )}
            >
              Projects <span className="ml-1 px-2 py-0.5 bg-[#d0d7de] text-[#24292f] rounded-full text-xs">{projects.length}</span>
            </button>
          </nav>
        </div>

        {/* File Explorer Box */}
        <div className="border border-[#d0d7de] rounded-md bg-white overflow-hidden shadow-sm">
          <div className="bg-[#f6f8fa] px-4 py-3 border-b border-[#d0d7de] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="Avatar" className="w-6 h-6 rounded-full border border-slate-200" />
              <span className="text-sm font-semibold text-[#24292f]">User</span>
              <span className="text-sm text-[#57606a]">updated recently</span>
            </div>
          </div>
          
          <div className="flex flex-col">
            {activeTab === 'short' ? (
              filteredScripts.length > 0 ? filteredScripts.map((script) => (
                <div
                  key={script.filename}
                  onClick={() => setSelectedScript(script)}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-[#d0d7de] last:border-0 hover:bg-[#f3f4f6] cursor-pointer group transition-colors"
                >
                  <div className="flex items-center gap-3 w-1/3">
                    <FileCode className="w-5 h-5 text-[#57606a]" />
                    <span className="text-[#0969da] text-sm font-medium hover:underline truncate">{script.filename}</span>
                  </div>
                  <div className="hidden sm:block text-sm text-[#57606a] w-1/3 truncate">
                    {script.name}
                  </div>
                  <div className="text-sm text-[#57606a] text-right w-1/3">
                    {script.createTime !== '未知' ? script.createTime : 'recently'}
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center text-[#57606a]">No scripts found.</div>
              )
            ) : (
              filteredProjects.length > 0 ? filteredProjects.map((project) => (
                <div
                  key={project.name}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-[#d0d7de] last:border-0 hover:bg-[#f3f4f6] transition-colors group"
                >
                  <div className="flex items-center gap-3 w-1/3">
                    <FolderArchive className="w-5 h-5 text-[#54aeff]" />
                    <span className="text-[#0969da] text-sm font-medium truncate">{project.name}</span>
                  </div>
                  <div className="hidden sm:block text-sm text-[#57606a] w-1/3">
                    Contains {Object.keys(project.files).length} files
                  </div>
                  <div className="text-right w-1/3">
                    <button
                      onClick={() => downloadProject(project)}
                      className="px-3 py-1 bg-[#f6f8fa] border border-[#d0d7de] text-[#24292f] text-xs font-semibold rounded-md shadow-sm hover:bg-[#f3f4f6] transition-colors"
                    >
                      Download ZIP
                    </button>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center text-[#57606a]">No projects found.</div>
              )
            )}
          </div>
        </div>
      </main>

      {/* Script Detail Modal */}
      {selectedScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#f6f8fa] px-4 py-3 border-b border-[#d0d7de] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <FileCode className="w-5 h-5 text-[#57606a]" />
                <h3 className="text-[#24292f] font-semibold">{selectedScript.filename}</h3>
                <span className="px-2 py-0.5 bg-[#eaf5ff] text-[#0969da] border border-[#b6e3ff] rounded-full text-xs font-medium">
                  {selectedScript.language}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => downloadScript(selectedScript)}
                  className="p-1.5 text-[#57606a] hover:text-[#24292f] hover:bg-slate-200 rounded-md transition-colors tooltip-trigger"
                  title="Download Script"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => copyScript(selectedScript)}
                  className="p-1.5 text-[#57606a] hover:text-[#24292f] hover:bg-slate-200 rounded-md transition-colors"
                  title="Copy Content"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-[#d0d7de] mx-1" />
                <button 
                  onClick={() => setSelectedScript(null)}
                  className="p-1.5 text-[#57606a] hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto flex flex-col bg-white">
              {/* Meta Info Bar */}
              <div className="px-6 py-4 border-b border-[#d0d7de] bg-white flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#24292f]">Name:</span>
                  <span className="text-[#57606a]">{selectedScript.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#24292f]">Author:</span>
                  <span className="text-[#57606a]">{selectedScript.author}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#24292f]">Created:</span>
                  <span className="text-[#57606a]">{selectedScript.createTime}</span>
                </div>
                <div className="w-full mt-1">
                  <span className="font-semibold text-[#24292f]">Usage: </span>
                  <code className="px-1.5 py-0.5 bg-[#f6f8fa] text-[#24292f] rounded border border-[#d0d7de]">{selectedScript.usage}</code>
                </div>
              </div>

              {/* Code Container */}
              <div className="flex-1 bg-[#0d1117] overflow-auto custom-scrollbar-dark text-[13px] leading-relaxed relative">
                <SyntaxHighlighter
                  language={selectedScript.language}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    background: 'transparent',
                    fontSize: '13px',
                    fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                  }}
                  showLineNumbers={true}
                  wrapLines={false}
                  lineNumberStyle={{
                    minWidth: '3em',
                    paddingRight: '1em',
                    color: '#484f58',
                    textAlign: 'right'
                  }}
                >
                  {selectedScript.content}
                </SyntaxHighlighter>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar-dark::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .custom-scrollbar-dark::-webkit-scrollbar-track {
          background: #0d1117;
        }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb {
          background: #484f58;
          border: 2px solid #0d1117;
          border-radius: 6px;
        }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb:hover {
          background: #8b949e;
        }
      `}</style>
    </div>
  )
}

export default App
