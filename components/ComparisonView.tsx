
import React, { useState, useRef, useEffect } from 'react';
import { ComparisonMode, Annotation, ToolMode, DevImage } from '../types';
import { ZoomIn, ZoomOut, RotateCcw, MoveHorizontal, MousePointer2, Paintbrush, Code2 } from 'lucide-react';

interface ComparisonViewProps {
  designImage: string;
  devImages: DevImage[];
  activeDevImageId: string | null;
  onSwitchDevImage: (id: string) => void;
  onAddDevImage: () => void;
  mode: ComparisonMode;
  activeTool: ToolMode;
  annotations: Annotation[];
  onAddAnnotation: (data: Partial<Annotation>) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onInteractionStart?: () => void;
  activeAnnotationId: string | null;
  onSelectAnnotation: (id: string) => void;
  hoveredAnnotationId?: string | null;
  scale: number;
  setScale: (s: number) => void;
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  showAnnotations?: boolean;
  overlayOffset?: { x: number; y: number };
  setOverlayOffset?: (pos: { x: number; y: number }) => void;
  isSpacePressed?: boolean;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({
  designImage,
  devImages,
  activeDevImageId,
  mode,
  activeTool,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onInteractionStart,
  onSelectAnnotation,
  activeAnnotationId,
  hoveredAnnotationId,
  scale,
  position,
  setPosition,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  showAnnotations = true,
  overlayOffset = { x: 0, y: 0 },
  setOverlayOffset,
  isSpacePressed = false
}) => {
  const [isPanning, setIsPanning] = useState(false);
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isAligning, setIsAligning] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{w: number, h: number} | null>(null);
  
  // Loupe State for Color Picker
  const [loupeState, setLoupeState] = useState<{ x: number, y: number, color: string, srcX: number, srcY: number } | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Interaction State
  const [interactionStart, setInteractionStart] = useState<{x: number, y: number} | null>(null);
  const [interactionCurrent, setInteractionCurrent] = useState<{x: number, y: number} | null>(null);

  // Dragging / Resizing State for Annotations
  const [dragState, setDragState] = useState<{
      id: string;
      action: 'move' | 'resize';
      startX: number;
      startY: number;
      initialX: number;
      initialY: number;
      initialW?: number;
      initialH?: number;
  } | null>(null);
  
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const interactiveLayerRef = useRef<HTMLDivElement>(null); // Ref for the annotation layer
  const samplingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeDevImage = devImages.find(img => img.id === activeDevImageId) || devImages[0];

  // Load natural size for pixel measurement
  useEffect(() => {
    if (activeDevImage?.data) {
      const img = new Image();
      img.src = activeDevImage.data;
      img.onload = () => {
        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          samplingCanvasRef.current = canvas;
        }
      };
    }
  }, [activeDevImage?.data]);

  // Global Drag Handlers for Smooth Interaction
  useEffect(() => {
    if (dragState) {
      const handleWindowMove = (e: MouseEvent) => {
        if (!interactiveLayerRef.current) return;
        const rect = interactiveLayerRef.current.getBoundingClientRect();
        // Calculate raw percentage delta
        const deltaXPercent = ((e.clientX - dragState.startX) / rect.width) * 100;
        const deltaYPercent = ((e.clientY - dragState.startY) / rect.height) * 100;

        if (dragState.action === 'move') {
            onUpdateAnnotation(dragState.id, {
                x: dragState.initialX + deltaXPercent,
                y: dragState.initialY + deltaYPercent
            });
        } else if (dragState.action === 'resize' && dragState.initialW !== undefined && dragState.initialH !== undefined) {
             onUpdateAnnotation(dragState.id, {
                width: Math.max(0.5, dragState.initialW + deltaXPercent),
                height: Math.max(0.5, dragState.initialH + deltaYPercent)
            });
        }
      };

      const handleWindowUp = () => {
        setDragState(null);
      };

      window.addEventListener('mousemove', handleWindowMove);
      window.addEventListener('mouseup', handleWindowUp);
      return () => {
        window.removeEventListener('mousemove', handleWindowMove);
        window.removeEventListener('mouseup', handleWindowUp);
      };
    }
  }, [dragState, onUpdateAnnotation]);

  // Update Loupe Canvas content
  useEffect(() => {
    if (loupeState && loupeCanvasRef.current && samplingCanvasRef.current) {
        const ctx = loupeCanvasRef.current.getContext('2d');
        if (ctx) {
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, 100, 100);
            
            // Draw zoomed area: 10x10 pixels from source -> 100x100 pixels on loupe (10x zoom)
            const zoom = 10;
            const patchSize = 10;
            
            ctx.drawImage(
                samplingCanvasRef.current,
                loupeState.srcX - patchSize/2, loupeState.srcY - patchSize/2, patchSize, patchSize,
                0, 0, 100, 100
            );
        }
    }
  }, [loupeState]);

  // --- Coordinate Helpers ---
  // Gets coordinates relative to the IMAGE (0-100%), not the window/wrapper
  const getImageRelativeCoords = (clientX: number, clientY: number) => {
    const rect = interactiveLayerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    };
  };

  // --- Handlers for Main Container (Panning) ---
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    // Only pan if Space is pressed or Hand tool is active or Middle Click
    if (isSpacePressed || activeTool === ToolMode.HAND || e.button === 1) {
      setIsPanning(true);
      e.preventDefault(); 
    }
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPosition({ x: position.x + e.movementX, y: position.y + e.movementY });
      return;
    }
    // Handle Overlay Alignment (Drag Design Image)
    if (isAligning && setOverlayOffset && mode === ComparisonMode.OVERLAY) {
        setOverlayOffset({ x: overlayOffset.x + e.movementX / scale, y: overlayOffset.y + e.movementY / scale });
        return;
    }
    // Handle Slider Dragging (Global mouse move for slider)
    if (isSliderDragging && interactiveLayerRef.current) {
        const rect = interactiveLayerRef.current.getBoundingClientRect();
        const rawPct = ((e.clientX - rect.left) / rect.width) * 100;
        setSliderPosition(Math.max(0, Math.min(100, rawPct)));
    }
  };

  const handleContainerMouseUp = () => {
    setIsPanning(false);
    setIsSliderDragging(false);
    setIsAligning(false);
  };

  // --- Annotation Manipulation Handlers ---
  const handleAnnotationMouseDown = (e: React.MouseEvent, ann: Annotation) => {
      // Allow drag for manual boxes and AI boxes
      if ((ann.type === 'manual' || ann.type === 'ai') && activeTool === ToolMode.POINTER) {
          e.stopPropagation();
          onSelectAnnotation(ann.id); // Ensure click also selects
          
          if(onInteractionStart) onInteractionStart(); // Save history

          setDragState({
              id: ann.id,
              action: 'move',
              startX: e.clientX,
              startY: e.clientY,
              initialX: ann.x,
              initialY: ann.y
          });
      }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, ann: Annotation) => {
      if ((ann.type === 'manual' || ann.type === 'ai') && activeTool === ToolMode.POINTER) {
          e.stopPropagation();
          
          if(onInteractionStart) onInteractionStart(); // Save history

          setDragState({
              id: ann.id,
              action: 'resize',
              startX: e.clientX,
              startY: e.clientY,
              initialX: ann.x,
              initialY: ann.y,
              initialW: ann.width,
              initialH: ann.height
          });
      }
  };

  // --- Handlers for Interactive Layer (Tools) ---
  const handleToolMouseDown = (e: React.MouseEvent) => {
    // Ignore if panning
    if (isSpacePressed || activeTool === ToolMode.HAND) return;

    e.stopPropagation(); // Don't trigger pan
    const coords = getImageRelativeCoords(e.clientX, e.clientY);

    // Color Picker
    if (activeTool === ToolMode.COLOR_PICKER && samplingCanvasRef.current) {
      // This is instant, no drag, but adds annotation. 
      // The history should be handled by onAddAnnotation caller (App.tsx), not here.
      const ctx = samplingCanvasRef.current.getContext('2d');
      if (ctx) {
        const px = (coords.x / 100) * samplingCanvasRef.current.width;
        const py = (coords.y / 100) * samplingCanvasRef.current.height;
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        const hex = "#" + ("000000" + ((pixel[0] << 16) | (pixel[1] << 8) | pixel[2]).toString(16)).slice(-6).toUpperCase();
        onAddAnnotation({ x: coords.x, y: coords.y, type: 'color', color: hex, text: hex });
      }
      return;
    }

    // Aligner (Overlay Mode)
    if (activeTool === ToolMode.ALIGNER && mode === ComparisonMode.OVERLAY) {
        setIsAligning(true);
        return;
    }

    // Pointer or Ruler Start
    setInteractionStart(coords);
    setInteractionCurrent(coords);
  };

  const handleToolMouseMove = (e: React.MouseEvent) => {
    // 1. Handle Annotation Dragging/Resizing (if any)
    if (dragState && interactiveLayerRef.current) {
       // handled by global listener, but we might want to prevent other tools
       return;
    }

    // Handle Color Picker Loupe
    if (activeTool === ToolMode.COLOR_PICKER && samplingCanvasRef.current) {
        const coords = getImageRelativeCoords(e.clientX, e.clientY);
        // Ensure coords are within image bounds for clean sampling
        if (coords.x >= 0 && coords.x <= 100 && coords.y >= 0 && coords.y <= 100) {
            const srcX = Math.floor((coords.x / 100) * samplingCanvasRef.current.width);
            const srcY = Math.floor((coords.y / 100) * samplingCanvasRef.current.height);
            
            const ctx = samplingCanvasRef.current.getContext('2d');
            if (ctx) {
                try {
                    const p = ctx.getImageData(srcX, srcY, 1, 1).data;
                    const hex = "#" + ("000000" + ((p[0] << 16) | (p[1] << 8) | p[2]).toString(16)).slice(-6).toUpperCase();
                    setLoupeState({
                        x: e.clientX,
                        y: e.clientY,
                        color: hex,
                        srcX,
                        srcY
                    });
                } catch (err) {
                    // ignore out of bounds
                }
            }
        } else {
             setLoupeState(null);
        }
    } else {
         if (loupeState) setLoupeState(null);
    }

    // 2. Handle Tool Preview
    if (!interactionStart) return;
    const coords = getImageRelativeCoords(e.clientX, e.clientY);
    setInteractionCurrent(coords);
  };

  const handleToolMouseUp = (e: React.MouseEvent) => {
    // End Tool Action
    if (interactionStart && interactionCurrent) {
        const dx = interactionCurrent.x - interactionStart.x;
        const dy = interactionCurrent.y - interactionStart.y;
        const dist = Math.sqrt(dx*dx + dy*dy); // % distance

        if (activeTool === ToolMode.RULER) {
          // Add Measurement
          if (dist > 0.1) {
             onAddAnnotation({ 
                 x: interactionStart.x, 
                 y: interactionStart.y, 
                 endX: interactionCurrent.x, 
                 endY: interactionCurrent.y, 
                 type: 'measure' 
             });
          }
        } else if (activeTool === ToolMode.POINTER) {
            if (dist > 0.5) {
                // Dragged -> Manual Box
                onAddAnnotation({ 
                    x: Math.min(interactionStart.x, interactionCurrent.x), 
                    y: Math.min(interactionStart.y, interactionCurrent.y), 
                    width: Math.abs(dx), 
                    height: Math.abs(dy),
                    type: 'manual' 
                });
            } else {
                // Clicked -> Manual Pin
                onAddAnnotation({ 
                    x: interactionCurrent.x, 
                    y: interactionCurrent.y,
                    type: 'manual' 
                });
            }
        }
    }
    setInteractionStart(null);
    setInteractionCurrent(null);
  };


  // --- Render Helpers ---
  let cursorStyle = 'cursor-default';
  if (isSpacePressed || activeTool === ToolMode.HAND) cursorStyle = isPanning ? 'cursor-grabbing' : 'cursor-grab';
  else if (activeTool === ToolMode.ALIGNER) cursorStyle = 'cursor-move';
  else if (activeTool === ToolMode.RULER || activeTool === ToolMode.POINTER) cursorStyle = 'cursor-crosshair';
  else if (activeTool === ToolMode.COLOR_PICKER) cursorStyle = 'cursor-crosshair'; // CHANGED: Visible cursor for precision

  const renderAnnotations = () => {
    if (!showAnnotations) return null;
    return (
      <>
        {annotations.map((ann) => {
          const isActive = activeAnnotationId === ann.id;
          const isHovered = hoveredAnnotationId === ann.id;
          
          // Determine Z-Index
          // Pointer Mode: Annotations (40/50) > Layer (30)
          // Other Modes: Layer (30) > Annotations (10/20)
          const isPointerMode = activeTool === ToolMode.POINTER;
          const zIndexClass = isPointerMode 
             ? (isActive || isHovered ? 'z-50' : 'z-40') 
             : (isActive || isHovered ? 'z-20' : 'z-10');

          // Boxes
          if (ann.type === 'ai' || (ann.type === 'manual' && ann.width && ann.height)) {
              return (
                <div 
                    key={ann.id}
                    className={`absolute border-2 transition-all group ${
                      isActive || isHovered ? 'border-indigo-600 bg-indigo-600/20' : 
                      ann.type === 'ai' ? 'border-red-500 bg-red-500/10' : 'border-blue-500 bg-blue-500/10'
                    } ${isPointerMode ? 'cursor-move pointer-events-auto' : 'pointer-events-none'} ${zIndexClass}`}
                    style={{ left: `${ann.x}%`, top: `${ann.y}%`, width: `${ann.width}%`, height: `${ann.height}%` }}
                    onMouseDown={(e) => isPointerMode && handleAnnotationMouseDown(e, ann)}
                >
                    {isActive && isPointerMode && (
                        <div 
                            className="absolute bottom-0 right-0 w-4 h-4 bg-white border-2 border-indigo-600 cursor-nwse-resize translate-x-1/2 translate-y-1/2 rounded-full shadow-sm pointer-events-auto"
                            onMouseDown={(e) => handleResizeMouseDown(e, ann)}
                        />
                    )}
                </div>
              );
          }

          // Measurement
          if (ann.type === 'measure' && ann.endX !== undefined) {
            const dx = ann.endX - ann.x;
            const dy = ann.endY! - ann.y;
            const lenPct = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            // Calculate real pixels if natural size known
            let label = `${Math.round(lenPct * 10) / 10}%`;
            if (naturalSize) {
                const pxDist = Math.sqrt(
                    Math.pow((ann.endX - ann.x) / 100 * naturalSize.w, 2) + 
                    Math.pow((ann.endY! - ann.y) / 100 * naturalSize.h, 2)
                );
                label = `${Math.round(pxDist)}px`;
            }
            
            return (
              <div key={ann.id} className={`absolute origin-left flex items-center justify-center transition-all ${zIndexClass} ${isPointerMode ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'} ${isActive || isHovered ? 'bg-indigo-600' : 'bg-red-500'}`} style={{ left: `${ann.x}%`, top: `${ann.y}%`, width: `${lenPct}%`, height: '2px', transform: `rotate(${angle}deg)` }} onMouseDown={(e) => { e.stopPropagation(); onSelectAnnotation(ann.id); }}>
                <div className="bg-white px-2 py-0.5 rounded-full border text-[20px] font-bold shadow-sm whitespace-nowrap" style={{ transform: `rotate(${-angle}deg)` }}>
                    {label}
                </div>
              </div>
            );
          }

          // Colors
          if (ann.type === 'color' && ann.color) {
            return (
              <div key={ann.id} className={`absolute flex items-center gap-2 px-2 py-1 bg-white border-2 rounded-lg shadow-xl transition-all ${zIndexClass} ${isPointerMode ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'} ${isActive || isHovered ? 'border-indigo-600 scale-110' : 'border-slate-100'}`} style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: 'translate(-50%, -50%)' }} onMouseDown={(e) => { e.stopPropagation(); onSelectAnnotation(ann.id); }}>
                <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: ann.color }} />
                <span className="text-[20px] font-bold font-mono text-slate-800">{ann.color}</span>
              </div>
            );
          }

          // Manual Pins
          return (
            <div key={ann.id} className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all shadow-md ${zIndexClass} ${isPointerMode ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'} ${isActive || isHovered ? 'bg-indigo-600 text-white border-white scale-125' : 'bg-white text-blue-600 border-blue-600'}`} style={{ left: `${ann.x}%`, top: `${ann.y}%` }} onMouseDown={(e) => { e.stopPropagation(); onSelectAnnotation(ann.id); }}>
                {ann.type === 'manual' ? '+' : '!'}
            </div>
          );
        })}
        
        {/* Interaction Previews */}
        {interactionStart && interactionCurrent && activeTool === ToolMode.RULER && (
           <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-50">
               <svg className="w-full h-full overflow-visible">
                   <line 
                      x1={`${interactionStart.x}%`} 
                      y1={`${interactionStart.y}%`} 
                      x2={`${interactionCurrent.x}%`} 
                      y2={`${interactionCurrent.y}%`} 
                      stroke="#4f46e5" 
                      strokeWidth="2" 
                      strokeDasharray="4"
                   />
               </svg>
               <div className="absolute bg-indigo-600 text-white text-[20px] font-bold px-2 py-0.5 rounded shadow-sm font-mono whitespace-nowrap" style={{ left: `${interactionCurrent.x}%`, top: `${interactionCurrent.y}%`, transform: 'translate(10px, 10px)'}}>
                   {naturalSize 
                     ? `${Math.round(Math.sqrt(Math.pow((interactionCurrent.x - interactionStart.x)/100 * naturalSize.w, 2) + Math.pow((interactionCurrent.y - interactionStart.y)/100 * naturalSize.h, 2)))}px`
                     : `${Math.round(Math.sqrt(Math.pow(interactionCurrent.x - interactionStart.x, 2) + Math.pow(interactionCurrent.y - interactionStart.y, 2)) * 10) / 10}%`
                   }
               </div>
           </div>
        )}
        
        {interactionStart && interactionCurrent && activeTool === ToolMode.POINTER && (Math.abs(interactionCurrent.x - interactionStart.x) > 0.5) && (
            <div 
                className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-50"
                style={{
                    left: `${Math.min(interactionStart.x, interactionCurrent.x)}%`,
                    top: `${Math.min(interactionStart.y, interactionCurrent.y)}%`,
                    width: `${Math.abs(interactionCurrent.x - interactionStart.x)}%`,
                    height: `${Math.abs(interactionCurrent.y - interactionStart.y)}%`
                }}
            />
        )}
      </>
    );
  };

  // Common wrapper for the interactive Dev Image
  const InteractiveDevImage = () => (
     <div className="relative">
        <img src={activeDevImage?.data} className="max-w-none block pointer-events-none select-none" draggable={false} />
        {/* Interactive Layer Overlay */}
        <div 
            ref={interactiveLayerRef}
            className="absolute inset-0 z-30"
            onMouseDown={handleToolMouseDown}
            onMouseMove={handleToolMouseMove}
            onMouseUp={handleToolMouseUp}
            onMouseLeave={() => setLoupeState(null)}
        />
        {renderAnnotations()}
     </div>
  );

  return (
    <div className="h-full flex flex-col relative w-full overflow-hidden bg-slate-100">
        <div 
            ref={outerContainerRef}
            className={`flex-1 flex overflow-hidden p-8 ${cursorStyle} items-center justify-center`}
            onMouseDown={handleContainerMouseDown}
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onMouseLeave={handleContainerMouseUp}
            onWheel={(e) => { e.preventDefault(); e.deltaY < 0 ? onZoomIn() : onZoomOut(); }}
        >
            <div 
                className="relative transition-transform duration-75 origin-center will-change-transform" 
                style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
            >
                {mode === ComparisonMode.SIDE_BY_SIDE ? (
                    <div className="flex gap-10 items-start">
                        {/* Design Image (Static Reference) */}
                        <div className="relative border-8 border-indigo-500 shadow-2xl bg-white shrink-0 rounded-xl overflow-hidden group">
                            <img src={designImage} className="max-w-none block pointer-events-none select-none" draggable={false} />
                            <div className="absolute top-4 left-4 z-50">
                                <div className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg font-bold text-sm tracking-wide backdrop-blur-md bg-opacity-90 ring-4 ring-indigo-500/30">
                                    <Paintbrush size={16} />
                                    设计稿 Design
                                </div>
                            </div>
                        </div>
                        {/* Dev Image (Interactive) */}
                        <div className="relative border-8 border-emerald-500 shadow-2xl bg-white shrink-0 rounded-xl overflow-hidden group">
                             <InteractiveDevImage />
                             <div className="absolute top-4 left-4 z-50">
                                <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-full shadow-lg font-bold text-sm tracking-wide backdrop-blur-md bg-opacity-90 ring-4 ring-emerald-500/30">
                                    <Code2 size={16} />
                                    实现图 Dev
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="relative border-8 border-slate-700 shadow-2xl bg-white shrink-0 rounded-xl overflow-hidden">
                         {/* Base: Dev Image with Interactivity */}
                         <InteractiveDevImage />
                        
                        {/* Overlays */}
                        {mode === ComparisonMode.SLIDER && (
                            <>
                                <div className="absolute inset-0 pointer-events-none z-20" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
                                    <img src={designImage} className="max-w-none block select-none" draggable={false} />
                                </div>
                                <div 
                                    className="absolute top-0 bottom-0 w-4 -ml-2 bg-transparent cursor-ew-resize z-40 flex items-center justify-center group outline-none"
                                    style={{ left: `${sliderPosition}%` }}
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsSliderDragging(true); }}
                                >
                                    <div className="w-0.5 h-full bg-white group-hover:bg-indigo-400 shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-colors" />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center text-gray-600 group-hover:text-indigo-600 group-hover:scale-110 transition-all">
                                         <MoveHorizontal size={16} />
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {mode === ComparisonMode.OVERLAY && (
                             <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                                 <img 
                                    src={designImage} 
                                    className="max-w-none block opacity-50 transition-transform duration-75" 
                                    style={{ transform: `translate(${overlayOffset.x}px, ${overlayOffset.y}px)` }}
                                    draggable={false}
                                 />
                             </div>
                        )}
                    </div>
                )}
            </div>
        </div>
        
        {/* Loupe Floating Element */}
        {activeTool === ToolMode.COLOR_PICKER && loupeState && (
            <div 
                className="fixed pointer-events-none z-[100] flex flex-col items-center gap-2"
                style={{ left: loupeState.x + 20, top: loupeState.y + 20 }}
            >
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-white relative ring-1 ring-black/10">
                    <canvas 
                        ref={loupeCanvasRef} 
                        width={100} 
                        height={100} 
                        className="w-full h-full"
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 border border-white/80 shadow-[0_0_2px_black]"></div>
                </div>
                <div className="bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded shadow-lg font-mono tracking-widest border border-white/20">
                    {loupeState.color}
                </div>
            </div>
        )}

        <div className="absolute bottom-6 right-6 z-40 bg-white shadow-xl border p-1 rounded-xl flex items-center gap-1">
             <button onClick={onZoomOut} className="p-2 hover:bg-slate-100 rounded-lg"><ZoomOut size={16}/></button>
             <span className="text-xs font-black w-10 text-center">{Math.round(scale * 100)}%</span>
             <button onClick={onZoomIn} className="p-2 hover:bg-slate-100 rounded-lg"><ZoomIn size={16}/></button>
             <button onClick={onResetZoom} className="p-2 hover:bg-slate-100 rounded-lg border-l ml-1"><RotateCcw size={14}/></button>
        </div>
    </div>
  );
};

export default ComparisonView;
