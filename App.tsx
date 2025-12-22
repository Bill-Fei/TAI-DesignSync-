
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
  History
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
  const [activeTool, setActiveTool] = useState<ToolMode>(ToolMode.POINTER);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isFigmaModalOpen, setIsFigmaModalOpen] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  // Viewport State
  const [scale, setScale] = useState(0.25);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [overlayOffset, setOverlayOffset] = useState({ x: 0, y: 0 });

  // Spacebar Panning State
  const [isSpacePressed, setIsSpacePressed] = useState(false);

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

  // --- Paste Handler ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files.length) return;
      
      const file = Array.from(e.clipboardData.files).find(f => f.type.startsWith('image/'));
      if (!file) return;

      e.preventDefault();
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        pushHistory();
        
        if (!activeProject.designImage) {
           updateActiveProject({ designImage: data });
        } else {
           const newImg = { id: uuidv4(), name: file.name || `粘贴截图 ${new Date().toLocaleTimeString()}`, data };
           updateActiveProject({ 
               devImages: [...activeProject.devImages, newImg], 
               activeDevImageId: newImg.id 
           });
        }
      };
      reader.readAsDataURL(file);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeProject, updateActiveProject, pushHistory]);


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

  const handleFileUpload = (type: 'design' | 'dev', e: React.ChangeEvent<HTMLInputElement>) => {
    pushHistory();
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      if (type === 'design') {
        updateActiveProject({ designImage: data });
      } else {
        const newImg = { id: uuidv4(), name: file.name, data };
        updateActiveProject({ devImages: [...activeProject.devImages, newImg], activeDevImageId: newImg.id });
      }
    };
    reader.readAsDataURL(file);
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

  const generateReportHTML = () => {
      // Create a simplified data structure for the report
      const reportData = {
          generatedAt: new Date().toLocaleString(),
          projects: projects.map(p => ({
              id: p.id,
              name: p.name,
              designImage: p.designImage,
              // We only export the ACTIVE dev image for the report to keep it simple, or iterate all. 
              // For simplicity, let's export the first one or active one.
              devImage: p.devImages.find(d => d.id === p.activeDevImageId) || p.devImages[0],
              issues: p.issues,
              annotations: p.annotations
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
        .issue-item:hover { background-color: #f9fafb; border-color: #cbd5e1; }
        .issue-item.active { background-color: #eff6ff; border-left: 4px solid #4f46e5; border-color: #4f46e5; }
        .project-nav-item.active { background-color: #e0e7ff; color: #4338ca; border-right: 3px solid #4f46e5; }
        body { overflow: hidden; }
        #zoom-target { transform-origin: center center; cursor: default; }
        .grabbing { cursor: grabbing !important; }
        .grab { cursor: grab; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
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
             <div class="relative bg-white shadow-2xl border-4 border-white transition-transform duration-75" id="zoom-target" style="width: fit-content; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                <img id="main-image" class="block max-w-none pointer-events-none" />
                <div id="annotations-layer" class="absolute inset-0"></div>
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
            <div class="p-4 border-b border-gray-100 font-bold text-gray-800 flex justify-between bg-white z-10 shadow-sm">
                <span>问题列表</span>
                <span id="issue-count" class="bg-gray-100 px-2 rounded-full text-xs flex items-center">0</span>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 smooth-scroll" id="issue-list"></div>
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
        const issueCountEl = document.getElementById('issue-count');
        
        let scale = 0.4;
        let currentX = 0;
        let currentY = 0;
        let isDragging = false;
        let startX, startY;

        function init() {
            renderProjectList();
            loadProject(0);
            updateTransform();
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

            // Render content
            renderAnnotations();
            renderIssues();
            
            // Reset view slightly (optional)
            // resetZoom(); 
        }

        function renderAnnotations() {
            annotationsLayer.innerHTML = '';
            if(!activeProject) return;

            activeProject.annotations.filter(a => a.type === 'ai' || (a.type === 'manual' && a.width)).forEach(ann => {
                const el = document.createElement('div');
                el.className = 'annotation-box';
                el.style.left = ann.x + '%';
                el.style.top = ann.y + '%';
                el.style.width = ann.width + '%';
                el.style.height = ann.height + '%';
                el.id = 'ann-' + ann.id;
                el.onclick = (e) => { 
                    e.stopPropagation(); 
                    activateIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id, false); 
                };
                el.onmouseenter = () => highlightIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id);
                el.onmouseleave = () => unhighlightIssue(activeProject.issues.find(i => i.annotationId === ann.id)?.id);
                annotationsLayer.appendChild(el);
            });
        }

        function renderIssues() {
            issueList.innerHTML = '';
            if(!activeProject) return;
            
            issueCountEl.innerText = activeProject.issues.length;

            activeProject.issues.forEach(issue => {
                const el = document.createElement('div');
                el.className = 'issue-item p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors bg-white shadow-sm';
                el.id = 'issue-' + issue.id;
                el.innerHTML = \`
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-xs font-bold uppercase px-1.5 py-0.5 rounded \${getSeverityColor(issue.severity)}">\${issue.severity}</span>
                        \${issue.annotationId ? '<span class="text-indigo-500 text-[10px]">● 图定位</span>' : ''}
                    </div>
                    <h3 class="font-bold text-sm text-gray-900 mb-1">\${issue.title}</h3>
                    <p class="text-xs text-gray-500 line-clamp-2">\${issue.description}</p>
                    \${issue.suggestion ? \`<div class="mt-2 bg-gray-50 p-2 rounded text-[10px] font-mono text-indigo-600 border border-gray-100 break-all">\${issue.suggestion}</div>\` : ''}
                \`;
                el.onclick = () => activateIssue(issue.id, true);
                el.onmouseenter = () => highlightAnn(issue.annotationId);
                el.onmouseleave = () => unhighlightAnn(issue.annotationId);
                issueList.appendChild(el);
            });
        }

        // ... [Include existing transform/zoom/drag logic functions here] ...
        function updateTransform() {
            zoomTarget.style.transform = \`translate(calc(-50% + \${currentX}px), calc(-50% + \${currentY}px)) scale(\${scale})\`;
            zoomLevelEl.innerText = Math.round(scale * 100) + '%';
        }
        function zoomIn() { scale *= 1.2; updateTransform(); }
        function zoomOut() { scale /= 1.2; updateTransform(); }
        function resetZoom() { scale = 0.4; currentX = 0; currentY = 0; updateTransform(); }

        wrapper.addEventListener('mousedown', (e) => {
            if(e.target.closest('.annotation-box') || e.target.closest('button')) return;
            isDragging = true;
            startX = e.clientX - currentX;
            startY = e.clientY - currentY;
            wrapper.classList.add('grabbing');
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            currentX = e.clientX - startX;
            currentY = e.clientY - startY;
            updateTransform();
        });
        window.addEventListener('mouseup', () => { isDragging = false; wrapper.classList.remove('grabbing'); });
        
        // Helper functions
        function getSeverityColor(sev) {
            const map = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-blue-100 text-blue-700' };
            return map[sev] || map.medium;
        }
        function activateIssue(id, shouldZoom) {
            document.querySelectorAll('.active').forEach(e => e.classList.remove('active'));
            if(!id) return;
            const issueEl = document.getElementById('issue-' + id);
            if(issueEl) {
                issueEl.classList.add('active');
                issueEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            const issue = activeProject.issues.find(i => i.id === id);
            if(issue && issue.annotationId) {
                const ann = activeProject.annotations.find(a => a.id === issue.annotationId);
                const annEl = document.getElementById('ann-' + issue.annotationId);
                if(annEl && ann) {
                    annEl.classList.add('active');
                    if(shouldZoom && mainImage) {
                         const imgW = mainImage.offsetWidth;
                         const imgH = mainImage.offsetHeight;
                         const centerX = (ann.x + ann.width/2) / 100 * imgW;
                         const centerY = (ann.y + ann.height/2) / 100 * imgH;
                         const imgCenterX = imgW / 2;
                         const imgCenterY = imgH / 2;
                         scale = 1.5; 
                         currentX = imgCenterX - centerX;
                         currentY = imgCenterY - centerY;
                         updateTransform();
                    }
                }
            }
        }
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
      a.download = `DesignSync-Full-Report-${new Date().toLocaleDateString()}.html`;
      a.click();
      URL.revokeObjectURL(url);
  };
  
  const handlePreviewHTML = () => {
      const htmlContent = generateReportHTML();
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
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

  return (
    <div className="flex h-screen w-full bg-[#fcfcfd] overflow-hidden text-slate-900">
      <ProjectSidebar projects={projects} activeProjectId={activeProjectId} onSwitchProject={setActiveProjectId} onAddProject={handleAddProject} onDeleteProject={handleDeleteProject} onRenameProject={handleRenameProject} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 shrink-0 z-40">
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

        <main className="flex-1 relative overflow-hidden">
           {tabMode === TabMode.UPLOAD ? (
              <div className="h-full flex flex-col items-center justify-center p-12 bg-[#fcfcfd] overflow-y-auto relative">
                 {/* ... Existing Upload UI ... */}
                 <div className="w-full max-w-4xl text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl transform -rotate-3">
                       <Layout className="text-white" size={40} />
                    </div>
                    <h2 className="text-5xl font-black text-slate-950 mb-4 tracking-tight">DesignSync</h2>
                    <p className="text-slate-500 text-lg font-medium">并置对比设计与代码，让每一个像素都精准还原。</p>
                 </div>
                 
                 <div className="w-full max-w-7xl flex flex-wrap justify-center gap-10 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="relative group w-full sm:w-[22rem] shrink-0">
                        <div onClick={() => !activeProject.designImage && document.getElementById('design-up')?.click()} className={`h-[22rem] rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-500 relative shadow-sm ${activeProject.designImage ? 'border-indigo-500 bg-white shadow-2xl scale-[1.02]' : 'border-slate-200 bg-white hover:border-indigo-400 hover:-translate-y-2'}`}>
                            {activeProject.designImage ? (
                                <div className="w-full h-full relative">
                                    <img src={activeProject.designImage} className="w-full h-full object-cover rounded-[3rem]" />
                                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                       <button className="p-3 bg-white rounded-2xl text-indigo-600"><RefreshCw size={24}/></button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-300 group-hover:text-indigo-400 transition-colors"><ImageIcon size={32} /></div>
                                    <span className="font-black text-xl text-slate-900">上传设计稿</span>
                                    <span className="text-xs text-slate-400 mt-2 font-medium bg-slate-100 px-2 py-1 rounded">支持 Ctrl+V 粘贴</span>
                                </>
                            )}
                            <input id="design-up" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload('design', e)} />
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
                        <div onClick={() => document.getElementById('dev-up')?.click()} className={`h-[22rem] rounded-[3rem] border-2 border-dashed border-slate-200 bg-white hover:border-indigo-400 hover:-translate-y-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-500 group`}>
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-300 group-hover:text-indigo-600"><ClipboardPaste size={32} /></div>
                            <span className="font-black text-xl text-slate-900">添加实现图</span>
                            <span className="text-xs text-slate-400 mt-2 font-medium bg-slate-100 px-2 py-1 rounded">支持 Ctrl+V 粘贴</span>
                            <input id="dev-up" type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleFileUpload('dev', e)} />
                        </div>
                    </div>
                 </div>

                 <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50">
                    <button onClick={() => setTabMode(TabMode.COMPARE)} disabled={!activeProject.designImage || activeProject.devImages.length === 0} className="h-16 px-12 bg-slate-950 text-white rounded-[2rem] font-black text-xl hover:bg-indigo-600 hover:scale-105 active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 transition-all shadow-2xl flex items-center gap-4">开启走查 <ArrowRight size={24}/></button>
                 </div>
              </div>
           ) : (
              <div className="w-full h-full flex items-stretch">
                 {/* Floating Toolbar */}
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
                    isDevMode={isDevMode} 
                 />
              </div>
           )}
        </main>
      </div>

      <ShareModal 
          isOpen={isShareModalOpen} 
          onClose={() => setIsShareModalOpen(false)} 
          onEnterDevMode={() => setIsDevMode(true)} 
          onExportProject={() => {}} 
          onExportHTML={handleDownloadHTML} 
          onPreviewHTML={handlePreviewHTML}
          onImportProject={() => {}} 
      />
      <FigmaImportModal isOpen={isFigmaModalOpen} onClose={() => setIsFigmaModalOpen(false)} onImport={() => {}} />
    </div>
  );
};

export default App;
