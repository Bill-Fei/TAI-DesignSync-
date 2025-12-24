
import React, { useState, useRef, useEffect } from 'react';
import { X, Link, Copy, Check, Code2, Download, Upload, FileCode, Eye, Globe, Github, Image as ImageIcon, Clipboard, Figma } from 'lucide-react';
import Button from './Button';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportProject: () => void;
  onExportHTML: () => void;
  onPreviewHTML: () => void;
  onImportProject: (file: File) => void;
  onPublishToGist: (token: string, description: string) => Promise<string>;
  onDownloadPNG: () => void;
  onCopyForFigma: () => void;
  activeProjectFigmaUrl?: string;
  onUpdateFigmaUrl?: (url: string) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ 
  isOpen, 
  onClose, 
  onExportProject, 
  onExportHTML,
  onPreviewHTML,
  onImportProject,
  onPublishToGist,
  onDownloadPNG,
  onCopyForFigma,
  activeProjectFigmaUrl,
  onUpdateFigmaUrl
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'export' | 'publish'>('export');
  
  // Publish State
  const [githubToken, setGithubToken] = useState('');
  const [description, setDescription] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load token from local storage
  useEffect(() => {
    const savedToken = localStorage.getItem('ds_gh_token');
    if (savedToken) setGithubToken(savedToken);
  }, []);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          onImportProject(file);
          onClose();
      }
  };

  const handlePublish = async () => {
    if (!githubToken) {
      setErrorMsg('请输入 GitHub Token');
      return;
    }
    
    setIsPublishing(true);
    setErrorMsg('');
    try {
      localStorage.setItem('ds_gh_token', githubToken);
      const url = await onPublishToGist(githubToken, description);
      setPublishedUrl(url);
    } catch (e: any) {
      setErrorMsg(e.message || '发布失败，请检查 Token 权限');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('export')}
              className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'export' ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
            >
              分享与导出
            </button>
            <button 
              onClick={() => setActiveTab('publish')}
              className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'publish' ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
            >
              发布到 Web
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
            {activeTab === 'export' ? (
                /* EXPORT OPTIONS */
                <div className="space-y-6">
                     <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                         <h4 className="font-bold text-indigo-900 text-sm mb-3">交付研发</h4>
                         
                         {onUpdateFigmaUrl && (
                             <div className="mb-4">
                                <label className="block text-xs font-bold text-indigo-800 mb-1.5 flex items-center gap-1">
                                    <Figma size={12}/> Figma 原稿链接 (可选)
                                </label>
                                <input 
                                    type="text" 
                                    value={activeProjectFigmaUrl || ''} 
                                    onChange={(e) => onUpdateFigmaUrl(e.target.value)}
                                    className="w-full text-xs border border-indigo-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    placeholder="https://www.figma.com/file/..."
                                />
                                <p className="text-[10px] text-indigo-400 mt-1">填入链接后，导出的 HTML 报告将支持直接预览 Figma 标注。</p>
                             </div>
                         )}

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
                         <p className="text-xs text-indigo-600 mt-2 leading-relaxed">
                            生成包含完整项目页面的单文件 HTML 报告。报告支持离线查看，可导出带截图的 Excel 问题清单。
                        </p>
                     </div>

                     <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                         <h4 className="font-bold text-gray-900 text-sm mb-2">视觉导出 / Figma</h4>
                         <div className="grid grid-cols-2 gap-3">
                             <Button variant="secondary" onClick={onDownloadPNG} className="w-full justify-center shadow-sm">
                                 <ImageIcon size={18} className="mr-2" />
                                 下载长图 PNG
                             </Button>
                             <Button variant="secondary" onClick={onCopyForFigma} className="w-full justify-center shadow-sm text-indigo-600 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50">
                                 <Clipboard size={18} className="mr-2" />
                                 复制到 Figma
                             </Button>
                         </div>
                         <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                            “复制到 Figma” 将生成报告截图并存入剪贴板，您可以在 Figma 中直接 Ctrl+V 粘贴。
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
                                导入反馈/备份
                            </Button>
                         </div>
                         <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".json,.dsync,.html" 
                            onChange={handleFileChange} 
                         />
                     </div>
                </div>
            ) : (
                /* PUBLISH OPTIONS */
                <div className="space-y-4">
                  {!publishedUrl ? (
                    <>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
                        <div className="flex items-start gap-3">
                           <Github size={20} className="shrink-0 mt-0.5 text-gray-900"/>
                           <div>
                              <p className="font-bold text-gray-900 mb-1">使用 GitHub Gist 发布</p>
                              <p className="text-xs mb-2">我们将您的报告作为一个匿名的 Secret Gist 上传，并生成一个公开可访问的预览链接。</p>
                              <p className="text-xs text-gray-500">注意：需要 GitHub Personal Access Token (Gist 权限)。</p>
                           </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">GitHub Token (需勾选 'gist' 权限)</label>
                          <input 
                            type="password" 
                            value={githubToken} 
                            onChange={e => setGithubToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxx"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                          <a href="https://github.com/settings/tokens/new?scopes=gist&description=DesignSync" target="_blank" className="text-[10px] text-indigo-600 hover:underline mt-1 block text-right">
                             获取 Token →
                          </a>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-700 mb-1">描述 (可选)</label>
                           <input 
                              type="text" 
                              value={description}
                              onChange={e => setDescription(e.target.value)}
                              placeholder="关于这个走查报告的简短描述..."
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                           />
                        </div>
                      </div>

                      {errorMsg && (
                        <div className="p-3 bg-red-50 text-red-600 text-xs rounded border border-red-100">
                          {errorMsg}
                        </div>
                      )}

                      <Button variant="primary" className="w-full justify-center" onClick={handlePublish} isLoading={isPublishing}>
                        <Globe size={16} className="mr-2" />
                        生成在线链接
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-6 space-y-6 animate-in zoom-in-95">
                       <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Check size={32} />
                       </div>
                       <div>
                          <h4 className="font-bold text-xl text-gray-900">发布成功！</h4>
                          <p className="text-sm text-gray-500 mt-1">任何人都可以通过以下链接访问此报告。</p>
                       </div>
                       
                       <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2">
                          <div className="flex-1 truncate text-xs text-gray-600 font-mono select-all">
                             {publishedUrl}
                          </div>
                          <button 
                            onClick={() => navigator.clipboard.writeText(publishedUrl)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded transition-colors"
                            title="复制链接"
                          >
                             <Copy size={14} />
                          </button>
                       </div>

                       <div className="grid grid-cols-2 gap-3">
                          <Button variant="secondary" onClick={() => window.open(publishedUrl, '_blank')}>
                             <Eye size={16} className="mr-2" /> 打开链接
                          </Button>
                          <Button variant="ghost" onClick={() => setPublishedUrl('')}>
                             返回
                          </Button>
                       </div>
                    </div>
                  )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
