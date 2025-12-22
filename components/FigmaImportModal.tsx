
import React, { useState } from 'react';
import { X, Figma, Check, AlertCircle, Link } from 'lucide-react';
import Button from './Button';

interface FigmaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (url: string) => void;
}

const FigmaImportModal: React.FC<FigmaImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleImport = () => {
    if (!url) return;
    setStatus('loading');
    
    // Simulate API delay and processing
    setTimeout(() => {
        // Validation check (mock)
        if (url.includes('figma.com')) {
           setStatus('success');
           setTimeout(() => {
               onImport(url);
               setStatus('idle');
               setUrl('');
               onClose();
           }, 1000);
        } else {
           setStatus('error');
        }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2 text-gray-900 font-bold">
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white">
               <Figma size={18} />
            </div>
            <span>Figma 快速导入</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
            <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">
                提示：请输入 Figma 的 Frame 链接（Copy Link）。目前仅保留 URL 记录功能。
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Figma 链接 (URL)</label>
                <div className="relative">
                  <input 
                      type="text" 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-black focus:border-black outline-none"
                      placeholder="https://www.figma.com/file/..."
                  />
                  <Link className="absolute left-3 top-2.5 text-gray-400" size={16} />
                </div>
            </div>

            {status === 'error' && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle size={16} />
                    <span>请输入有效的 Figma 链接。</span>
                </div>
            )}
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <button 
             onClick={handleImport}
             disabled={status === 'loading' || !url}
             className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all ${
                 status === 'success' ? 'bg-green-600' : 'bg-black hover:bg-gray-800'
             }`}
          >
             {status === 'loading' && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
             {status === 'success' && <Check size={16} />}
             {status === 'loading' ? '正在解析...' : status === 'success' ? '导入成功' : '导入'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FigmaImportModal;
