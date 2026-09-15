import React from 'react';
import { X, ExternalLink, RefreshCw, Monitor, Smartphone } from 'lucide-react';

interface WebPreviewModalProps {
  htmlContent: string;
  title: string;
  onClose: () => void;
}

export const WebPreviewModal: React.FC<WebPreviewModalProps> = ({
  htmlContent,
  title,
  onClose
}) => {
  const [viewMode, setViewMode] = React.useState<'desktop' | 'mobile'>('desktop');

  return (
    <div
      id="web-preview-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-5xl h-[85vh] bg-[#1e1f22] rounded-2xl shadow-2xl border border-[#35373c] flex flex-col overflow-hidden">
        {/* Browser Top Bar */}
        <div className="h-12 bg-[#2b2d31] px-4 border-b border-[#1f2023] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#f23f43]" />
            <span className="w-3 h-3 rounded-full bg-[#f0b232]" />
            <span className="w-3 h-3 rounded-full bg-[#23a55a]" />
            <span className="text-xs font-semibold text-[#dbdee1] ml-2 truncate max-w-xs">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-[#1e1f22] px-2 py-1 rounded border border-[#35373c]">
            <button
              onClick={() => setViewMode('desktop')}
              className={`p-1 rounded ${viewMode === 'desktop' ? 'bg-[#404249] text-white' : 'text-[#949ba4]'}`}
              title="Desktop View"
            >
              <Monitor size={14} />
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`p-1 rounded ${viewMode === 'mobile' ? 'bg-[#404249] text-white' : 'text-[#949ba4]'}`}
              title="Mobile View"
            >
              <Smartphone size={14} />
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-[#b5bac1] hover:text-white p-1 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Iframe Sandbox */}
        <div className="flex-1 bg-[#111214] flex items-center justify-center p-4 overflow-hidden">
          <div
            className={`h-full bg-white rounded-lg shadow-xl overflow-hidden transition-all duration-300 ${
              viewMode === 'mobile' ? 'w-[375px]' : 'w-full'
            }`}
          >
            <iframe
              title="Interactive Prototype Preview"
              srcDoc={`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { margin: 0; font-family: system-ui, sans-serif; }</style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6">
  ${htmlContent}
</body>
</html>`}
              className="w-full h-full border-0"
              sandbox="allow-scripts"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
