
export interface Comment {
  id: string;
  author: string;
  role: 'designer' | 'developer';
  content: string;
  timestamp: number;
}

export interface DevImage {
  id: string;
  name: string;
  data: string;
}

export interface Annotation {
  id: string;
  devImageId: string; // 绑定到具体的实现图
  x: number; 
  y: number; 
  width?: number; 
  height?: number; 
  text: string;
  type: 'manual' | 'ai' | 'color' | 'measure';
  color?: string;
  endX?: number;
  endY?: number;
}

export interface Issue {
  id: string;
  devImageId: string; // 绑定到具体的实现图
  title: string;
  description: string;
  suggestion?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'wont_fix';
  annotationId?: string;
  comments?: Comment[];
}

export interface Project {
  id: string;
  name: string;
  designImage: string | null;
  devImages: DevImage[]; // 支持多实现图
  activeDevImageId: string | null; // 当前正在查看的实现图ID
  issues: Issue[];
  annotations: Annotation[];
}

export enum TabMode {
  UPLOAD = 'UPLOAD',
  COMPARE = 'COMPARE',
  REPORT = 'REPORT'
}

export enum ComparisonMode {
  SIDE_BY_SIDE = 'SIDE_BY_SIDE',
  SLIDER = 'SLIDER',
  OVERLAY = 'OVERLAY'
}

export enum ToolMode {
  POINTER = 'POINTER',
  HAND = 'HAND',
  COLOR_PICKER = 'COLOR_PICKER',
  RULER = 'RULER',
  INSPECTOR = 'INSPECTOR',
  ALIGNER = 'ALIGNER'
}
