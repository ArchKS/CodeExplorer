import React from 'react';
import { FileCode, Folder, Download, Image as ImageIcon, Star } from 'lucide-react';

interface CodeCardProps {
  name: string;
  type: 'file' | 'directory';
  intro?: string;
  star?: number;
  hasPrev?: boolean;
  onClick: () => void;
  onDownload: (e: React.MouseEvent) => void;
  onPreviewImage?: (e: React.MouseEvent) => void;
}

export const CodeCard: React.FC<CodeCardProps> = ({ name, type, intro, hasPrev, star, onClick, onDownload, onPreviewImage }) => {
  // ai coding: 将代码卡片改为紧凑横向布局，收拢图标与星标并按需显示操作按钮 2026/09/11: 14:54
  return (
    <div
      onClick={onClick}
      className="group relative flex min-h-[88px] cursor-pointer items-start rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-blue-400 hover:shadow-md"
    >
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded bg-white/95 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {hasPrev && onPreviewImage && (
          <button
            onClick={onPreviewImage}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-purple-50 hover:text-purple-600"
            title="Image Preview"
          >
            <ImageIcon size={15} />
          </button>
        )}
        <button
          onClick={onDownload}
          className="rounded p-1 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-500"
          title="Download"
        >
          <Download size={15} />
        </button>
      </div>

      <div className="flex w-full min-w-0 items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${type === 'file' ? 'bg-blue-50' : 'bg-yellow-50'}`}>
          {type === 'file' ? (
            <FileCode size={22} className="text-blue-500" />
          ) : (
            <Folder size={22} className="text-yellow-500" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {star && star > 0 ? (
            <div className="mb-1 flex gap-px" aria-label={`${star} stars`}>
              {[...Array(star)].map((_, i) => (
                <Star key={i} size={11} className="fill-yellow-400 text-yellow-400" />
              ))}
            </div>
          ) : null}
          <p className="line-clamp-2 text-sm font-bold leading-snug text-gray-800">
            {intro || name}
          </p>
          {intro && (
            <span className="mt-1 block truncate text-[11px] text-gray-500">
              {name}
            </span>
          )}
          {!intro && (
            <span className="mt-1 block text-[10px] uppercase tracking-wide text-gray-400">
              {type}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
