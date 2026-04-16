import React from 'react';
import { FileCode, Folder, Download, Image as ImageIcon } from 'lucide-react';

interface CodeCardProps {
  name: string;
  type: 'file' | 'directory';
  intro?: string;
  hasPrev?: boolean;
  onClick: () => void;
  onDownload: (e: React.MouseEvent) => void;
  onPreviewImage?: (e: React.MouseEvent) => void;
}

const CodeCard: React.FC<CodeCardProps> = ({ name, type, intro, hasPrev, onClick, onDownload, onPreviewImage }) => {
  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-center justify-start min-h-[160px] gap-3"
    >
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {hasPrev && onPreviewImage && (
          <button
            onClick={onPreviewImage}
            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
            title="Image Preview"
          >
            <ImageIcon size={18} />
          </button>
        )}
        <button
          onClick={onDownload}
          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
          title="Download"
        >
          <Download size={18} />
        </button>
      </div>

      <div className="pt-4 flex flex-col items-center gap-2 w-full text-center">
        {type === 'file' ? (
          <FileCode size={40} className="text-blue-500" />
        ) : (
          <Folder size={40} className="text-yellow-500" />
        )}

        {intro && (
          <p className="text-sm mt-2 font-bold text-gray-800 line-clamp-2 px-1 leading-tight">
            {intro}
          </p>
        )}

        <span className="text-[11px] text-gray-400 truncate w-full mt-1 px-2">
          {name}
        </span>
      </div>
    </div>
  );
};

export default CodeCard;
