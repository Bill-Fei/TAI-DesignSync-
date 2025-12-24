
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';
import { 
  Project, 
  Issue, 
  Annotation, 
  TabMode, 
  ComparisonMode, 
  ToolMode, 
  DevImage 
} from './types';
import { analyzeVisualDifferences } from './services/geminiService';

import ProjectSidebar from './components/ProjectSidebar';
import ComparisonView from './components/ComparisonView';
import IssueList from './components/IssueList';
import ShareModal from './components/ShareModal';
import FigmaImportModal from './components/FigmaImportModal';
import Button from './components/Button';

import { 
  Upload, 
  Layers, 
  Layout, 
  Share2, 
  Eye, 
  EyeOff, 
  MousePointer2, 
  Hand, 
  Pipette, 
  Ruler, 
  BoxSelect, 
  Scan,
  Figma as FigmaIcon,
  ArrowRight,
  Image as ImageIcon,
  RefreshCw,
  X,
  Trash2,
  ClipboardPaste,
  Move,
  Undo2,
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  XCircle
} from 'lucide-react';

const INITIAL_PROJECT_ID = uuidv4();

const DEFAULT_PROJECTS: Project[] = [
  {
    id: INITIAL_PROJECT_ID,
    name: '示例页面',
    designImage: null,
    devImages: [],
    activeDevImageId: null,
    issues: [],
    annotations: []
  }
];

const App: React.FC = () => {
  // History State
  const [past, setPast] = useState<Project[][]>([]);
  
  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>(INITIAL_PROJECT_ID);
  const [tabMode, setTabMode] = useState<TabMode>(TabMode.UPLOAD);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(ComparisonMode.SIDE_BY_SIDE);
  // Default to HAND mode for better navigation experience
  const [activeTool, setActiveTool] = useState<ToolMode>(ToolMode.HAND);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isFigmaModalOpen, setIsFigmaModalOpen] = useState(false);

  // Drag Drop State
  const [dragOverTarget, setDragOverTarget] = useState<'design' | 'dev' | null>(null);

  // Viewport State
  const [scale, setScale] = useState(0.25);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [overlayOffset, setOverlayOffset] = useState({ x: 0, y: 0 });

  // Spacebar Panning State
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Ref for the main content area to capture (single page)
  const mainContentRef = useRef<HTMLDivElement>(null);
  // Ref for the full export content area (all pages)
  const fullExportRef = useRef<HTMLDivElement>(null);

  // --- History Logic ---
  const pushHistory = useCallback(() => {
    setPast(prev => {
      const newPast = [...prev, projects];
      return newPast.slice(-20); // Keep last 20 steps
    });
  }, [projects]);

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    
    setPast(newPast);
    setProjects(previous);
  }, [past]);

  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || projects[0],
  [projects, activeProjectId]);

  const activeDevImage = useMemo(() => 
    activeProject.devImages.find(img => img.id === activeProject.activeDevImageId) || activeProject.devImages[0],
  [activeProject]);

  const activeDevImageId = activeProject.activeDevImageId;

  const updateActiveProject = useCallback((updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, ...updates } : p));
  }, [activeProjectId]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.metaKey || e.ctrlKey;

      // Spacebar for panning
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      // Undo: Ctrl+Z / Cmd+Z
      if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Zoom In: Ctrl + =/+
      if (isCtrlOrCmd && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setScale(s => Math.min(s * 1.2, 5));
      }

      // Zoom Out: Ctrl + -/_
      if (isCtrlOrCmd && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setScale(s => Math.max(s / 1.2, 0.1));
      }
      
      // Reset Zoom: Ctrl + 0
      if (isCtrlOrCmd && e.key === '0') {
         e.preventDefault();
         setScale(1);
         setPosition({x:0, y:0});
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleUndo]);

  // --- Common File Processing ---
  const handleFileProcess = useCallback((file: File, type: 'design' | 'dev') => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      pushHistory();
      if (type === 'design') {
        updateActiveProject({ designImage: data });
      } else {
        const newImg = { id: uuidv4(), name: file.name, data };
        updateActiveProject({ 
            devImages: [...activeProject.devImages, newImg], 
            activeDevImageId: newImg.id 
        });
      }
    };
    reader.readAsDataURL(file);
  }, [activeProject, updateActiveProject, pushHistory]);

  // --- Paste Handler ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files.length) return;
      const file = Array.from(e.clipboardData.files).find(f => f.type.startsWith('image/'));
      if (!file) return;

      e.preventDefault();
      // If no design image, paste as design. Otherwise append to dev images.
      const type = !activeProject.designImage ? 'design' : 'dev';
      handleFileProcess(file, type);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeProject, handleFileProcess]);

  const handleAddProject = () => {
    pushHistory();
    const newId = uuidv4();
    setProjects([...projects, { id: newId, name: `新任务 ${projects.length + 1}`, designImage: null, devImages: [], activeDevImageId: null, issues: [], annotations: [] }]);
    setActiveProjectId(newId);
    setTabMode(TabMode.UPLOAD);
  };

  const handleDeleteProject = (id: string) => {
    pushHistory();
    if (projects.length <= 1) return;
    const newProjects = projects.filter(p => p.id !== id);
    setProjects(newProjects);
    if (activeProjectId === id) setActiveProjectId(newProjects[0].id);
  };

  const handleRenameProject = (id: string, name: string) => {
    pushHistory();
    setProjects(projects.map(p => p.id === id ? { ...p, name } : p));
  };

  // --- Drag and Drop Handlers ---
  const onDragOver = (e: React.DragEvent, target: 'design' | 'dev') => {
    e.preventDefault();
    setDragOverTarget(target);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTarget(null);
  };

  const onDrop = (e: React.DragEvent, target: 'design' | 'dev') => {
    e.preventDefault();
    setDragOverTarget(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
       Array.from(e.dataTransfer.files).forEach(file => {
          handleFileProcess(file, target);
       });
       e.dataTransfer.clearData();
    }
  };

  const handleInputUpload = (type: 'design' | 'dev', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => handleFileProcess(file, type));
    e.target.value = ''; // Reset input
  };

  const startAnalysis = async () => {
    if (!activeProject.designImage || !activeDevImage) return;
    pushHistory(); // Save state before AI modifies it
    setIsAnalyzing(true);
    setAiProgress(10);
    const progressInterval = setInterval(() => { setAiProgress(prev => (prev < 90 ? prev + 5 : prev)); }, 300);
    try {
      const aiIssues = await analyzeVisualDifferences(activeProject.designImage, activeDevImage.data);
      const newIssues: Issue[] = [];
      const newAnnotations: Annotation[] = [];

      aiIssues.forEach((item: any) => {
         const annId = uuidv4();
         if (item.boundingBox && Array.isArray(item.boundingBox) && item.boundingBox.length === 4) {
             const [ymin, xmin, ymax, xmax] = item.boundingBox;
             newAnnotations.push({
                 id: annId,
                 devImageId: activeDevImageId!,
                 x: xmin / 10,
                 y: ymin / 10,
                 width: (xmax - xmin) / 10,
                 height: (ymax - ymin) / 10,
                 text: item.title,
                 type: 'ai'
             });
         }
         newIssues.push({
             id: uuidv4(),
             devImageId: activeDevImageId!,
             title: item.title,
             description: item.description,
             suggestion: item.suggestion,
             severity: item.severity || 'medium',
             status: 'open',
             annotationId: newAnnotations.length > 0 ? annId : undefined
         });
      });

      setAiProgress(100);
      setTimeout(() => { 
        updateActiveProject({ 
            issues: [...activeProject.issues, ...newIssues],
            annotations: [...activeProject.annotations, ...newAnnotations]
        });
        setIsAnalyzing(false);
        setAiProgress(0);
        if (newIssues.length > 0) setActiveIssueId(newIssues[0].id);
      }, 300);
    } catch (e) {
      alert("AI 分析失败");
      setIsAnalyzing(false);
      setAiProgress(0);
    } finally {
      clearInterval(progressInterval);
    }
  };

  // --- Screenshot / Export Logic ---
  const handleCaptureScreenshot = async (mode: 'download' | 'clipboard') => {
      // 1. Close Modal visually first
      setIsShareModalOpen(false);

      // 2. Wait for modal transition to finish
      await new Promise(resolve => setTimeout(resolve, 300));

      // We now capture the FULL export view containing ALL projects
      const targetRef = fullExportRef.current; 

      if (targetRef) {
          try {
              // Ensure images are loaded in the hidden view
              const images = targetRef.querySelectorAll('img');
              await Promise.all(Array.from(images).map(imgNode => {
                  const img = imgNode as HTMLImageElement;
                  if (img.complete) return Promise.resolve();
                  return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
              }));

              const canvas = await html2canvas(targetRef, {
                  useCORS: true,
                  scale: 2, // Retina quality
                  logging: false,
                  backgroundColor: '#f8fafc', // match bg-slate-50
              });

              if (mode === 'download') {
                  const link = document.createElement('a');
                  link.download = `DesignSync-Full-Report-${new Date().toLocaleDateString()}.png`;
                  link.href = canvas.toDataURL('image/png');
                  link.click();
              } else {
                  canvas.toBlob(blob => {
                      if (blob) {
                          try {
                              navigator.clipboard.write([
                                  new ClipboardItem({ 'image/png': blob })
                              ]).then(() => {
                                  alert('✅ 完整项目报告已复制到剪贴板 (Figma 可直接粘贴)');
                              }).catch(err => {
                                  console.error('Clipboard write failed', err);
                                  alert('复制失败，请使用下载功能。');
                              });
                          } catch (err) {
                               alert('当前浏览器不支持直接复制图片，请使用下载功能。');
                          }
                      }
                  });
              }
          } catch (err) {
              console.error(err);
              alert('生成截图失败，请重试');
          }
      }
  };


  const generateReportHTML = () => {
      // Create a simplified data structure for the report
      const reportData = {
          generatedAt: new Date().toLocaleString(),
          projects: projects.map(p => ({
              id: p.id,
              name: p.name,
              designImage: p.designImage,
              devImage: p.devImages.find(d => d.id === p.activeDevImageId) || p.devImages[0],
              issues: p.issues,
              annotations: p.annotations,
              figmaUrl: p.figmaUrl
          })).filter(p => p.devImage) // Only include projects that have dev images
      };

      return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DesignSync 完整走查报告</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .annotation-box { position: absolute; border: 2px solid #ef4444; background: rgba(239,68,68,0.1); cursor: pointer; transition: all 0.2s; }
        .annotation-box:hover, .annotation-box.active { border-color: #4f46e5; background: rgba(79,70,229,0.2); z-index: 10; box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5); }
        
        .measure-line { cursor: pointer; transition: all 0.2s; position: absolute; }
        .measure-line:hover, .measure-line.active { z-index: 50 !important; filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)); }
        .measure-line:hover > div, .measure-line.active > div { background-color: #4f46e5 !important; color: white !important; border-color: #4f46e5 !important; }

        .color-pill { cursor: pointer; transition: all 0.2s; position: absolute; display: flex; align-items: center; gap: 4px; padding: 2px 6px; background: white; border: 1px solid #e5e7eb; border-radius: 4px; shadow: 0 1px 2px rgba(0,0,0,0.05); z-index: 20; }
        .color-pill:hover, .color-pill.active { border-color: #4f46e5 !important; transform: translate(-50%, -50%) scale(1.1) !important; z-index: 50 !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }

        .manual-pin { cursor: pointer; transition: all 0.2s; position: absolute; width: 16px; height: 16px; margin-left: -8px; margin-top: -8px; border-radius: 50%; border: 2px solid #3b82f6; background: white; z-index: 20; display: flex; align-items: center; justify-content: center; shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .manual-pin:hover, .manual-pin.active { background-color: #4f46e5 !important; border-color: white !important; transform: scale(1.2) !important; z-index: 50 !important; }
        .manual-pin > div { width: 6px; height: 6px; background-color: #3b82f6; border-radius: 50%; }
        .manual-pin:hover > div, .manual-pin.active > div { background-color: white !important; }

        .issue-item:hover { background-color: #f9fafb; border-color: #cbd5e1; }
        .issue-item.active { background-color: #eff6ff; border-left: 4px solid #4f46e5; border-color: #4f46e5; }
        .project-nav-item.active { background-color: #e0e7ff; color: #4338ca; border-right: 3px solid #4f46e5; }
        body { overflow: hidden; }
        #zoom-target { transform-origin: center center; cursor: default; }
        .grabbing { cursor: grabbing !important; }
        .grab { cursor: grab; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .loader { border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; width: 12px; height: 12px; animation: spin 2s linear infinite; display: inline-block; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        /* Figma Modal Styles */
        #figma-modal { display: none; position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); }
        #figma-modal.open { display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    </style>
</head>
<body class="bg-gray-50 h-screen flex flex-col">
    <header class="bg-white border-b border-gray-200 h-14 flex items-center px-6 shrink-0 justify-between z-50 shadow-sm">
        <div class="flex items-center gap-3">
            <div class="bg-indigo-600 text-white p-1.5 rounded font-bold">DS</div>
            <h1 class="font-bold text-lg text-gray-800">DesignSync 走查报告</h1>
        </div>
        <div class="flex items-center gap-4 text-sm text-gray-500">
             <span>${reportData.generatedAt}</span>
             <button id="btn-figma" onclick="openFigmaModal()" class="hidden flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"/><path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"/><path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"/><path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"/><path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"/></svg>
                <span>Figma 预览</span>
             </button>
             <button id="btn-export" onclick="downloadFeedback()" class="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                <span>导出带截图Excel</span>
             </button>
             <a href="#" onclick="window.print()" class="text-indigo-600 hover:underline">打印/PDF</a>
        </div>
    </header>
    <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar for Pages -->
        <div class="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto">
             <div class="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider">页面列表</div>
             <div id="project-list" class="flex-1"></div>
        </div>

        <!-- Main Canvas -->
        <div id="canvas-wrapper" class="flex-1 bg-gray-100 overflow-hidden relative flex items-center justify-center grab">
             <div class="relative transition-transform duration-75 p-10" id="zoom-target" style="width: fit-content; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);">
                
                <div class="flex gap-8 items-start">
                    <!-- Design Image Container -->
                    <div id="design-container" class="relative bg-white shadow-2xl border-4 border-indigo-200 rounded-lg hidden">
                        <div class="absolute -top-10 left-0 bg-indigo-600 text-white px-3 py-1 rounded-t-lg font-bold text-sm shadow">设计稿 Design</div>
                        <img id="design-image" class="block max-w-none pointer-events-none" />
                    </div>

                    <!-- Dev Image Container -->
                    <div class="relative bg-white shadow-2xl border-4 border-emerald-200 rounded-lg">
                        <div class="absolute -top-10 left-0 bg-emerald-600 text-white px-3 py-1 rounded-t-lg font-bold text-sm shadow">实现稿 Dev</div>
                        <img id="main-image" class="block max-w-none pointer-events-none" />
                        <div id="annotations-layer" class="absolute inset-0"></div>
                    </div>
                </div>

             </div>
             
             <!-- Zoom Controls -->
             <div class="absolute bottom-6 right-6 bg-white shadow-xl border p-1 rounded-xl flex items-center gap-1 z-50">
                 <button onclick="zoomOut()" class="p-2 hover:bg-slate-100 rounded-lg text-gray-600">[-]</button>
                 <span id="zoom-level" class="text-xs font-black w-10 text-center text-gray-800">40%</span>
                 <button onclick="zoomIn()" class="p-2 hover:bg-slate-100 rounded-lg text-gray-600">[+]</button>
                 <button onclick="resetZoom()" class="p-2 hover:bg-slate-100 rounded-lg border-l ml-1 text-gray-600">R</button>
             </div>
        </div>
        
        <!-- Issues Sidebar -->
        <div class="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 shadow-xl z-40">
            <div class="p-4 border-b border-gray-100 font-bold text-gray-800 flex flex-col gap-3 bg-white z-10 shadow-sm">
                <div class="flex justify-between items-center">
                    <span>问题列表</span>
                    <span id="issue-count" class="bg-gray-100 px-2 rounded-full text-xs flex items-center">0</span>
                </div>
                <!-- Status Stats -->
                <div class="grid grid-cols-4 gap-2" id="status-stats">
                   <!-- Populated by JS -->
                </div>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 smooth-scroll" id="issue-list"></div>
        </div>
    </div>

    <!-- Figma Preview Modal -->
    <div id="figma-modal" onclick="closeFigmaModal(event)">
        <div class="w-[90vw] h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col relative" onclick="event.stopPropagation()">
             <div class="h-14 bg-gray-900 flex items-center justify-between px-6 shrink-0 shadow-md relative z-20">
                  <div class="flex items-center gap-4">
                      <div class="flex items-center gap-2 text-white font-bold text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"/><path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"/><path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"/><path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"/><path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"/></svg>
                          <span>Figma 预览</span>
                      </div>
                      <div class="h-4 w-[1px] bg-gray-700"></div>
                      <a id="figma-external-link" href="#" target="_blank" class="flex items-center gap-2 text-xs font-bold text-indigo-300 hover:text-white transition-colors bg-indigo-900/40 px-3 py-1.5 rounded-lg border border-indigo-500/30 hover:border-indigo-400 group">
                          <span>跳转 Figma 查看标注 (Inspect)</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:translate-x-0.5 transition-transform"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                      </a>
                  </div>
                  <div class="flex items-center gap-6">
                      <div class="text-[10px] text-gray-400 flex items-center gap-1.5 hidden sm:flex">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-orange-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          嵌入视图仅供预览，点击左侧按钮获取详细参数
                      </div>
                      <button onclick="closeFigmaModal()" class="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                  </div>
             </div>
             <div class="flex-1 bg-gray-900 flex items-center justify-center relative">
                 <div id="figma-loader" class="absolute inset-0 flex items-center justify-center text-gray-500 gap-2">
                     <span class="loader"></span> 加载中...
                 </div>
                 <iframe id="figma-frame" class="w-full h-full border-0 relative z-10" allowfullscreen allow="clipboard-read; clipboard-write; fullscreen"></iframe>
             </div>
        </div>
    </div>

    <script>
        const reportData = ${JSON.stringify(reportData)};
        let activeProjectIndex = 0;
        let activeProject = reportData.projects[0];

        const projectListEl = document.getElementById('project-list');
        const annotationsLayer = document.getElementById('annotations-layer');
        const issueList = document.getElementById('issue-list');
        const zoomTarget = document.getElementById('zoom-target');
        const zoomLevelEl = document.getElementById('zoom-level');
        const wrapper = document.getElementById('canvas-wrapper');
        const mainImage = document.getElementById('main-image');
        const designImage = document.getElementById('design-image');
        const designContainer = document.getElementById('design-container');
        const issueCountEl = document.getElementById('issue-count');
        const statusStatsEl = document.getElementById('status-stats');
        const figmaBtn = document.getElementById('btn-figma');
        
        let scale = 0.4;
        let currentX = 0;
        let currentY = 0;
        let isDragging = false;
        let startX, startY;

        const statusMap = {
            open: { label: '待修复', color: 'text-red-600 bg-red-50' },
            in_progress: { label: '进行中', color: 'text-blue-600 bg-blue-50' },
            resolved: { label: '已修复', color: 'text-green-600 bg-green-50' },
            wont_fix: { label: '不修复', color: 'text-gray-600 bg-gray-50' },
        };

        const severityMap = {
            critical: { label: '紧急', color: 'bg-red-100 text-red-700' },
            high: { label: '高', color: 'bg-orange-100 text-orange-700' },
            medium: { label: '中', color: 'bg-yellow-100 text-yellow-700' },
            low: { label: '低', color: 'bg-blue-100 text-blue-700' }
        };

        function init() {
            renderProjectList();
            loadProject(0);
            updateTransform();
        }

        function openFigmaModal() {
            if(!activeProject.figmaUrl) return;
            const modal = document.getElementById('figma-modal');
            const frame = document.getElementById('figma-frame');
            const extLink = document.getElementById('figma-external-link');
            // Construct Embed URL
            const embedUrl = "https://www.figma.com/embed?embed_host=share&url=" + encodeURIComponent(activeProject.figmaUrl);
            frame.src = embedUrl;
            if(extLink) extLink.href = activeProject.figmaUrl;
            modal.classList.add('open');
        }

        function closeFigmaModal(e) {
            const modal = document.getElementById('figma-modal');
            modal.classList.remove('open');
            // Clear src to stop loading when closed
            setTimeout(() => { document.getElementById('figma-frame').src = ''; }, 300);
        }

        // ... [Include existing downloadFeedback function] ...
        async function downloadFeedback() {
             const btn = document.getElementById('btn-export');
             const originalText = btn.innerHTML;
             btn.innerHTML = '<span class="loader"></span> 正在生成...';
             btn.disabled = true;
             try {
                 let tableHTML = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Feedback</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>';
                 tableHTML += '<table border="1" style="border-collapse: collapse; width: 100%;">';
                 tableHTML += '<thead style="background-color: #f3f4f6;"><tr><th style="padding:10px;">问题截图</th><th style="padding:10px;">页面</th><th style="padding:10px;">标题</th><th style="padding:10px;">描述</th><th style="padding:10px;">优先级</th><th style="padding:10px;">状态</th><th style="padding:10px;">修复建议</th></tr></thead><tbody>';
                 const getImageData = (p) => new Promise((resolve) => {
                     const img = new Image();
                     img.onload = () => resolve(img);
                     img.src = p.devImage.data;
                 });
                 for (const p of reportData.projects) {
                     const imgObj = await getImageData(p);
                     const originalW = imgObj.naturalWidth;
                     const originalH = imgObj.naturalHeight;
                     for (const i of p.issues) {
                         const severityText = severityMap[i.severity]?.label || i.severity;
                         const statusText = statusMap[i.status]?.label || i.status;
                         const ann = p.annotations.find(a => a.id === i.annotationId);
                         let imgTag = '无截图';
                         if(ann && (ann.width || ann.type === 'manual')) {
                             const canvas = document.createElement('canvas');
                             const ctx = canvas.getContext('2d');
                             let x, y, w, h;
                             if (ann.width && ann.height) {
                                 x = (ann.x / 100) * originalW;
                                 y = (ann.y / 100) * originalH;
                                 w = (ann.width / 100) * originalW;
                                 h = (ann.height / 100) * originalH;
                             } else {
                                 const size = 200;
                                 x = (ann.x / 100) * originalW - size/2;
                                 y = (ann.y / 100) * originalH - size/2;
                                 w = size; h = size;
                             }
                             w = Math.max(1, w); h = Math.max(1, h);
                             const thumbW = 200;
                             const thumbH = (h / w) * 200;
                             canvas.width = thumbW;
                             canvas.height = thumbH;
                             ctx.drawImage(imgObj, x, y, w, h, 0, 0, thumbW, thumbH);
                             ctx.strokeStyle = "#ff0000";
                             ctx.lineWidth = 4;
                             ctx.strokeRect(0, 0, thumbW, thumbH);
                             const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                             imgTag = \`<img src="\${dataUrl}" width="\${thumbW}" height="\${thumbH}" />\`;
                         }
                         tableHTML += \`<tr style="vertical-align: top;"><td style="padding:10px; text-align: center;">\${imgTag}</td><td style="padding:10px;">\${p.name}</td><td style="padding:10px; font-weight: bold;">\${i.title}</td><td style="padding:10px;">\${i.description || ''}</td><td style="padding:10px;">\${severityText}</td><td style="padding:10px;">\${statusText}</td><td style="padding:10px; font-family: monospace; color: #4f46e5;">\${i.suggestion || ''}</td></tr>\`;
                     }
                 }
                 tableHTML += '</tbody></table></body></html>';
                 const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
                 const url = URL.createObjectURL(blob);
                 const link = document.createElement("a");
                 link.setAttribute("href", url);
                 link.setAttribute("download", "designsync_feedback.xls");
                 document.body.appendChild(link);
                 link.click();
                 document.body.removeChild(link);
             } catch(e) { alert('导出失败，请重试'); console.error(e); } finally { btn.innerHTML = originalText; btn.disabled = false; }
        }

        function renderProjectList() {
            projectListEl.innerHTML = '';
            reportData.projects.forEach((p, idx) => {
                const div = document.createElement('div');
                div.className = 'project-nav-item p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 text-sm font-medium text-gray-700 truncate transition-colors';
                div.innerText = p.name;
                div.onclick = () => loadProject(idx);
                div.id = 'proj-nav-' + idx;
                projectListEl.appendChild(div);
            });
        }

        function loadProject(idx) {
            activeProjectIndex = idx;
            activeProject = reportData.projects[idx];
            
            // Highlight Nav
            document.querySelectorAll('.project-nav-item').forEach(el => el.classList.remove('active'));
            document.getElementById('proj-nav-' + idx)?.classList.add('active');

            // Load Image
            if(activeProject.devImage) {
                mainImage.src = activeProject.devImage.data;
            } else {
                mainImage.src = '';
            }

            // Update Design Image
            if(activeProject.designImage) {
                designImage.src = activeProject.designImage;
                designContainer.classList.remove('hidden');
            } else {
                designImage.src = '';
                designContainer.classList.add('hidden');
            }

            // Toggle Figma Button
            if(activeProject.figmaUrl) {
                figmaBtn.classList.remove('hidden');
            } else {
                figmaBtn.classList.add('hidden');
            }

            // Render content
            renderAnnotations();
            renderIssues();
            renderStats();
            
            // Auto Reset Zoom to fit
            resetZoom();
        }

        // ... [Include other existing functions: renderStats, renderAnnotations, renderIssues, updateIssueStatus, Zoom logic etc.] ...
        function renderStats() {
            if(!activeProject) return;
            statusStatsEl.innerHTML = '';
            const stats = { open: activeProject.issues.filter(i => i.status === 'open').length, in_progress: activeProject.issues.filter(i => i.status === 'in_progress').length, resolved: activeProject.issues.filter(i => i.status === 'resolved').length, wont_fix: activeProject.issues.filter(i => i.status === 'wont_fix').length, };
            Object.entries(statusMap).forEach(([key, config]) => {
                const count = stats[key];
                const div = document.createElement('div');
                div.className = \`flex flex-col items-center py-1 px-1 rounded border border-gray-100 bg-gray-50 \`;
                div.innerHTML = \`<span class="text-[10px] font-bold text-gray-500">\${config.label}</span><span class="text-xs font-black text-gray-800">\${count}</span>\`;
                statusStatsEl.appendChild(div);
            });
        }
        function renderAnnotations() {
            annotationsLayer.innerHTML = '';
            if(!activeProject || !activeProject.devImage) return;
            // Filter annotations for the active dev image
            const currentAnns = activeProject.annotations.filter(a => a.devImageId === activeProject.devImage.id);

            currentAnns.forEach(ann => {
                // Boxes (AI or Manual Area)
                if (ann.type === 'ai' || (ann.type === 'manual' && ann.width)) {
                    const el = document.createElement('div');
                    el.className = 'annotation-box';
                    // Determine color based on type
                    if (ann.type === 'manual') {
                        el.style.borderColor = '#3b82f6'; // blue-500
                        el.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    } else {
                        el.style.borderColor = '#ef4444'; // red-500
                        el.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    }
                    el.style.left = ann.x + '%'; el.style.top = ann.y + '%'; el.style.width = ann.width + '%'; el.style.height = ann.height + '%';
                    
                    el.id = 'ann-' + ann.id;
                    el.onclick = (e) => { e.stopPropagation(); activateIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id, false); };
                    el.onmouseenter = () => highlightIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id);
                    el.onmouseleave = () => unhighlightIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id);
                    annotationsLayer.appendChild(el);
                }
                
                // Measure
                else if (ann.type === 'measure' && ann.endX !== undefined) {
                     const dx = ann.endX - ann.x;
                     const dy = ann.endY - ann.y;
                     const lenPct = Math.sqrt(dx * dx + dy * dy);
                     const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                     
                     const line = document.createElement('div');
                     line.className = 'measure-line';
                     line.style.left = ann.x + '%';
                     line.style.top = ann.y + '%';
                     line.style.width = lenPct + '%';
                     line.style.height = '2px';
                     line.style.backgroundColor = '#ef4444';
                     line.style.transformOrigin = 'left center';
                     line.style.transform = \`rotate(\${angle}deg)\`;
                     line.style.pointerEvents = 'auto';
                     line.style.zIndex = '20';
                     
                     // Interaction Handlers
                     line.id = 'ann-' + ann.id;
                     line.onclick = (e) => { 
                        e.stopPropagation(); 
                        activateIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id, false); 
                     };
                     line.onmouseenter = () => highlightIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id);
                     line.onmouseleave = () => unhighlightIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id);

                     // Label
                     const label = document.createElement('div');
                     label.innerText = Math.round(lenPct) + '%';
                     label.style.position = 'absolute';
                     label.style.left = '50%';
                     label.style.top = '50%';
                     label.style.transform = \`translate(-50%, -50%) rotate(\${-angle}deg)\`;
                     label.style.backgroundColor = 'white';
                     label.style.padding = '1px 4px';
                     label.style.borderRadius = '4px';
                     label.style.fontSize = '10px';
                     label.style.fontWeight = 'bold';
                     label.style.border = '1px solid #e5e7eb';
                     label.style.whiteSpace = 'nowrap';
                     
                     line.appendChild(label);
                     annotationsLayer.appendChild(line);
                }
                
                // Color
                else if (ann.type === 'color' && ann.color) {
                    const pill = document.createElement('div');
                    pill.className = 'color-pill';
                    pill.style.left = ann.x + '%';
                    pill.style.top = ann.y + '%';
                    pill.style.transform = 'translate(-50%, -50%)';
                    pill.innerHTML = \`<div class="w-3 h-3 rounded-full border border-gray-100" style="background-color: \${ann.color}"></div><span class="text-[10px] font-mono text-gray-800">\${ann.color}</span>\`;
                    
                    // Interaction Handlers
                    pill.id = 'ann-' + ann.id;
                    pill.onclick = (e) => { 
                        e.stopPropagation(); 
                        activateIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id, false); 
                    };
                    pill.onmouseenter = () => highlightIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id);
                    pill.onmouseleave = () => unhighlightIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id);
                    
                    annotationsLayer.appendChild(pill);
                }
                
                // Manual Pin
                else if (ann.type === 'manual' && !ann.width) {
                     const pin = document.createElement('div');
                     pin.className = 'manual-pin';
                     pin.style.left = ann.x + '%';
                     pin.style.top = ann.y + '%';
                     pin.innerHTML = '<div class="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>';
                     
                     // Interaction Handlers
                     pin.id = 'ann-' + ann.id;
                     pin.onclick = (e) => { 
                        e.stopPropagation(); 
                        activateIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id, false); 
                     };
                     pin.onmouseenter = () => highlightIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id);
                     pin.onmouseleave = () => unhighlightIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id);
                     
                     annotationsLayer.appendChild(pin);
                }
            });
        }
        function updateIssueStatus(id, newStatus) {
            const issue = activeProject.issues.find(i => i.id === id);
            if(issue) { issue.status = newStatus; renderIssues(); renderStats(); }
        }
        function renderIssues() {
            issueList.innerHTML = '';
            if(!activeProject) return;
            issueCountEl.innerText = activeProject.issues.length;
            activeProject.issues.forEach(issue => {
                const el = document.createElement('div');
                el.className = 'issue-item p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors bg-white shadow-sm';
                el.id = 'issue-' + issue.id;
                const statusConfig = statusMap[issue.status] || statusMap.open;
                const severityConfig = severityMap[issue.severity] || severityMap.medium;
                let optionsHtml = '';
                Object.entries(statusMap).forEach(([k, v]) => { optionsHtml += \`<option value="\${k}" \${issue.status === k ? 'selected' : ''}>\${v.label}</option>\`; });
                el.innerHTML = \`<div class="flex justify-between items-start mb-2"><span class="text-xs font-bold uppercase px-1.5 py-0.5 rounded \${severityConfig.color}">\${severityConfig.label}</span>\${issue.annotationId ? '<span class="text-indigo-500 text-[10px]">● 图定位</span>' : ''}</div><h3 class="font-bold text-sm text-gray-900 mb-1">\${issue.title}</h3><p class="text-xs text-gray-500 mb-3 whitespace-pre-wrap">\${issue.description}</p><div class="flex items-center justify-between pt-2 border-t border-gray-100" onclick="event.stopPropagation()"><div class="relative"><div class="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer \${statusConfig.color} border-current/10"><span>\${statusConfig.label}</span><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></div><select onchange="updateIssueStatus('\${issue.id}', this.value)" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full">\${optionsHtml}</select></div></div>\${issue.suggestion ? \`<div class="mt-2 bg-gray-50 p-2 rounded text-[10px] font-mono text-indigo-600 border border-gray-100 break-all">\${issue.suggestion}</div>\` : ''}\`;
                el.onclick = () => activateIssue(issue.id, true);
                el.onmouseenter = () => highlightAnn(issue.annotationId);
                el.onmouseleave = () => unhighlightAnn(issue.annotationId);
                issueList.appendChild(el);
            });
        }
        function updateTransform() { zoomTarget.style.transform = \`translate(calc(-50% + \${currentX}px), calc(-50% + \${currentY}px)) scale(\${scale})\`; zoomLevelEl.innerText = Math.round(scale * 100) + '%'; }
        function zoomIn() { scale *= 1.2; updateTransform(); }
        function zoomOut() { scale /= 1.2; updateTransform(); }
        function resetZoom() { scale = 0.4; currentX = 0; currentY = 0; updateTransform(); }
        wrapper.addEventListener('mousedown', (e) => { if(e.target.closest('.annotation-box') || e.target.closest('button') || e.target.tagName === 'SELECT') return; isDragging = true; startX = e.clientX - currentX; startY = e.clientY - currentY; wrapper.classList.add('grabbing'); });
        window.addEventListener('mousemove', (e) => { if (!isDragging) return; e.preventDefault(); currentX = e.clientX - startX; currentY = e.clientY - startY; updateTransform(); });
        window.addEventListener('mouseup', () => { isDragging = false; wrapper.classList.remove('grabbing'); });
        wrapper.addEventListener('wheel', (e) => { e.preventDefault(); if (e.deltaY < 0) { zoomIn(); } else { zoomOut(); } }, { passive: false });
        function activateIssue(id, shouldZoom) { document.querySelectorAll('.active').forEach(e => e.classList.remove('active')); if(!id) return; const issueEl = document.getElementById('issue-' + id); if(issueEl) { issueEl.classList.add('active'); issueEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } const issue = activeProject.issues.find(i => i.id === id); if(issue && issue.annotationId) { const ann = activeProject.annotations.find(a => a.id === issue.annotationId); const annEl = document.getElementById('ann-' + issue.annotationId); if(annEl && ann) { annEl.classList.add('active'); if(shouldZoom && mainImage) { const imgW = mainImage.offsetWidth; const imgH = mainImage.offsetHeight; const centerX = (ann.x + ann.width/2) / 100 * imgW; const centerY = (ann.y + ann.height/2) / 100 * imgH; const imgCenterX = imgW / 2; const imgCenterY = imgH / 2; scale = 1.5; currentX = imgCenterX - centerX; currentY = imgCenterY - centerY; updateTransform(); } } } }
        function highlightAnn(id) { if(id) document.getElementById('ann-' + id)?.classList.add('active'); }
        function unhighlightAnn(id) { if(id) document.getElementById('ann-' + id)?.classList.remove('active'); }
        function highlightIssue(id) { if(id) document.getElementById('issue-' + id)?.classList.add('bg-gray-50'); }
        function unhighlightIssue(id) { if(id) document.getElementById('issue-' + id)?.classList.remove('bg-gray-50'); }
        init();
    </script>
</body>
</html>`;
  };

  const handleDownloadHTML = () => {
      const htmlContent = generateReportHTML();
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DesignSync-Feedback-Report-${new Date().toLocaleDateString()}.html`;
      a.click();
      URL.revokeObjectURL(url);
  };
  
  // ... [Other Handlers like handlePreviewHTML, handlePublishToGist remain the same] ...
  const handlePreviewHTML = () => {
      const htmlContent = generateReportHTML();
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
  };
  
  const handlePublishToGist = async (token: string, description: string) => {
      const htmlContent = generateReportHTML();
      try {
          const response = await fetch('https://api.github.com/gists', {
              method: 'POST',
              headers: {
                  'Authorization': `token ${token}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  description: description || 'DesignSync 走查报告',
                  public: false, // Default to secret gist for privacy
                  files: {
                      'index.html': {
                          content: htmlContent
                      }
                  }
              })
          });

          if (!response.ok) {
              const err = await response.json();
              throw new Error(err.message || '发布失败');
          }

          const data = await response.json();
          const rawUrl = data.files['index.html'].raw_url;
          // Use a proxy service to render the HTML properly since GitHub sends it as text/plain
          const previewUrl = `https://htmlpreview.github.io/?${rawUrl}`;
          return previewUrl;
      } catch (e: any) {
          console.error(e);
          throw e;
      }
  };
  
  const handleImportFeedback = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
             const json = JSON.parse(e.target?.result as string);
             if(json.projects) {
                 const mergedProjects = json.projects.map((p: any) => ({
                     ...p,
                     activeDevImageId: p.devImage?.id || null,
                     devImages: p.devImage ? [p.devImage] : [] 
                 }));
                 pushHistory();
                 setProjects(mergedProjects);
                 if(mergedProjects.length > 0) setActiveProjectId(mergedProjects[0].id);
                 alert('反馈数据导入成功！');
             }
          } catch(err) {
              alert('导入失败：文件格式不正确');
          }
      };
      reader.readAsText(file);
  };

  const handleAddAnnotation = (data: Partial<Annotation>) => {
    pushHistory();
    const annId = uuidv4();
    const issueId = uuidv4();
    const newAnn: Annotation = {
      id: annId,
      devImageId: activeDevImageId!,
      x: data.x || 0,
      y: data.y || 0,
      width: data.width,
      height: data.height,
      text: data.text || '发现差异',
      type: data.type || 'manual',
      color: data.color,
      endX: data.endX,
      endY: data.endY
    };
    
    let issueTitle = '手动标注';
    if(data.type === 'color') issueTitle = `取色: ${data.color}`;
    else if(data.type === 'measure') issueTitle = '距离测量';

    const newIssue: Issue = {
      id: issueId,
      devImageId: activeDevImageId!,
      title: issueTitle,
      description: '',
      severity: 'medium',
      status: 'open',
      annotationId: annId
    };
    updateActiveProject({
      annotations: [...activeProject.annotations, newAnn],
      issues: [newIssue, ...activeProject.issues]
    });
    setActiveIssueId(issueId);
  };

  const handleSelectAnnotation = (id: string) => {
    setActiveAnnotationId(id);
    const relatedIssue = activeProject.issues.find(i => i.annotationId === id);
    if (relatedIssue) {
      setActiveIssueId(relatedIssue.id);
    } else {
      setActiveIssueId(null);
    }
  };

  const handleSelectIssue = (id: string) => {
    setActiveIssueId(id);
    const issue = activeProject.issues.find(i => i.id === id);
    if (issue?.annotationId) {
      setActiveAnnotationId(issue.annotationId);
    } else {
      setActiveAnnotationId(null);
    }
  };

  // Helper for Export Rendering
  const statusMap: Record<string, { label: string; icon: any; color: string }> = {
    open: { label: '待修复', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
    in_progress: { label: '进行中', icon: Clock, color: 'text-blue-600 bg-blue-50' },
    resolved: { label: '已修复', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
    wont_fix: { label: '不修复', icon: XCircle, color: 'text-gray-600 bg-gray-50' },
  };

  return (
    <div className="flex h-screen w-full bg-[#fcfcfd] overflow-hidden text-slate-900">
      <ProjectSidebar projects={projects} activeProjectId={activeProjectId} onSwitchProject={setActiveProjectId} onAddProject={handleAddProject} onDeleteProject={handleDeleteProject} onRenameProject={handleRenameProject} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 shrink-0 z-40">
           {/* ... Header Content ... */}
           <div className="flex items-center gap-4">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                 <button onClick={() => setTabMode(TabMode.UPLOAD)} className={`px-4 py-1 rounded-lg text-xs font-bold transition-all ${tabMode === TabMode.UPLOAD ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>资源导入</button>
                 <button onClick={() => setTabMode(TabMode.COMPARE)} className={`px-4 py-1 rounded-lg text-xs font-bold transition-all ${tabMode === TabMode.COMPARE ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>视觉对比</button>
              </div>

              {tabMode === TabMode.COMPARE && (
                <>
                   <div className="h-4 w-[1px] bg-gray-200" />
                   <div className="flex bg-gray-100 p-1 rounded-xl">
                       {[
                         { id: ComparisonMode.SIDE_BY_SIDE, icon: Layout, label: '分屏' },
                         { id: ComparisonMode.SLIDER, icon: Scan, label: '滑块' },
                         { id: ComparisonMode.OVERLAY, icon: Eye, label: '叠加' },
                       ].map(m => (
                         <button key={m.id} onClick={() => setComparisonMode(m.id)} className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${comparisonMode === m.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                            <m.icon size={14}/> {m.label}
                         </button>
                       ))}
                   </div>
                   
                   <div className="h-4 w-[1px] bg-gray-200" />
                   
                   <button 
                      onClick={handleUndo} 
                      disabled={past.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                      title="撤销 (Ctrl+Z)"
                   >
                       <Undo2 size={14} />
                       <span>撤销</span>
                       {past.length > 0 && <span className="bg-gray-200 text-gray-600 px-1.5 rounded-full text-[10px]">{past.length}</span>}
                   </button>
                </>
              )}
           </div>

           <div className="flex items-center gap-3">
              {comparisonMode === ComparisonMode.OVERLAY && tabMode === TabMode.COMPARE && (
                  <div className="flex items-center gap-2 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-100 animate-in fade-in">
                      <Move size={14} />
                      <span>拖拽调整对齐</span>
                  </div>
              )}
              {isSpacePressed && tabMode === TabMode.COMPARE && (
                 <div className="flex items-center gap-2 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold animate-in fade-in">
                      <Hand size={14} />
                      <span>拖拽页面</span>
                  </div>
              )}
              <Button variant="secondary" size="sm" onClick={() => setIsShareModalOpen(true)}><Share2 size={14} className="mr-2"/>分享/导出</Button>
           </div>
        </header>

        <main className="flex-1 relative overflow-hidden" ref={mainContentRef}>
           {tabMode === TabMode.UPLOAD ? (
              <div className="h-full flex flex-col items-center justify-center p-12 bg-[#fcfcfd] overflow-y-auto relative">
                 {/* ... Upload UI ... */}
                 <div className="w-full max-w-4xl text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl transform -rotate-3">
                       <Layout className="text-white" size={40} />
                    </div>
                    <h2 className="text-5xl font-black text-slate-950 mb-4 tracking-tight">DesignSync</h2>
                    <p className="text-slate-500 text-lg font-medium">并置对比设计与代码，让每一个像素都精准还原。</p>
                 </div>
                 
                 <div className="w-full max-w-7xl flex flex-wrap justify-center gap-10 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="relative group w-full sm:w-[22rem] shrink-0">
                        <div 
                            onClick={() => !activeProject.designImage && document.getElementById('design-up')?.click()} 
                            onDragOver={(e) => onDragOver(e, 'design')}
                            onDragLeave={onDragLeave}
                            onDrop={(e) => onDrop(e, 'design')}
                            className={`h-[22rem] rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-500 relative shadow-sm ${
                                activeProject.designImage 
                                    ? 'border-indigo-500 bg-white shadow-2xl scale-[1.02]' 
                                    : dragOverTarget === 'design' 
                                        ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' 
                                        : 'border-slate-200 bg-white hover:border-indigo-400 hover:-translate-y-2'
                            }`}
                        >
                            {activeProject.designImage ? (
                                <div className="w-full h-full relative">
                                    <img src={activeProject.designImage} className="w-full h-full object-cover rounded-[3rem]" />
                                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                       <button 
                                          onClick={(e) => { e.stopPropagation(); document.getElementById('design-up')?.click(); }} 
                                          className="p-3 bg-white rounded-2xl text-indigo-600 hover:scale-110 transition-transform shadow-lg cursor-pointer"
                                       >
                                          <RefreshCw size={24}/>
                                       </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${dragOverTarget === 'design' ? 'bg-indigo-200 text-indigo-600' : 'bg-slate-50 text-slate-300 group-hover:text-indigo-400'}`}><ImageIcon size={32} /></div>
                                    <span className={`font-black text-xl ${dragOverTarget === 'design' ? 'text-indigo-600' : 'text-slate-900'}`}>{dragOverTarget === 'design' ? '松开上传' : '上传设计稿'}</span>
                                    <span className="text-xs text-slate-400 mt-2 font-medium bg-slate-100 px-2 py-1 rounded">支持拖拽 / Ctrl+V</span>
                                </>
                            )}
                            <input id="design-up" type="file" className="hidden" accept="image/*" onChange={(e) => handleInputUpload('design', e)} />
                        </div>
                        <div className="absolute -top-4 -left-4 w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center font-black shadow-xl border-4 border-white z-10">01</div>
                    </div>

                    {activeProject.devImages.map((img, idx) => (
                         <div key={img.id} className="relative group w-full sm:w-[22rem] shrink-0">
                            <div className="h-[22rem] rounded-[3rem] border-2 border-indigo-500 bg-white shadow-2xl scale-[1.02] overflow-hidden relative">
                                <img src={img.data} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => updateActiveProject({ devImages: activeProject.devImages.filter(i => i.id !== img.id) })} className="p-3 bg-red-500 rounded-2xl text-white"><X size={24}/></button>
                                </div>
                            </div>
                            <div className="absolute -top-4 -left-4 w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black shadow-xl border-4 border-white z-10">0{idx + 2}</div>
                         </div>
                    ))}

                    <div className="w-full sm:w-[22rem] shrink-0 relative">
                        {activeProject.designImage && activeProject.devImages.length === 0 && (
                             <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-xl shadow-xl animate-bounce z-20 whitespace-nowrap text-sm font-bold flex items-center gap-2">
                                <span>👆 请上传研发实现图</span>
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-3 h-3 bg-slate-800 rotate-45"></div>
                             </div>
                        )}
                        <div 
                            onClick={() => document.getElementById('dev-up')?.click()}
                            onDragOver={(e) => onDragOver(e, 'dev')}
                            onDragLeave={onDragLeave}
                            onDrop={(e) => onDrop(e, 'dev')}
                            className={`h-[22rem] rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-500 group ${
                                dragOverTarget === 'dev' 
                                    ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' 
                                    : 'border-slate-200 bg-white hover:border-indigo-400 hover:-translate-y-2'
                            }`}
                        >
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${dragOverTarget === 'dev' ? 'bg-indigo-200 text-indigo-600' : 'bg-slate-50 text-slate-300 group-hover:text-indigo-600'}`}><ClipboardPaste size={32} /></div>
                            <span className={`font-black text-xl ${dragOverTarget === 'dev' ? 'text-indigo-600' : 'text-slate-900'}`}>{dragOverTarget === 'dev' ? '松开上传' : '添加实现图'}</span>
                            <span className="text-xs text-slate-400 mt-2 font-medium bg-slate-100 px-2 py-1 rounded">支持拖拽 / Ctrl+V</span>
                            <input id="dev-up" type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleInputUpload('dev', e)} />
                        </div>
                    </div>
                 </div>

                 <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50">
                    <button onClick={() => setTabMode(TabMode.COMPARE)} disabled={!activeProject.designImage || activeProject.devImages.length === 0} className="h-16 px-12 bg-slate-950 text-white rounded-[2rem] font-black text-xl hover:bg-indigo-600 hover:scale-105 active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 transition-all shadow-2xl flex items-center gap-4">开启走查 <ArrowRight size={24}/></button>
                 </div>
              </div>
           ) : (
              <div className="w-full h-full flex items-stretch">
                 {/* ... Comparison View Logic ... */}
                 <div className="w-16 bg-white border-r border-gray-100 flex flex-col items-center py-6 gap-6 z-30 shadow-[4px_0_10px_rgba(0,0,0,0.01)] shrink-0">
                    {[
                      { id: ToolMode.POINTER, icon: MousePointer2, label: '选择/标注' },
                      { id: ToolMode.HAND, icon: Hand, label: '抓手 (Space)' },
                      { id: ToolMode.RULER, icon: Ruler, label: '测量' },
                      { id: ToolMode.COLOR_PICKER, icon: Pipette, label: '吸色' },
                      { id: ToolMode.ALIGNER, icon: Move, label: '对齐', hidden: comparisonMode !== ComparisonMode.OVERLAY },
                    ].filter(t => !t.hidden).map(tool => (
                      <button key={tool.id} onClick={() => setActiveTool(tool.id)} className={`p-3 rounded-2xl transition-all relative group ${activeTool === tool.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
                         <tool.icon size={20}/>
                         <span className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                            {tool.label}
                         </span>
                      </button>
                    ))}
                    <div className="w-8 h-[1px] bg-gray-200 my-2" />
                    <button 
                        onClick={() => setShowAnnotations(!showAnnotations)} 
                        className={`p-3 rounded-2xl transition-all relative group ${!showAnnotations ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' : 'bg-indigo-50 text-indigo-600 shadow-inner'}`}
                    >
                        {showAnnotations ? <Eye size={20} /> : <EyeOff size={20} />}
                        <span className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                            {showAnnotations ? '隐藏标注' : '显示标注'}
                        </span>
                    </button>
                 </div>

                 <div className="flex-1 min-w-0 bg-slate-100 relative">
                    <ComparisonView 
                        designImage={activeProject.designImage || ''} 
                        devImages={activeProject.devImages} 
                        activeDevImageId={activeProject.activeDevImageId} 
                        onSwitchDevImage={(id) => updateActiveProject({ activeDevImageId: id })} 
                        onAddDevImage={() => setTabMode(TabMode.UPLOAD)} 
                        mode={comparisonMode} 
                        activeTool={activeTool} 
                        annotations={activeProject.annotations} 
                        onAddAnnotation={handleAddAnnotation} 
                        onUpdateAnnotation={(id, up) => updateActiveProject({ annotations: activeProject.annotations.map(a => a.id === id ? {...a, ...up} : a) })} 
                        onInteractionStart={pushHistory}
                        activeAnnotationId={activeAnnotationId} 
                        onSelectAnnotation={handleSelectAnnotation} 
                        hoveredAnnotationId={hoveredAnnotationId} 
                        scale={scale} 
                        setScale={setScale} 
                        position={position} 
                        setPosition={setPosition} 
                        onZoomIn={() => setScale(s => s * 1.2)} 
                        onZoomOut={() => setScale(s => s / 1.2)} 
                        onResetZoom={() => { setScale(1); setPosition({x:0, y:0}); setOverlayOffset({x:0, y:0}); }}
                        overlayOffset={overlayOffset}
                        setOverlayOffset={setOverlayOffset}
                        isSpacePressed={isSpacePressed}
                        showAnnotations={showAnnotations}
                    />
                 </div>
                 <IssueList 
                    issues={activeProject.issues} 
                    annotations={activeProject.annotations} 
                    activeIssueId={activeIssueId} 
                    onSelectIssue={handleSelectIssue} 
                    onUpdateIssue={(id, up) => updateActiveProject({ issues: activeProject.issues.map(i => i.id === id ? {...i, ...up} : i) })} 
                    onDeleteIssue={(id) => { pushHistory(); updateActiveProject({ issues: activeProject.issues.filter(i => i.id !== id), annotations: activeProject.annotations.filter(a => a.id !== activeProject.issues.find(i => i.id === id)?.annotationId) }) }} 
                    isAnalyzing={isAnalyzing} 
                    aiProgress={aiProgress} 
                    onAnalyze={startAnalysis} 
                    onHoverIssue={setHoveredAnnotationId} 
                 />
              </div>
           )}
        </main>
      </div>

      <ShareModal 
          isOpen={isShareModalOpen} 
          onClose={() => setIsShareModalOpen(false)} 
          onExportProject={() => {}} 
          onExportHTML={handleDownloadHTML} 
          onPreviewHTML={handlePreviewHTML}
          onImportProject={handleImportFeedback}
          onPublishToGist={handlePublishToGist}
          onDownloadPNG={() => handleCaptureScreenshot('download')}
          onCopyForFigma={() => handleCaptureScreenshot('clipboard')}
          activeProjectFigmaUrl={activeProject.figmaUrl}
          onUpdateFigmaUrl={(url) => updateActiveProject({ figmaUrl: url })}
      />
      <FigmaImportModal isOpen={isFigmaModalOpen} onClose={() => setIsFigmaModalOpen(false)} onImport={() => {}} />

      {/* --- HIDDEN FULL REPORT RENDERER FOR EXPORT --- */}
      <div 
        ref={fullExportRef} 
        className="fixed top-0 left-[-9999px] w-[1400px] bg-slate-50 flex flex-col gap-10 p-10 z-[-1]"
      >
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-200">
             <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-xl">DS</div>
             <div>
                 <h1 className="text-3xl font-black text-gray-900">DesignSync 全量走查报告</h1>
                 <p className="text-gray-500 mt-1">生成时间: {new Date().toLocaleString()}</p>
             </div>
          </div>

          {projects.filter(p => p.devImages.length > 0).map((p, idx) => {
             const activeDev = p.devImages.find(d => d.id === p.activeDevImageId) || p.devImages[0];
             if (!activeDev) return null;

             return (
                 <div key={p.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                     <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                         <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                             <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-black">{idx + 1}</span>
                             {p.name}
                         </h2>
                         <div className="flex gap-4 text-sm text-gray-500 font-medium">
                             <span>问题数: {p.issues.length}</span>
                             <span className="text-red-500">待修复: {p.issues.filter(i => i.status === 'open').length}</span>
                         </div>
                     </div>
                     
                     <div className="p-8 flex items-start gap-8">
                         {/* Images Column */}
                         <div className="flex-1 flex gap-4 min-w-0">
                             {/* Design Image */}
                             {p.designImage && (
                                 <div className="flex-1 min-w-0 flex flex-col gap-2">
                                     <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded w-fit">设计稿 Design</div>
                                     <img src={p.designImage} className="w-full border-4 border-indigo-100 rounded-lg" />
                                 </div>
                             )}
                             
                             {/* Dev Image + Annotations */}
                             <div className="flex-1 min-w-0 flex flex-col gap-2">
                                 <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded w-fit">实现稿 Dev</div>
                                 <div className="relative">
                                     <img src={activeDev.data} className="w-full border-4 border-emerald-100 rounded-lg" />
                                     {/* Render simple static annotations overlays */}
                                     {p.annotations.map(ann => {
                                         // Filter: only show annotation if it belongs to current active dev image
                                         if (ann.devImageId !== activeDev.id) return null;

                                         // Find index in issues list for numbering
                                         const issueIdx = p.issues.findIndex(i => i.annotationId === ann.id);
                                         const displayNum = issueIdx !== -1 ? issueIdx + 1 : null;

                                         // Badge Component
                                         const badge = displayNum ? (
                                             <div className="absolute -top-3 -left-3 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-md z-50 leading-none">
                                                 {displayNum}
                                             </div>
                                         ) : null;

                                         if (ann.type === 'ai' || (ann.type === 'manual' && ann.width)) {
                                            return (
                                                <div 
                                                    key={ann.id}
                                                    className={`absolute border-2 ${ann.type === 'ai' ? 'border-red-500 bg-red-500/10' : 'border-blue-500 bg-blue-500/10'}`}
                                                    style={{ 
                                                        left: `${ann.x}%`, 
                                                        top: `${ann.y}%`, 
                                                        width: `${ann.width}%`, 
                                                        height: `${ann.height}%` 
                                                    }}
                                                >
                                                    {badge}
                                                </div>
                                            );
                                         }
                                         
                                         if (ann.type === 'measure' && ann.endX !== undefined) {
                                            const dx = ann.endX - ann.x;
                                            const dy = ann.endY! - ann.y;
                                            const lenPct = Math.sqrt(dx * dx + dy * dy);
                                            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                                            return (
                                                <div 
                                                    key={ann.id}
                                                    className="absolute origin-left flex items-center justify-center bg-red-500"
                                                    style={{ 
                                                        left: `${ann.x}%`, 
                                                        top: `${ann.y}%`, 
                                                        width: `${lenPct}%`, 
                                                        height: '2px', 
                                                        transform: `rotate(${angle}deg)` 
                                                    }}
                                                >
                                                     <div className="bg-white border border-gray-200 px-1 rounded text-[8px] font-bold shadow-sm relative" style={{ transform: `rotate(${-angle}deg)` }}>
                                                        {Math.round(lenPct)}%
                                                        {/* Center badge on label */}
                                                        {displayNum && (
                                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-md z-50 leading-none">
                                                                {displayNum}
                                                            </div>
                                                        )}
                                                     </div>
                                                </div>
                                            );
                                         }
                                         
                                         if (ann.type === 'color' && ann.color) {
                                            return (
                                                <div 
                                                    key={ann.id} 
                                                    className="absolute flex items-center gap-1 px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-sm z-10"
                                                    style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -50%)' }}
                                                >
                                                    <div className="w-3 h-3 rounded-full border border-gray-100" style={{ backgroundColor: ann.color }} />
                                                    <span className="text-[10px] font-mono text-gray-800">{ann.color}</span>
                                                    {badge}
                                                </div>
                                            );
                                         }
                                         
                                         if (ann.type === 'manual' && !ann.width) {
                                            return (
                                                <div 
                                                    key={ann.id} 
                                                    className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-blue-500 bg-white shadow-sm z-10 flex items-center justify-center"
                                                    style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
                                                >
                                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                                    {badge}
                                                </div>
                                            );
                                         }

                                         return null;
                                     })}
                                 </div>
                             </div>
                         </div>

                         {/* Issues List Column (Static) */}
                         <div className="w-80 shrink-0 flex flex-col gap-3">
                            {p.issues.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">无问题记录</div>
                            ) : (
                                p.issues.map((issue, issueIdx) => {
                                    const statusConfig = statusMap[issue.status];
                                    return (
                                        <div key={issue.id} className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-gray-900 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                                                        {issueIdx + 1}
                                                    </span>
                                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${issue.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {issue.severity === 'critical' ? '紧急' : '普通'}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${statusConfig.color}`}>
                                                    {React.createElement(statusConfig.icon, { size: 10 })}
                                                    {statusConfig.label}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-sm text-gray-900 mb-1">{issue.title}</h3>
                                            <p className="text-xs text-gray-500 leading-relaxed">{issue.description}</p>
                                            {issue.suggestion && (
                                                <div className="mt-2 bg-slate-50 p-2 rounded text-[10px] font-mono text-indigo-600 border border-slate-100 break-all">
                                                    {issue.suggestion}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                         </div>
                     </div>
                 </div>
             );
          })}
      </div>
    </div>
  );
};

export default App;
