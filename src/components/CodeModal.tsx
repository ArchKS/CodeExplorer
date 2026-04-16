import React, { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { X, Download, Copy, Check, Eye, Code, Image as ImageIcon } from 'lucide-react';

interface CodeModalProps {
  filePath: string;
  fileName: string;
  prevImage?: string;
  initialMode?: 'source' | 'image';
  onClose: () => void;
}

const CodeModal: React.FC<CodeModalProps> = ({ filePath, fileName, prevImage, initialMode, onClose }) => {
  const [code, setCode] = useState<string>('Loading...');
  const [language, setLanguage] = useState<string>('javascript');
  const [copied, setCopied] = useState(false);
  const isHtml = fileName.toLowerCase().endsWith('.html');
  const [viewMode, setViewMode] = useState<'source' | 'preview' | 'image'>(
    initialMode || (isHtml ? 'preview' : 'source')
  );

  useEffect(() => {
    const fetchCode = async () => {
      try {
        const response = await fetch(filePath);
        const text = await response.text();
        setCode(text);
        
        const extension = fileName.split('.').pop()?.toLowerCase() || '';
        const langMap: { [key: string]: string } = {
          js: 'javascript',
          ts: 'typescript',
          tsx: 'typescript',
          jsx: 'javascript',
          py: 'python',
          css: 'css',
          html: 'html',
          json: 'json',
          md: 'markdown',
        };
        setLanguage(langMap[extension] || 'javascript');
      } catch (error) {
        setCode('Error loading file: ' + error);
      }
    };

    fetchCode();
  }, [filePath, fileName]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = filePath;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 cursor-pointer"
      onClick={onClose}
    >
      <div 
        className={`relative w-full ${viewMode === 'preview' ? 'max-w-[1500px]' : 'max-w-5xl'} max-h-[90vh] bg-gray-900 rounded-lg overflow-hidden flex flex-col shadow-2xl cursor-default transition-all duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center gap-4">
            <h2 className="text-white font-mono text-sm truncate max-w-[200px]">{fileName}</h2>
            {isHtml && (
              <div className="flex bg-gray-700 rounded-md p-1">
                <button
                  onClick={() => setViewMode('source')}
                  className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                    viewMode === 'source' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Code size={14} />
                  Code
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                    viewMode === 'preview' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Eye size={14} />
                  Preview
                </button>
              </div>
            )}
            {prevImage && (
              <button
                onClick={() => setViewMode(viewMode === 'image' ? (isHtml ? 'preview' : 'source') : 'image')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all border ${
                  viewMode === 'image' 
                    ? 'bg-purple-600 text-white border-purple-400 shadow-inner' 
                    : 'bg-gray-700 text-purple-300 border-purple-500/30 hover:bg-gray-600 hover:text-white'
                }`}
                title="Preview Result Image"
              >
                <ImageIcon size={14} />
                {viewMode === 'image' ? 'Close Preview' : 'Image Preview'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleCopy}
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              title="Copy Code"
            >
              {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              <span className="text-xs hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="text-gray-400 hover:text-white transition-colors"
              title="Download"
            >
              <Download size={20} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto bg-[#1e1e1e] flex flex-col">
          {viewMode === 'image' ? (
            <div className="flex justify-center w-full min-h-full bg-gray-900 p-4">
              <img 
                src={prevImage} 
                alt="Preview" 
                className="max-w-full h-auto object-contain shadow-2xl rounded self-start"
              />
            </div>
          ) : viewMode === 'preview' ? (
            <div className="flex items-center justify-center w-full h-full bg-gray-100 p-8">
              <iframe
                src={filePath}
                className="w-[90%] h-[80vh] bg-white shadow-lg border border-gray-200"
                title="HTML Preview"
              />
            </div>
          ) : (
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              showLineNumbers={true}
              customStyle={{
                margin: 0,
                padding: '1.5rem',
                backgroundColor: 'transparent',
                fontSize: '14px',
                lineHeight: '1.6',
              }}
              codeTagProps={{
                style: {
                  display: 'block',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }
              }}
            >
              {code}
            </SyntaxHighlighter>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeModal;
