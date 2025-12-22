
import React, { useState } from 'react';
import { Project } from '../types';
import { Plus, LayoutTemplate, Trash2, Edit2, Check, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface ProjectSidebarProps {
  projects: Project[];
  activeProjectId: string;
  onSwitchProject: (id: string) => void;
  onAddProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  projects,
  activeProjectId,
  onSwitchProject,
  onAddProject,
  onDeleteProject,
  onRenameProject,
  isCollapsed,
  onToggleCollapse
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const startEditing = (project: Project) => {
    if (isCollapsed) return; // Cannot edit in collapsed mode
    setEditingId(project.id);
    setTempName(project.name);
  };

  const saveEditing = () => {
    if (editingId && tempName.trim()) {
      onRenameProject(editingId, tempName.trim());
    }
    setEditingId(null);
  };

  return (
    <div 
      className={`${isCollapsed ? 'w-18' : 'w-64'} bg-white flex flex-col py-4 gap-4 shrink-0 z-50 h-full text-gray-800 border-r border-gray-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)] transition-[width] duration-300 ease-in-out will-change-[width]`}
    >
      {/* Header */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-3' : 'justify-between px-4'} mb-2 min-h-[40px]`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm text-white shrink-0">
            DS
          </div>
          {!isCollapsed && (
             <span className="font-bold text-lg tracking-tight text-gray-900 whitespace-nowrap animate-in fade-in duration-300">DesignSync</span>
          )}
        </div>
        
        <button 
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ${isCollapsed ? '' : ''}`}
          title={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
        >
           {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      
      <div className="w-full h-[1px] bg-gray-100 mb-2"></div>

      {/* Project List */}
      <div className="flex-1 flex flex-col gap-2 w-full overflow-y-auto px-3 pb-4 scrollbar-hide">
        {!isCollapsed && (
             <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1 whitespace-nowrap overflow-hidden animate-in fade-in">页面列表</h3>
        )}
        
        {projects.map((project) => {
          const isActive = project.id === activeProjectId;
          const isEditing = editingId === project.id;

          return (
            <div 
                key={project.id} 
                onClick={() => !isEditing && onSwitchProject(project.id)}
                title={isCollapsed ? project.name : undefined}
                className={`relative group w-full flex items-center p-2 rounded-lg cursor-pointer transition-all border ${
                    isActive 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-900' 
                      : 'bg-transparent border-transparent hover:bg-gray-50 text-gray-600 hover:text-gray-900'
                 } ${isCollapsed ? 'justify-center' : ''}`}
            >
               {/* Thumbnail */}
               <div className={`w-10 h-10 rounded shrink-0 overflow-hidden flex items-center justify-center border transition-colors ${isActive ? 'border-indigo-200 bg-white' : 'border-gray-200 bg-gray-50'} ${!isCollapsed ? 'mr-3' : ''}`}>
                 {project.designImage ? (
                    <img src={project.designImage} className="w-full h-full object-cover" alt="thumbnail" />
                 ) : (
                    <LayoutTemplate size={16} className={isActive ? "text-indigo-300" : "text-gray-300"} />
                 )}
               </div>

               {/* Name & Actions (Hidden when collapsed) */}
               {!isCollapsed && (
                 <>
                   <div className="flex-1 min-w-0 animate-in fade-in duration-200">
                      {isEditing ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <input 
                                type="text" 
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                                onBlur={saveEditing}
                                className="w-full bg-white border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none shadow-sm"
                                autoFocus
                              />
                              <button onClick={saveEditing} className="text-green-600 hover:text-green-500"><Check size={14}/></button>
                          </div>
                      ) : (
                          <div className="flex justify-between items-center">
                              <span className={`text-sm truncate font-medium`}>
                                  {project.name}
                              </span>
                          </div>
                      )}
                   </div>

                   {/* Hover Actions */}
                   {!isEditing && (
                     <div className="absolute right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-md shadow-sm border border-gray-100 p-0.5 z-10">
                         <button 
                           onClick={(e) => { e.stopPropagation(); startEditing(project); }}
                           className="p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-100"
                           title="重命名"
                         >
                           <Edit2 size={12} />
                         </button>
                         {projects.length > 1 && (
                             <button 
                               onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                               className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100"
                               title="删除"
                             >
                               <Trash2 size={12} />
                             </button>
                         )}
                     </div>
                   )}
                 </>
               )}
               
               {/* Active Indicator Dot for Collapsed Mode */}
               {isCollapsed && isActive && (
                   <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-500 rounded-l-full"></div>
               )}
            </div>
          );
        })}

        <button
          onClick={onAddProject}
          title={isCollapsed ? "新建页面" : ""}
          className={`w-full py-2.5 rounded-lg border border-dashed border-gray-200 text-gray-500 flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors mt-2 text-sm font-medium ${isCollapsed ? 'aspect-square p-0' : ''}`}
        >
          <Plus size={16} /> 
          {!isCollapsed && <span>新建页面</span>}
        </button>
      </div>
    </div>
  );
};

export default ProjectSidebar;
