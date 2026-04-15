import React from 'react';
import { FileCode, Folder, Download } from 'lucide-react';

interface CodeCardProps {
  name: string;
  type: 'file' | 'directory';
  intro?: string;
  onClick: () => void;
  onDownload: (e: React.MouseEvent) => void;
}

const CodeCard: React.FC<CodeCardProps> = ({ name, type, intro, onClick, onDownload }) => {
  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-center justify-start min-h-[160px] gap-3"
    >
      <button
        onClick={onDownload}
        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
        title="Download"
      >
        <Download size={18} />
      </button>

      <div className="pt-4 flex flex-col items-center gap-2">
        {type === 'file' ? (
          <FileCode size={40} className="text-blue-500" />
        ) : (
          <Folder size={40} className="text-yellow-500" />
        )}

        {intro && (
          <p className=" text-sm mt-4 font-bold text-gray-800 line-clamp-2 px-3 text-center leading-tight">
            {intro}
          </p>
        )}

        <span className="text-[11px] text-gray-500 truncate w-full text-center px-2">
          {name}
        </span>
      </div>



      {/* <div className="mt-auto pb-3 text-[10px] uppercase tracking-widest text-gray-400 font-bold">
        {type}
      </div> */}
    </div>
  );
};

export default CodeCard;
