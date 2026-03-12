import React, { useState, useRef } from 'react';
import { ViewDefinition, GeneratedImage, AspectRatio } from '../types';
import { ASPECT_RATIOS, ARCHITECTURAL_ANGLES } from '../constants';
import { Loader2, RefreshCw, Download, Maximize2, PenTool, Ratio, Trash2, Edit3, ImagePlus, X, ArrowUpCircle, Camera } from 'lucide-react';

interface ViewCardProps {
  view: ViewDefinition;
  data: GeneratedImage;
  onGenerate: (viewId: number, customPrompt?: string, aspectRatio?: AspectRatio, specificImage?: string) => void;
  onAddToSource: (imageUrl: string) => void;
  disabled: boolean;
  onMaximize: (url: string) => void;
  onDelete?: (id: number) => void;
  onRename?: (id: number, newName: string) => void;
  buttonLabel?: string;
  hideHeader?: boolean;
  initialCustomPrompt?: string;
  customPrompt?: string;
  onCustomPromptChange?: (value: string) => void;
  hideDownload?: boolean;
  hideAddToSource?: boolean;
  hideResult?: boolean;
  hideLoading?: boolean;
  compact?: boolean;
  theme?: 'light' | 'dark';
}

export const ViewCard: React.FC<ViewCardProps> = ({ 
  view, 
  data, 
  onGenerate, 
  onAddToSource,
  disabled,
  onMaximize,
  onDelete,
  onRename,
  buttonLabel,
  hideHeader,
  initialCustomPrompt = '',
  customPrompt: externalCustomPrompt,
  onCustomPromptChange,
  hideDownload = false,
  hideAddToSource = false,
  hideResult = false,
  hideLoading = false,
  compact = false,
  theme = 'light'
}) => {
  const [internalCustomPrompt, setInternalCustomPrompt] = useState(initialCustomPrompt);
  const customPrompt = externalCustomPrompt !== undefined ? externalCustomPrompt : internalCustomPrompt;
  
  const setCustomPrompt = (value: string) => {
    if (onCustomPromptChange) {
      onCustomPromptChange(value);
    } else {
      setInternalCustomPrompt(value);
    }
  };

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('random');
  const [localImage, setLocalImage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Safe fallback if data is undefined (for new custom views)
  const safeData = data || { status: 'idle', id: view.id };
  const isIdle = safeData.status === 'idle';
  const isLoading = safeData.status === 'loading';
  const isSuccess = safeData.status === 'success';
  const isError = safeData.status === 'error';

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (safeData.imageUrl) {
      const link = document.createElement('a');
      link.href = safeData.imageUrl;
      link.download = `archiview-${view.id}-${view.titleEN.replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleAddToSource = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (safeData.imageUrl) {
      onAddToSource(safeData.imageUrl);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setLocalImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    // Reset value so same file can be selected again
    e.target.value = '';
  };

  const removeLocalImage = () => {
    setLocalImage(null);
  };

  // Smart Textarea Logic
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomPrompt(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (e.target.value) {
       e.target.style.height = 'auto';
       e.target.style.height = `${e.target.scrollHeight}px`;
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.target.style.height = compact ? '200px' : '120px'; 
    e.target.scrollTop = 0;
  };

  return (
    <div className={`rounded-xl shadow-sm border overflow-hidden flex flex-col h-full hover:shadow-md transition-all duration-300 relative group/card ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      
      {/* Header - Fixed height */}
      {!hideHeader && (
        <div className={`p-3 border-b flex flex-col justify-center relative transition-colors ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50/50 border-gray-100'} ${compact ? 'h-[50px]' : 'h-[68px]'}`}>
          <div className="absolute top-2 right-2 flex items-center gap-1">
            {view.isCustom && onDelete ? (
               <button 
                onClick={() => onDelete(view.id)}
                className={`p-1 rounded-full transition-colors ${theme === 'dark' ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/20' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                title="Delete Custom View"
               >
                 <Trash2 size={14} />
               </button>
            ) : (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${theme === 'dark' ? 'text-blue-400 bg-blue-900/20' : 'text-blue-600 bg-blue-50'}`}>
                #{view.id}
              </span>
            )}
          </div>

          {view.isCustom && onRename ? (
            <div className="pr-6">
              <div className={`flex items-center gap-1 mb-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                <Edit3 size={10} />
                <span className="text-[10px] uppercase font-bold tracking-wider">Custom View Name</span>
              </div>
              <input 
                type="text" 
                value={view.titleVI}
                onChange={(e) => onRename(view.id, e.target.value)}
                placeholder="Name this view..."
                className={`w-full bg-transparent border-none p-0 text-sm font-bold focus:ring-0 focus:outline-none truncate ${theme === 'dark' ? 'text-white placeholder:text-gray-600' : 'text-gray-900 placeholder:text-gray-300'}`}
                autoFocus={view.titleVI === ''}
              />
            </div>
          ) : (
            <>
              <h3 className={`font-bold leading-tight text-sm truncate pr-8 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} title={view.titleVI}>
                {view.titleVI}
              </h3>
              <p className={`text-[10px] mt-0.5 font-medium truncate pr-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} title={view.titleEN}>
                {view.titleEN}
              </p>
            </>
          )}
        </div>
      )}

      {/* Image Area(s) */}
      <div className={`flex flex-col overflow-hidden transition-colors ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
        
        {/* Reference Image Section */}
        {localImage ? (
          <div className={`relative w-full border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} ${compact ? 'aspect-[3/4]' : 'aspect-square'}`}>
            <img 
              src={localImage} 
              alt="Local reference" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
               <button 
                onClick={removeLocalImage}
                className={`p-2 rounded-full shadow-lg transition-colors ${theme === 'dark' ? 'bg-gray-800 text-red-400 hover:bg-gray-700' : 'bg-white text-red-500 hover:bg-red-50'} ${compact ? 'scale-75' : ''}`}
               >
                 <Trash2 size={compact ? 16 : 20} />
               </button>
            </div>
            <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase shadow-sm">
              REF
            </div>
          </div>
        ) : (isIdle || (isSuccess && !safeData.imageUrl)) && (
          <div className={`text-center p-6 w-full flex flex-col items-center justify-center group/upload border-b transition-colors ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} ${compact ? 'aspect-[3/4] py-2' : 'aspect-square'}`}>
            <label className="cursor-pointer flex flex-col items-center">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageUpload}
                disabled={disabled || isLoading}
              />
              <div className={`rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-gray-800 text-gray-500 group-hover/upload:bg-blue-900/40 group-hover/upload:text-blue-400' : 'bg-gray-200/50 text-gray-400 group-hover/upload:bg-blue-100 group-hover/upload:text-blue-600'} ${compact ? 'w-10 h-10 mb-1' : 'w-14 h-14 mb-3'}`}>
                <ImagePlus size={compact ? 18 : 24} className="opacity-50 group-hover/upload:opacity-100" />
              </div>
              <p className={`font-bold transition-colors uppercase tracking-wider ${theme === 'dark' ? 'text-gray-600 group-hover/upload:text-blue-400' : 'text-gray-400 group-hover/upload:text-blue-600'} ${compact ? 'text-[9px]' : 'text-xs'}`}>Upload Image</p>
              {!compact && <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>Click to select reference</p>}
            </label>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !hideLoading && (
          <div className={`flex flex-col items-center justify-center animate-pulse border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-blue-400' : 'bg-white border-gray-200 text-blue-600'} ${compact ? 'p-4 aspect-[3/4]' : 'p-12 aspect-square'}`}>
            <Loader2 size={compact ? 24 : 32} className="animate-spin mb-3" />
            <p className={`font-bold uppercase tracking-widest ${compact ? 'text-[9px]' : 'text-xs'}`}>Reconstructing...</p>
          </div>
        )}

        {/* Generated Result Section */}
        {isSuccess && safeData.imageUrl && !hideResult && (
          <div className={`relative w-full group/result ${compact ? 'aspect-[3/4]' : 'aspect-square'}`}>
            <img 
              src={safeData.imageUrl} 
              alt={view.titleEN} 
              onClick={() => onMaximize(safeData.imageUrl!)}
              className="w-full h-full object-cover transition-transform duration-700 group-hover/result:scale-105 cursor-zoom-in"
            />
            <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase shadow-sm">
              Generated Result
            </div>
            {/* Overlay Actions */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/result:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 backdrop-blur-[2px] pointer-events-none">
               <button 
                onClick={(e) => { e.stopPropagation(); onMaximize(safeData.imageUrl!); }}
                className={`p-2 rounded-full transition-colors shadow-lg pointer-events-auto ${theme === 'dark' ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-100'}`}
                title="Maximize View"
              >
                <Maximize2 size={16} />
              </button>
              {!hideDownload && (
                <button 
                  onClick={handleDownload}
                  className={`p-2 rounded-full transition-colors shadow-lg pointer-events-auto ${theme === 'dark' ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-100'}`}
                  title="Download Image"
                >
                  <Download size={16} />
                </button>
              )}
              {!hideAddToSource && (
                <button 
                  onClick={handleAddToSource}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg pointer-events-auto"
                  title="Add to Reference Images (Use as Source)"
                >
                  <ArrowUpCircle size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className={`p-6 text-center border-b ${theme === 'dark' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-100 text-red-500'}`}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1">Generation Failed</p>
            <p className="text-[10px] opacity-75">{safeData.error}</p>
          </div>
        )}
      </div>

      {/* Inputs Area */}
      <div className={`px-3 pt-3 space-y-2 transition-colors ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} ${compact ? 'pt-2' : ''}`}>
        
        {/* Smart Textarea Input */}
        <div className="relative">
          <div className={`absolute top-2.5 left-2.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            <PenTool size={12} />
          </div>
          <textarea
            ref={textareaRef}
            value={customPrompt}
            onChange={handleInput}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={view.isCustom ? "Describe the view details..." : "Additional details..."}
            rows={1}
            className={`w-full pl-8 pr-3 py-2.5 text-xs border rounded-lg transition-all resize-none overflow-hidden ${theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white focus:bg-gray-950 focus:ring-blue-500 placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:ring-blue-500 placeholder:text-gray-400'} ${compact ? 'min-h-[200px] py-2' : 'min-h-[120px]'}`}
            style={{ height: compact ? '200px' : '120px' }}
            disabled={disabled || isLoading}
          />
        </div>
        
        {/* Aspect Ratio Grid */}
        <div className="space-y-1.5">
          <div className={`flex items-center gap-1.5 mb-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            <Ratio size={12} />
            <span className="text-[10px] uppercase font-bold tracking-wider">Tỷ lệ khung hình (Aspect Ratio)</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ASPECT_RATIOS.map((ratio) => {
              const isSelected = aspectRatio === ratio.value;
              return (
                <button
                  key={ratio.value}
                  onClick={() => setAspectRatio(ratio.value)}
                  disabled={disabled || isLoading}
                  className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all border text-left leading-tight h-8 flex items-center
                    ${isSelected 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm scale-[1.02]' 
                      : (theme === 'dark' 
                        ? 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-750 hover:border-gray-600 hover:text-gray-200' 
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-white hover:border-blue-200 hover:text-blue-600')
                    }
                    ${(disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {ratio.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Action */}
      <div className={`p-3 transition-colors ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} ${compact ? 'p-2' : ''}`}>
        <button
          onClick={() => onGenerate(view.id, customPrompt, aspectRatio, localImage || undefined)}
          disabled={disabled || isLoading || (view.isCustom && !view.titleVI.trim())}
          className={`w-full py-2 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all
            ${isSuccess 
              ? (theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200') 
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg shadow-blue-200'
            }
            ${(disabled || isLoading || (view.isCustom && !view.titleVI.trim())) ? 'opacity-50 cursor-not-allowed shadow-none' : ''}
            ${compact ? 'py-1.5 text-xs' : ''}
          `}
        >
          {isLoading ? (
            <>Running...</>
          ) : (
            <>
              {isSuccess && <RefreshCw size={14} />}
              {buttonLabel || (isSuccess ? 'Retry' : 'Generate')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};