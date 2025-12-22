
import React, { useState, useRef } from 'react';
import { X, Link, Copy, Check, Code2, Download, Upload, FileCode, Eye } from 'lucide-react';
import Button from './Button';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnterDevMode: () => void;
  onExportProject: () => void;
  onExportHTML: () => void;
  onPreviewHTML: () => void;
  onImportProject: (file: File) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ 
  isOpen, 
  onClose, 
  onEnterDevMode, 
  onExportProject, 
  onExportHTML,
  onPreviewHTML,
  onImportProject 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          onImportProject(file);
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-gray-900 font-bold text-lg flex items-center gap-2">
            <Link size={20} className="text-indigo-600"/> 分享与导出
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
            {/* EXPORT OPTIONS */}
            <div className="space-y-4">
                 <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                     <h4 className="font-bold text-indigo-900 text-sm mb-2">交付研发</h4>
                     <div className="grid grid-cols-2 gap-3">
                         <Button variant="primary" onClick={onPreviewHTML} className="w-full justify-center shadow-indigo-200">
                             <Eye size={18} className="mr-2" />
                             在线预览
                         </Button>
                         <Button variant="secondary" onClick={onExportHTML} className="w-full justify-center shadow-sm">
                             <FileCode size={18} className="mr-2" />
                             下载 HTML
                         </Button>
                     </div>
                     <p className="text-xs text-indigo-600 mt-2">
                        生成包含完整项目页面的单文件 HTML 报告，无需联网即可查看。
                    </p>
                 </div>

                 <div className="border-t border-gray-100 pt-4">
                     <label className="block text-sm font-medium text-gray-700 mb-3">项目存档</label>
                     <div className="grid grid-cols-2 gap-3">
                        <Button variant="secondary" onClick={onExportProject} className="w-full justify-center">
                            <Download size={16} className="mr-2" />
                            .dsync 备份
                        </Button>
                        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full justify-center">
                            <Upload size={16} className="mr-2" />
                            导入备份
                        </Button>
                     </div>
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json,.dsync" 
                        onChange={handleFileChange} 
                     />
                 </div>
            </div>

            {/* DEV MODE TOGGLE */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start gap-3 mt-2">
                <div className="p-2 bg-white border border-gray-200 rounded-full text-gray-600 shrink-0 shadow-sm">
                    <Code2 size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-gray-900 text-sm">本机研发模式</h4>
                    <p className="text-xs text-gray-500 mt-1 mb-3">
                        直接在当前浏览器切换至研发视角，隐藏编辑功能。
                    </p>
                    <button 
                        onClick={() => { onEnterDevMode(); onClose(); }}
                        className="text-xs font-bold text-gray-700 hover:text-indigo-600 hover:underline transition-all"
                    >
                        切换至研发视角 →
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
