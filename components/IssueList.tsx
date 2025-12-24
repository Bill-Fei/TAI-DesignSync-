
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Issue, Annotation, Comment } from '../types';
import { Trash2, MessageSquareWarning, Sparkles, ClipboardList, ChevronDown, CheckCircle2, Clock, XCircle, AlertCircle, PanelRightClose, PanelRightOpen, Send, Copy, Download, Loader2, Edit3, Save } from 'lucide-react';

interface IssueListProps {
  issues: Issue[];
  annotations: Annotation[];
  activeIssueId: string | null;
  onSelectIssue: (id: string) => void;
  onUpdateIssue: (id: string, updates: Partial<Issue>) => void;
  onDeleteIssue: (id: string) => void;
  isAnalyzing: boolean;
  aiProgress?: number;
  onAnalyze: () => void;
  onHoverIssue?: (id: string | null) => void;
}

const severityMap: Record<string, { label: string; color: string }> = {
  critical: { label: '紧急', color: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: '高', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: '中', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: '低', color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const statusMap: Record<string, { label: string; icon: any; color: string }> = {
  open: { label: '待修复', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
  in_progress: { label: '进行中', icon: Clock, color: 'text-blue-600 bg-blue-50' },
  resolved: { label: '已修复', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  wont_fix: { label: '不修复', icon: XCircle, color: 'text-gray-600 bg-gray-50' },
};

const IssueList: React.FC<IssueListProps> = ({
  issues,
  annotations,
  activeIssueId,
  onSelectIssue,
  onUpdateIssue,
  onDeleteIssue,
  isAnalyzing,
  aiProgress = 0,
  onAnalyze,
  onHoverIssue
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const stats = useMemo(() => {
    return {
      total: issues.length,
      open: issues.filter(i => i.status === 'open').length,
      in_progress: issues.filter(i => i.status === 'in_progress').length,
      resolved: issues.filter(i => i.status === 'resolved').length,
      wont_fix: issues.filter(i => i.status === 'wont_fix').length,
    };
  }, [issues]);

  const filteredIssues = useMemo(() => {
    if (!filterStatus) return issues;
    return issues.filter(i => i.status === filterStatus);
  }, [issues, filterStatus]);

  useEffect(() => {
    if (activeIssueId && !isCollapsed) {
      const element = itemRefs.current.get(activeIssueId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeIssueId, isCollapsed]);

  const handleAddComment = (issueId: string) => {
    if (!newCommentText.trim()) return;
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      author: '设计',
      role: 'designer',
      content: newCommentText.trim(),
      timestamp: Date.now()
    };
    onUpdateIssue(issueId, { comments: [...(issue.comments || []), newComment] });
    setNewCommentText('');
  };

  if (isCollapsed) {
    return (
      <div 
        className="w-14 h-full bg-white border-l border-gray-200 shadow-xl shrink-0 flex flex-col items-center py-4 gap-6 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsCollapsed(false)}
      >
        <button className="p-2 text-gray-500 hover:text-indigo-600"><PanelRightOpen size={20} /></button>
        <div className="relative">
          <ClipboardList size={20} className="text-gray-400" />
          {stats.open > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {stats.open}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      id="issue-list-container" 
      className="flex flex-col h-full bg-white border-l border-gray-200 w-[30%] min-w-[360px] max-w-[500px] shadow-xl shrink-0"
    >
      {/* Header */}
      <div className="p-5 border-b border-gray-200 bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ClipboardList className="text-indigo-600" size={20} />
            走查清单
            <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">共 {stats.total} 个问题</span>
          </h2>
          <button onClick={() => setIsCollapsed(true)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md">
            <PanelRightClose size={18} />
          </button>
        </div>

        {/* Status Dashboard */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {Object.entries(statusMap).map(([key, config]) => {
            const count = stats[key as keyof typeof stats];
            const isSelected = filterStatus === key;
            return (
              <button
                key={key}
                onClick={() => setFilterStatus(isSelected ? null : key)}
                className={`flex flex-col items-center py-2 px-1 rounded-xl border transition-all ${
                  isSelected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/10' : 'border-gray-100 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <config.icon size={14} className={`mb-1 ${config.color.split(' ')[0]}`} />
                <span className="text-[10px] font-bold text-gray-500 mb-0.5">{config.label}</span>
                <span className="text-sm font-black text-gray-800">{count}</span>
              </button>
            );
          })}
        </div>
        
        <div className="space-y-3">
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
              isAnalyzing ? 'bg-indigo-100 text-indigo-400 cursor-wait' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                正在深度扫描细节...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                AI 智能像素对齐评测
              </>
            )}
          </button>
          {isAnalyzing && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                <span>分析进度</span>
                <span>{aiProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full transition-all duration-500 ease-out" style={{ width: `${aiProgress}%` }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div 
        id="issue-list-scroll-area" 
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50"
      >
        {filteredIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
            <MessageSquareWarning size={40} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">当前无相关问题记录</p>
            {filterStatus && (
              <button onClick={() => setFilterStatus(null)} className="text-xs text-indigo-600 mt-2 hover:underline">清除过滤器</button>
            )}
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isActive = activeIssueId === issue.id;
            const sev = severityMap[issue.severity] || severityMap.medium;

            return (
              <div
                key={issue.id}
                ref={(el) => {
                  if (el) {
                    itemRefs.current.set(issue.id, el);
                  } else {
                    itemRefs.current.delete(issue.id);
                  }
                }}
                onClick={() => onSelectIssue(issue.id)}
                onMouseEnter={() => onHoverIssue?.(issue.annotationId || null)}
                onMouseLeave={() => onHoverIssue?.(null)}
                className={`group relative p-4 rounded-2xl border transition-all ${
                  isActive ? 'bg-white border-indigo-500 shadow-xl scale-[1.02] z-10' : 'bg-white border-gray-200 hover:border-indigo-200'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="relative" onClick={e => e.stopPropagation()}>
                       <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${sev.color}`}>
                          {sev.label}
                       </span>
                       <select 
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          value={issue.severity}
                          onChange={e => onUpdateIssue(issue.id, { severity: e.target.value as any })}
                       >
                          {Object.keys(severityMap).map(k => <option key={k} value={k}>{severityMap[k].label}</option>)}
                       </select>
                    </div>
                    {issue.annotationId && annotations.find(a => a.id === issue.annotationId)?.type === 'ai' && (
                       <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          <Sparkles size={10} /> AI 检测
                       </span>
                    )}
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteIssue(issue.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {isActive ? (
                  <div className="space-y-3" onClick={e => e.stopPropagation()}>
                    <input 
                      className="w-full text-sm font-black text-gray-900 border-none p-0 focus:ring-0 placeholder:text-gray-300"
                      value={issue.title}
                      onFocus={() => { if (issue.title === '手动标注') onUpdateIssue(issue.id, { title: '' }); }}
                      onChange={e => onUpdateIssue(issue.id, { title: e.target.value })}
                      placeholder="问题标题"
                    />
                    <textarea 
                      className="w-full text-xs text-gray-500 border-none p-0 focus:ring-0 resize-none min-h-[60px] bg-transparent placeholder:text-gray-300"
                      value={issue.description}
                      onChange={e => onUpdateIssue(issue.id, { description: e.target.value })}
                      placeholder="差异详细描述..."
                    />
                    
                    {issue.suggestion && (
                       <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-center mb-1.5">
                             <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">CSS 修复建议</span>
                             <button onClick={() => navigator.clipboard.writeText(issue.suggestion!)} className="text-indigo-600 hover:text-indigo-700 transition-colors"><Copy size={12}/></button>
                          </div>
                          <code className="block text-[11px] font-mono text-indigo-600 break-all leading-relaxed whitespace-pre-wrap">{issue.suggestion}</code>
                       </div>
                    )}

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                       <div className="relative">
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${statusMap[issue.status].color} border-current/10 hover:shadow-sm`}>
                             {React.createElement(statusMap[issue.status].icon, { size: 14 })}
                             {statusMap[issue.status].label}
                             <ChevronDown size={12} />
                          </div>
                          <select 
                             className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                             value={issue.status}
                             onChange={e => onUpdateIssue(issue.id, { status: e.target.value as any })}
                          >
                             {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                       </div>
                       
                       <div className="flex -space-x-2">
                          <div className="w-6 h-6 rounded-full border-2 border-white bg-indigo-500 text-white flex items-center justify-center text-[8px] font-black ring-1 ring-gray-100">设</div>
                          {issue.comments?.length ? (
                             <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 text-gray-400 flex items-center justify-center text-[8px] font-black ring-1 ring-gray-100">+{issue.comments.length}</div>
                          ) : null}
                       </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="text-sm font-bold text-gray-800 line-clamp-1 mb-1">{issue.title}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{issue.description}</p>
                    <div className="mt-3 flex items-center gap-3">
                       <div className={`flex items-center gap-1 text-[10px] font-bold ${statusMap[issue.status].color.split(' ')[0]}`}>
                          {React.createElement(statusMap[issue.status].icon, { size: 12 })}
                          {statusMap[issue.status].label}
                       </div>
                       {issue.comments?.length ? (
                          <div className="text-[10px] text-gray-400 flex items-center gap-1"><Send size={10}/>{issue.comments.length}</div>
                       ) : null}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default IssueList;
