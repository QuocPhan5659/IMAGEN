import React, { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './src/services/firebase';
import { Auth } from './src/components/Auth';
import { VIEWS, SPECIAL_VIEWS, COMMON_CONSTRAINT, MULTI_ANGLE_SUB_PROMPTS, ARCHITECTURAL_ANGLES } from './constants';
import { GenerationState, Resolution, AspectRatio, ViewDefinition, ModelType } from './types';
import { ImageUploader } from './components/ImageUploader';
import { ViewCard } from './components/ViewCard';
import { ImageModal } from './components/ImageModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { generateArchitecturalView, analyzeArchitecturalStyle, ArchitecturalAnalysis } from './services/geminiService';
import { Box, Sparkles, AlertCircle, Settings, ScanEye, FileText, CheckCircle2, Plus, Key, Sun, Lightbulb, LayoutGrid, Layers, Loader2, RefreshCw, Download, Maximize2, ArrowUpCircle, Moon, Camera, X, ChevronDown, LogIn } from 'lucide-react';

// Declare AI Studio global types
declare global {
  interface AIStudio {
    openSelectKey: () => Promise<void>;
    hasSelectedApiKey: () => Promise<boolean>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [resolution, setResolution] = useState<Resolution>('1K');
  const [selectedModel, setSelectedModel] = useState<ModelType>('fast');
  const [customViews, setCustomViews] = useState<ViewDefinition[]>([]);
  const [useMasterLighting, setUseMasterLighting] = useState(false);
  
  const [generations, setGenerations] = useState<GenerationState>(() => {
    const initial: GenerationState = {};
    [...VIEWS, ...SPECIAL_VIEWS].forEach(view => {
      initial[view.id] = { id: view.id, status: 'idle' };
    });
    return initial;
  });
  
  // Analysis State
  const [analysis, setAnalysis] = useState<ArchitecturalAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'standard' | 'special'>('standard');
  const [extractedViews, setExtractedViews] = useState<Record<number, string[]>>({});
  const [isExtracting, setIsExtracting] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [specialViews, setSpecialViews] = useState<ViewDefinition[]>(SPECIAL_VIEWS);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [specialViewPrompts, setSpecialViewPrompts] = useState<Record<number, string>>({});
  const [isStopping, setIsStopping] = useState<Record<number, boolean>>({});
  const cancelRefs = React.useRef<Record<number, boolean>>({});

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (activeTab === 'standard') {
          handleAddCustomView();
        } else {
          handleAddSpecialView();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // API Key State
  const [userApiKey, setUserApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const checkApiKey = async (isPaidModel: boolean) => {
    // If user has provided a manual key, use it
    if (userApiKey) return true;

    // Fallback to platform key if available
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (hasKey) return true;
    }

    // If it's a paid model and no key is found, return false to trigger fallback
    if (isPaidModel) return false;

    // For free models, we can proceed with the environment's default key
    return true;
  };

  const handleStop = (viewId: number) => {
    cancelRefs.current[viewId] = true;
    setIsStopping(prev => ({ ...prev, [viewId]: true }));
    setGenerations(prev => ({
      ...prev,
      [viewId]: { ...prev[viewId], status: 'idle' }
    }));
  };

  const handleSaveApiKey = (key: string) => {
    setUserApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const handleImagesUpload = (newImages: string[]) => {
    setGlobalError(null);
    setSourceImages(prev => {
      const combined = [...prev, ...newImages];
      return combined.slice(0, 5); // Enforce max 5 limit
    });
    
    // NOTE: Removed resetGenerations() to preserve existing views when adding images
    setAnalysis(null); 
    setAnalysisError(null);
  };

  // Add a generated image back to source images
  const handleAddGeneratedToSource = (imageUrl: string) => {
    if (sourceImages.length >= 5) {
      setGlobalError("Maximum 5 reference images allowed. Please remove one to add this view.");
      return;
    }
    handleImagesUpload([imageUrl]);
    // Scroll to top to see the added image
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveImage = (index: number) => {
    setSourceImages(prev => prev.filter((_, i) => i !== index));
    // NOTE: Removed resetGenerations() to preserve existing views when removing images
    setAnalysis(null);
  };

  const handleClearAllImages = () => {
    setSourceImages([]);
    // NOTE: Removed resetGenerations() to preserve existing views even when clearing source
    setAnalysis(null);
    setAnalysisError(null);
  };

  const resetGenerations = () => {
    const reset: GenerationState = {};
    [...VIEWS, ...SPECIAL_VIEWS, ...customViews].forEach(view => {
      reset[view.id] = { id: view.id, status: 'idle' };
    });
    setGenerations(reset);
  };

  // Custom View Handlers
  const handleAddCustomView = () => {
    const newId = Date.now();
    const newView: ViewDefinition = {
      id: newId,
      titleVI: "", // Empty for user to fill
      titleEN: "Custom View",
      description: "Custom user defined view",
      prompt: "Tạo ra góc chụp nghệ thuật với máy ảnh chuyên nghiệp, bao gồm: ", // Default prompt
      isCustom: true
    };
    setCustomViews(prev => [...prev, newView]);
  };

  const handleAddSpecialView = () => {
    const newId = Date.now();
    const newView: ViewDefinition = {
      id: newId,
      titleVI: `Collage 4 Góc Nghệ Thuật ${specialViews.length + 1}`,
      titleEN: `Artistic 4-Angle Collage ${specialViews.length + 1}`,
      description: "Cận cảnh, trung cảnh, toàn cảnh (Close-up, medium, wide).",
      prompt: `Dựa vào ảnh tải lên làm tham chiếu, Tạo ra 4 góc chụp nghệ thuật với máy ảnh chuyên nghiệp, bao gồm cả Đặc Tả, Cận Cảnh, Trung Cảnh và Toàn Cảnh.. Giảm kích thước 4-View Collage cho đồng bộ bằng với các bố cục 2 bên được cân xứng chuyên nghiệp, Giữ nguyên độ phân giải gốc, không làm giảm chất lượng. Duy trì độ sắc nét nguyên bản, không làm mờ, không nén.
    MANDATORY COMPOSITION: You MUST arrange the 4 views in a strict 2x2 grid layout with 4 equal-sized rectangular panels. 
    - Top-Left: Wide Panoramic Shot (Toàn cảnh).
    - Top-Right: Medium Shot (Trung cảnh).
    - Bottom-Left: Detail Shot 1 (Cận cảnh 1).
    - Bottom-Right: Detail Shot 2 (Cận cảnh 2).
    Style: Professional architectural photography, consistent lighting and materials across all 4 views. High detailed, photorealistic. ${COMMON_CONSTRAINT}`,
      isCustom: true
    };
    setSpecialViews(prev => [...prev, newView]);
  };

  const handleDeleteSpecialView = (id: number) => {
    setSpecialViews(prev => prev.filter(v => v.id !== id));
    setGenerations(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleRenameSpecialView = (id: number, newName: string) => {
    setSpecialViews(prev => prev.map(v => v.id === id ? { ...v, titleVI: newName } : v));
  };

  const handleDeleteCustomView = (id: number) => {
    setCustomViews(prev => prev.filter(v => v.id !== id));
    setGenerations(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleRenameCustomView = (id: number, newTitle: string) => {
    setCustomViews(prev => prev.map(v => v.id === id ? { ...v, titleVI: newTitle } : v));
  };

  // Handler for Architectural Analysis
  const handleAnalyze = async () => {
    if (sourceImages.length === 0) return;
    
    // Analysis uses a free model (1.5 Flash), so we don't strictly need a paid key
    if (!(await checkApiKey(false))) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const result = await analyzeArchitecturalStyle(sourceImages, userApiKey);
      setAnalysis(result);
    } catch (error: any) {
      console.error(error);
      const errorCode = error.status || error.code || error.error?.code;
      const errorMessage = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
      const is403 = errorCode === 403 || errorMessage.includes('403') || errorMessage.includes('Permission') || errorMessage.includes('PERMISSION_DENIED');
      
      const msg = errorMessage || "Failed to analyze images.";
      setAnalysisError(is403 ? "Permission Denied (403). Some models require a Paid API Key or specific permissions. Please check your configuration." : msg);
      
      if (is403) {
        setIsApiKeyModalOpen(true);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async (viewId: number, customPrompt?: string, aspectRatio: AspectRatio = '1:1', specificImage?: string) => {
    if (sourceImages.length === 0 && !specificImage) return;

    // Reset cancel state for this view
    cancelRefs.current[viewId] = false;
    setIsStopping(prev => ({ ...prev, [viewId]: false }));

    const isPaidModel = selectedModel === '3.1' || selectedModel === '3.2' || selectedModel === 'pro' || selectedModel === 'fast';
    const hasKey = await checkApiKey(isPaidModel);
    
    let modelToUse = selectedModel;
    if (!hasKey && isPaidModel) {
      modelToUse = 'banana-free';
      setGlobalError("No Paid API Key found. Falling back to Banana Free model.");
      setTimeout(() => setGlobalError(null), 4000);
    }

    setGenerations(prev => ({
      ...prev,
      [viewId]: { ...prev[viewId], status: 'loading', error: undefined }
    }));

    try {
      const allViewsList = [...VIEWS, ...specialViews, ...customViews];
      const view = allViewsList.find(v => v.id === viewId);
      if (!view) throw new Error("View not found");

      // Construct prompt: Use system prompt, or build one for custom views
      let effectivePrompt = view.prompt;
      
      // For the special collage view, we want to combine the base prompt with any custom additions
      const isSpecialView = specialViews.some(v => v.id === viewId);
      if (isSpecialView) {
        effectivePrompt = `${view.prompt}${customPrompt ? `\n\nADDITIONAL USER REQUIREMENTS: ${customPrompt}` : ''}`;
      } else if (view.isCustom) {
        effectivePrompt = `Create an architectural view matching this title/description: "${view.titleVI}".`;
      }

      // Combine source images with specific image if provided
      // For Special Collage, if specific image is provided, we use ONLY that to ensure focus
      const imagesToUse = specificImage ? [specificImage] : sourceImages;

      // If it's a special collage view, generate 4 separate images
      if (isSpecialView) {
        setExtractedViews(prev => ({
          ...prev,
          [viewId]: [undefined, undefined, undefined, undefined, undefined]
        }));

        // Parse customPrompt to see if user selected specific angles
        const selectedAngles = customPrompt 
          ? customPrompt.split('\n').filter(line => line.includes(':')) 
          : [];
        
        const subPrompts = MULTI_ANGLE_SUB_PROMPTS;
        
        // Generate 5 views sequentially to avoid rate limit (429) errors
        let firstError: any = null;
        const validResults: string[] = [];

        for (let index = 0; index < subPrompts.length; index++) {
          const subPrompt = subPrompts[index];
          try {
            if (cancelRefs.current[viewId]) break;

            // If user selected specific angles, try to use them for the slots
            // Otherwise fallback to the default sub-prompts
            let slotPrompt = subPrompt;
            if (selectedAngles.length > 0) {
              // Use the selected angle for this slot if available, otherwise fallback
              slotPrompt = selectedAngles[index % selectedAngles.length];
            }

            const url = await generateArchitecturalView(
              imagesToUse,
              `${slotPrompt}${customPrompt && !selectedAngles.includes(slotPrompt) ? `\n\nADDITIONAL USER REQUIREMENTS: ${customPrompt}` : ''}`,
              resolution,
              aspectRatio,
              analysis?.english || undefined,
              undefined, // Don't pass customPrompt again as it's included in the main prompt string
              useMasterLighting,
              userApiKey,
              modelToUse
            );
            
            if (cancelRefs.current[viewId]) break;

            setExtractedViews(prev => {
              const current = [...(prev[viewId] || [undefined, undefined, undefined, undefined, undefined])];
              current[index] = url;
              return { ...prev, [viewId]: current };
            });
            validResults.push(url);

            // Small delay between requests to be extra safe
            if (index < subPrompts.length - 1) {
              await new Promise(r => setTimeout(r, 1000));
            }
          } catch (err: any) {
            console.error(`Failed to generate sub-view ${index}`, err);
            if (!firstError) firstError = err;
          }
        }
        
        if (cancelRefs.current[viewId]) return;

        if (validResults.length > 0) {
          // Create a collage from the 5 images for the main result
          const collageUrl = await handleCreateCollage(validResults.length === 5 ? validResults : [...validResults, ...Array(5 - validResults.length).fill(validResults[0])]);
          
          if (cancelRefs.current[viewId]) return;

          setGenerations(prev => ({
            ...prev,
            [viewId]: { ...prev[viewId], status: 'success', imageUrl: collageUrl }
          }));
        } else {
          throw firstError || new Error("Failed to generate any views");
        }
      } else {
        // Standard generation
        const generatedImageUrl = await generateArchitecturalView(
          imagesToUse, 
          effectivePrompt, 
          resolution,
          aspectRatio,
          analysis?.english || undefined,
          customPrompt,
          useMasterLighting,
          userApiKey,
          modelToUse
        );

        setGenerations(prev => ({
          ...prev,
          [viewId]: { ...prev[viewId], status: 'success', imageUrl: generatedImageUrl }
        }));
      }
    } catch (error: any) {
      console.error(error);
      const errorCode = error.status || error.code || error.error?.code;
      const errorMessage = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
      const is403 = errorCode === 403 || errorMessage.includes('403') || errorMessage.includes('Permission') || errorMessage.includes('PERMISSION_DENIED');
      
      setGenerations(prev => ({
        ...prev,
        [viewId]: { 
          ...prev[viewId], 
          status: 'error', 
          error: is403 ? "API Key Permission Error (403)" : (errorMessage || "Failed to generate") 
        }
      }));
      
      if (is403) {
        setGlobalError(`Permission Denied (403). The selected model "${selectedModel}" likely requires a Paid API Key or your key lacks specific permissions. Please try switching to "Banana Nano" (Gemini 2.5) or select a valid Paid Key in the configuration.`);
        setIsApiKeyModalOpen(true);
      }
    }
  };

  const handleGenerateAll = useCallback(async () => {
    if (sourceImages.length === 0) return;
    
    // We don't block here as handleGenerate handles individual view fallbacks
    const isPaidModel = selectedModel === '3.1' || selectedModel === '3.2' || selectedModel === 'pro' || selectedModel === 'fast';
    await checkApiKey(isPaidModel);

    const allViews = [...VIEWS, ...SPECIAL_VIEWS, ...customViews];
    // For custom views, only generate if they have a title
    const viewsToGenerate = allViews.filter(view => {
      if (view.isCustom && !view.titleVI.trim()) return false;
      return generations[view.id]?.status !== 'success';
    });
    
    if (viewsToGenerate.length === 0) return;

    setGenerations(prev => {
      const next = { ...prev };
      viewsToGenerate.forEach(view => {
        next[view.id] = { ...next[view.id], status: 'loading', error: undefined };
      });
      return next;
    });

    for (const view of viewsToGenerate) {
      try {
        // Bulk generation uses default 1:1 ratio
        await handleGenerate(view.id, undefined, '1:1');
      } catch (e) {
        console.error(`Failed to generate view ${view.id}`, e);
      }
      
      if (view !== viewsToGenerate[viewsToGenerate.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

  }, [sourceImages, generations, resolution, analysis, customViews, useMasterLighting]);

  const handleCreateCollage = async (imageUrls: string[]): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const images = await Promise.all(imageUrls.map(url => {
          return new Promise<HTMLImageElement>((res, rej) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => res(img);
            img.onerror = rej;
            img.src = url;
          });
        }));

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        // Use the first image as size reference
        const w = images[0].width;
        const h = images[0].height;
        const padding = Math.floor(w * 0.04);
        const gap = Math.floor(w * 0.02);
        const borderRadius = Math.floor(w * 0.04);
        
        // 5-View Layout:
        // Row 1: 2 images
        // Row 2: 2 images
        // Row 3: 1 image (full width)
        canvas.width = w * 2 + gap + padding * 2;
        canvas.height = h * 3 + gap * 2 + padding * 2;

        // Fill background with dark grey/black
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const drawRoundedImage = (img: HTMLImageElement, x: number, y: number, width: number, height: number, radius: number) => {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + width - radius, y);
          ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
          ctx.lineTo(x + width, y + height - radius);
          ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
          ctx.lineTo(x + radius, y + height);
          ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, x, y, width, height);
          ctx.restore();
        };

        // Row 1
        drawRoundedImage(images[0], padding, padding, w, h, borderRadius);
        drawRoundedImage(images[1], padding + w + gap, padding, w, h, borderRadius);
        
        // Row 2
        drawRoundedImage(images[2], padding, padding + h + gap, w, h, borderRadius);
        drawRoundedImage(images[3], padding + w + gap, padding + h + gap, w, h, borderRadius);
        
        // Row 3: Panoramic View (View 5)
        // Full width: w * 2 + gap
        drawRoundedImage(images[4], padding, padding + h * 2 + gap * 2, w * 2 + gap, h, borderRadius);

        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleExtractViews = async (viewId: number, imageUrl: string) => {
    setIsExtracting(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      const w = img.width / 2;
      const h = img.height / 2;
      canvas.width = w;
      canvas.height = h;

      const views: string[] = [];
      
      // Top Left
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h, 0, 0, w, h);
      views.push(canvas.toDataURL('image/png'));

      // Top Right
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, w, 0, w, h, 0, 0, w, h);
      views.push(canvas.toDataURL('image/png'));

      // Bottom Left
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, h, w, h, 0, 0, w, h);
      views.push(canvas.toDataURL('image/png'));

      // Bottom Right
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, w, h, w, h, 0, 0, w, h);
      views.push(canvas.toDataURL('image/png'));

      setExtractedViews(prev => ({
        ...prev,
        [viewId]: views
      }));
    } catch (err) {
      console.error("Extraction failed", err);
    } finally {
      setIsExtracting(false);
    }
  };

  const allViews = [...VIEWS, ...specialViews, ...customViews];

  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-600/20 border-t-purple-600 rounded-full animate-spin" />
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Initializing Workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth theme={theme} />;
  }

  return (
    <div className={`min-h-screen pb-12 transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-30 transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg shadow-blue-500/20">
              <Box size={24} />
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight uppercase ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>ArchiView AI</h1>
              <p className={`text-[10px] font-bold uppercase tracking-[0.2em] hidden sm:block ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Architectural Visualization</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className={`flex p-1 rounded-lg mr-2 transition-colors ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <button 
                  onClick={() => setActiveTab('standard')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${activeTab === 'standard' ? (theme === 'dark' ? 'bg-gray-600 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm') : (theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}
                >
                  <LayoutGrid size={14} />
                  <span>Standard</span>
                </button>
                <button 
                  onClick={() => setActiveTab('special')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${activeTab === 'special' ? (theme === 'dark' ? 'bg-gray-600 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm') : (theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}
                >
                  <Layers size={14} />
                  <span>Collage</span>
                </button>
             </div>

             <div className="h-6 w-px bg-gray-200 hidden sm:block mx-1"></div>

             {/* Resolution Selector in Header */}
             <div className="flex items-center gap-2">
                <div className={`flex p-1 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  {(['1K', '2K', '4K'] as Resolution[]).map((res) => (
                    <button
                      key={res}
                      onClick={() => setResolution(res)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${resolution === res ? (theme === 'dark' ? 'bg-gray-600 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm') : (theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}
                    >
                      {res}
                    </button>
                  ))}
                </div>

                <div className="h-6 w-px bg-gray-200 hidden sm:block mx-1"></div>

                {/* Model Selector */}
                <div className="flex items-center gap-2">
                  <div className="relative group">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value as ModelType)}
                      className={`appearance-none pl-8 pr-8 py-1.5 text-[11px] font-bold rounded-full border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-purple-400 hover:bg-gray-700' : 'bg-white border-gray-200 text-purple-600 hover:bg-gray-50'}`}
                    >
                      <option value="2.5">2.5</option>
                      <option value="3.1">3.1</option>
                      <option value="3.2">3.2</option>
                      <option value="banana-free">Banana Free</option>
                      <option value="fast">Fast</option>
                      <option value="pro">Pro</option>
                    </select>
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-purple-500">
                      <Sparkles size={12} />
                    </div>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-purple-500">
                      <ChevronDown size={12} />
                    </div>
                  </div>
                </div>

                <div className="h-6 w-px bg-gray-200 hidden sm:block mx-1"></div>

                <button
                  onClick={activeTab === 'standard' ? handleAddCustomView : handleAddSpecialView}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-bold transition-all text-[10px] uppercase tracking-widest border shadow-sm ${theme === 'dark' ? 'bg-blue-900/20 border-blue-800 text-blue-400 hover:bg-blue-900/40' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'}`}
                  title={activeTab === 'standard' ? "Add New Custom Row" : "Add New Collage Row"}
                >
                  <Plus size={14} />
                  <span>Tạo hàng mới</span>
                </button>
              </div>
             
             {/* Theme Toggle */}
             <div className="flex items-center gap-2">
               <button 
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className={`p-2 rounded-lg border transition-all ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-yellow-400 hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                >
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>

                {/* User Profile & Sign Out */}
                <div className="flex items-center gap-3 pl-3 border-l border-gray-500/10">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className={`text-[9px] font-bold truncate max-w-[100px] ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      {user?.email?.split('@')[0]}
                    </span>
                    <span className="text-[7px] font-medium text-purple-500 uppercase tracking-widest">Architect</span>
                  </div>
                  <button 
                    onClick={handleSignOut}
                    className={`p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'bg-white border-gray-200 text-gray-500 hover:text-red-500 hover:bg-red-50 shadow-sm'}`}
                    title="Sign Out"
                  >
                    <LogIn size={16} className="rotate-180" />
                  </button>
                </div>
              </div>

             <button 
                onClick={() => setIsApiKeyModalOpen(true)}
                className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all border
                  ${userApiKey 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : (theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200')
                  }
                `}
              >
                <Key size={14} />
                <span>{userApiKey ? 'PRO' : 'API Key'}</span>
              </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-2 py-6">
        
        {globalError && (
          <div className={`w-full mb-6 p-4 border rounded-lg flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300 ${theme === 'dark' ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <div className="flex items-center gap-3 flex-grow">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-medium">{globalError}</p>
            </div>
            <button 
              onClick={() => setGlobalError(null)}
              className={`p-1 rounded-full hover:bg-black/5 transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : ''}`}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Action Section Container */}
        <div className="w-full mb-6 px-2">
          {/* Standard Tab Controls */}
          {activeTab === 'standard' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Reference & Configuration</h2>
              </div>

              <ImageUploader 
                currentImages={sourceImages} 
                onImagesUpload={handleImagesUpload} 
                onRemoveImage={handleRemoveImage}
                onClearAll={handleClearAllImages}
                theme={theme}
              />

              {/* Control Bar: Analyze / Master Lighting / Generate */}
              {sourceImages.length > 0 && (
                <div className={`flex flex-col sm:flex-row items-center gap-3 p-2 rounded-xl shadow-sm border transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  
                  {/* Analyze Button */}
                  <button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || sourceImages.length === 0}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
                      ${analysis 
                        ? (theme === 'dark' ? 'bg-green-900/20 text-green-400 border border-green-800' : 'bg-green-50 text-green-700 border border-green-200') 
                        : (theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                      }
                      ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <ScanEye size={16} />}
                    <span>{analysis ? 'Re-Analyze Style' : 'Analyze Style'}</span>
                  </button>

                  <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>

                  {/* Master Lighting Toggle */}
                  <button 
                    onClick={() => setUseMasterLighting(!useMasterLighting)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border
                      ${useMasterLighting 
                        ? (theme === 'dark' ? 'bg-yellow-900/20 border-yellow-800 text-yellow-400' : 'bg-yellow-50 border-yellow-200 text-yellow-700') 
                        : (theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100')
                      }
                    `}
                  >
                    {useMasterLighting ? <Lightbulb size={14} /> : <Sun size={14} />}
                    <span>Master Lighting</span>
                  </button>

                  <div className="flex-grow"></div>

                  {/* Generate All Button */}
                  <button 
                    onClick={handleGenerateAll}
                    disabled={sourceImages.length === 0}
                    className={`flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Sparkles size={16} />
                    <span>Generate All Views</span>
                  </button>
                </div>
              )}

              {/* Analysis Result Details (Inside Standard Tab) */}
              {analysisError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-center text-sm">
                  {analysisError}
                </div>
              )}

              {analysis && (
                <div className="mt-4 bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-800">
                      <CheckCircle2 size={18} />
                      <h3 className="font-bold text-sm uppercase tracking-wide">Architectural DNA Analyzed</h3>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    <div className="p-5">
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-extrabold">VN</span>
                        Phân tích Tiếng Việt
                      </h4>
                      <div className="flex gap-3">
                        <FileText className="text-gray-400 shrink-0 mt-1" size={18} />
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto pr-2">
                          {analysis.vietnamese}
                        </p>
                      </div>
                    </div>

                    <div className="p-5 bg-gray-50/30">
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-extrabold">EN</span>
                        English Analysis (DNA)
                      </h4>
                      <div className="flex gap-3">
                        <FileText className="text-gray-400 shrink-0 mt-1" size={18} />
                        <p className="text-sm text-gray-700 leading-relaxed font-mono whitespace-pre-wrap max-h-60 overflow-y-auto pr-2">
                          {analysis.english}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* View Grid */}
        {(sourceImages.length > 0 || activeTab === 'special') ? (
          <div className="space-y-8">
            {activeTab === 'special' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className={`mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div>
                    <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Multi-Angle Artistic Collage</h3>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Quality Selector for Special Tab */}
                    <div className={`flex items-center rounded-xl px-4 py-2 border transition-colors ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <span className={`mr-3 text-xs font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        <Settings size={14} /> Resolution:
                      </span>
                      <select 
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value as Resolution)}
                        className={`bg-transparent text-sm font-bold outline-none cursor-pointer ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                      >
                        <option value="1K">1K (Fast)</option>
                        <option value="2K">2K (HD)</option>
                        <option value="4K">4K (Ultra)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-12 w-full mx-auto">
                  {specialViews.map((view) => (
                    <div key={view.id} className={`flex flex-col lg:flex-row gap-6 items-start justify-center border-b pb-12 last:border-0 transition-colors ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
                      {/* Column 1: Control Card */}
                      <div className="w-full lg:w-[320px] shrink-0">
                        <ViewCard
                          key={view.id}
                          view={view}
                          data={generations[view.id]}
                          onAddToSource={handleAddGeneratedToSource}
                          disabled={isAnalyzing}
                          onMaximize={setModalImage}
                          onDelete={handleDeleteSpecialView}
                          onRename={handleRenameSpecialView}
                          buttonLabel={generations[view.id]?.status === 'loading' ? "STOP" : "GENERATE"}
                          onGenerate={(id, prompt, res, aspect) => {
                            if (generations[id]?.status === 'loading') {
                              handleStop(id);
                            } else {
                              handleGenerate(id, prompt, res, aspect);
                            }
                          }}
                          hideHeader={true}
                          customPrompt={specialViewPrompts[view.id] || "Tạo ra 5 góc chụp nghệ thuật với máy ảnh chuyên nghiệp, bao gồm: "}
                          onCustomPromptChange={(val) => setSpecialViewPrompts(prev => ({ ...prev, [view.id]: val }))}
                          hideResult={true}
                          hideDownload={true}
                          hideAddToSource={true}
                          hideLoading={true}
                          compact={true}
                          theme={theme}
                        />
                      </div>

                      <div className="flex-grow w-full">
                        <div className="flex flex-col md:flex-row gap-6">
                          {/* Column 2: Main Result */}
                          <div className="w-full md:w-1/2 shrink-0 flex flex-col gap-6">
                            <div className={`rounded-2xl border overflow-hidden aspect-square flex items-center justify-center relative group transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                              {generations[view.id]?.status === 'success' && generations[view.id]?.imageUrl ? (
                                <>
                                  <img 
                                    src={generations[view.id].imageUrl} 
                                    alt="Collage Result" 
                                    className="w-full h-full object-cover cursor-zoom-in"
                                    onClick={() => setModalImage(generations[view.id].imageUrl!)}
                                  />
                                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                                    VIEW COLLAGE
                                  </div>
                                </>
                              ) : generations[view.id]?.status === 'loading' ? (
                                <div className="flex flex-col items-center gap-4 text-blue-600">
                                  <Loader2 size={48} className="animate-spin" />
                                  <p className="font-bold uppercase tracking-widest text-[10px]">Generating...</p>
                                </div>
                              ) : (
                                <div className="text-center p-8 text-gray-300">
                                   <LayoutGrid size={60} className="mx-auto mb-4 opacity-10" />
                                   <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Collage Result</p>
                                </div>
                              )}
                            </div>

                            {/* Quick Select Angles Chips */}
                            <div className={`p-4 rounded-xl border transition-colors ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                              <div className="flex items-center gap-2 mb-3">
                                <Camera size={14} className="text-blue-500" />
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Gợi ý góc chụp (Quick Select)</span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                {ARCHITECTURAL_ANGLES.map((angle) => {
                                  const basePrompt = "Tạo ra 5 góc chụp nghệ thuật với máy ảnh chuyên nghiệp, bao gồm: ";
                                  const currentPrompt = specialViewPrompts[view.id] || basePrompt;
                                  
                                  // Check if the angle is already in the prompt as a separate line/item
                                  const isSelected = currentPrompt.split('\n').some(line => line.trim() === angle.value.trim());
                                  
                                  return (
                                    <button
                                      key={angle.label}
                                      onClick={() => {
                                        let newPrompt;
                                        if (isSelected) {
                                          // Remove the angle value precisely
                                          newPrompt = currentPrompt
                                            .split('\n')
                                            .filter(line => line.trim() !== angle.value.trim())
                                            .join('\n')
                                            .trim();
                                        } else {
                                          // Add the angle value
                                          newPrompt = currentPrompt ? `${currentPrompt}\n${angle.value}` : angle.value;
                                        }
                                        setSpecialViewPrompts(prev => ({ ...prev, [view.id]: newPrompt }));
                                      }}
                                      className={`w-full px-3 py-1 rounded-lg text-[9px] font-bold transition-all border text-left leading-tight h-8 flex items-center
                                        ${isSelected 
                                          ? 'bg-yellow-400 border-yellow-500 text-gray-900 shadow-sm scale-[1.02]' 
                                          : (theme === 'dark' 
                                            ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-blue-500 hover:text-blue-400' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600')
                                        }
                                      `}
                                    >
                                      {angle.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Column 3: Extracted Views */}
                          <div className="w-full md:w-1/2 shrink-0">
                            <div className="grid grid-cols-2 gap-3">
                              {[0, 1, 2, 3].map((i) => (
                                <div key={i} className={`rounded-xl border overflow-hidden aspect-[3/4] flex items-center justify-center relative group transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                                  {extractedViews[view.id]?.[i] ? (
                                    <>
                                      <img 
                                        src={extractedViews[view.id][i]} 
                                        alt={`View ${i + 1}`} 
                                        className="w-full h-full object-cover cursor-zoom-in"
                                        onClick={() => setModalImage(extractedViews[view.id][i])}
                                      />
                                      <div 
                                        className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-end justify-end p-2 cursor-zoom-in"
                                        onClick={() => setModalImage(extractedViews[view.id][i])}
                                      >
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const link = document.createElement('a');
                                            link.href = extractedViews[view.id][i];
                                            link.download = `view-${i + 1}.png`;
                                            link.click();
                                          }}
                                          className="p-2 bg-white/90 text-gray-900 rounded-full hover:bg-white shadow-lg transition-all transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                                          title="Download View"
                                        >
                                          <Download size={16} />
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">View {i + 1}</div>
                                  )}
                                </div>
                              ))}
                              {/* View 5 - Horizontal spanning 2 columns */}
                              <div className={`col-span-2 rounded-xl border overflow-hidden aspect-[16/9] flex items-center justify-center relative group transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                                {extractedViews[view.id]?.[4] ? (
                                  <>
                                    <img 
                                      src={extractedViews[view.id][4]} 
                                      alt="View 5" 
                                      className="w-full h-full object-cover cursor-zoom-in"
                                      onClick={() => setModalImage(extractedViews[view.id][4])}
                                    />
                                    <div 
                                      className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-end justify-end p-2 cursor-zoom-in"
                                      onClick={() => setModalImage(extractedViews[view.id][4])}
                                    >
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const link = document.createElement('a');
                                          link.href = extractedViews[view.id][4];
                                          link.download = `view-5.png`;
                                          link.click();
                                        }}
                                        className="p-2 bg-white/90 text-gray-900 rounded-full hover:bg-white shadow-lg transition-all transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                                        title="Download View"
                                      >
                                        <Download size={16} />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">View 5</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add New Row Button removed from here */}
                </div>
              </div>
            )}

            {activeTab === 'standard' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {VIEWS.map((view) => (
                  <ViewCard
                    key={view.id}
                    view={view}
                    data={generations[view.id]}
                    onGenerate={handleGenerate}
                    onAddToSource={handleAddGeneratedToSource}
                    disabled={sourceImages.length === 0 || isAnalyzing}
                    onMaximize={setModalImage}
                    theme={theme}
                  />
                ))}
                
                {customViews.map((view) => (
                  <ViewCard
                    key={view.id}
                    view={view}
                    data={generations[view.id]}
                    onGenerate={handleGenerate}
                    onAddToSource={handleAddGeneratedToSource}
                    disabled={sourceImages.length === 0 || isAnalyzing}
                    onMaximize={setModalImage}
                    onDelete={handleDeleteCustomView}
                    onRename={handleRenameCustomView}
                    initialCustomPrompt={view.prompt}
                    theme={theme}
                  />
                ))}
                
                <button
                  onClick={handleAddCustomView}
                  className={`flex flex-col items-center justify-center h-full min-h-[400px] border-2 border-dashed rounded-xl transition-all group ${theme === 'dark' ? 'bg-gray-800 border-gray-700 hover:border-blue-500 hover:bg-gray-700/50' : 'bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50'}`}
                >
                  <div className={`p-4 rounded-full transition-colors mb-4 ${theme === 'dark' ? 'bg-gray-700 text-gray-500 group-hover:bg-gray-600 group-hover:text-blue-400' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                    <Plus size={32} />
                  </div>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-gray-400 group-hover:text-blue-400' : 'text-gray-600 group-hover:text-blue-700'}`}>Add Custom View</span>
                  <span className="text-xs text-gray-400 mt-1">Create your own angle</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300 mx-auto max-w-4xl opacity-50 select-none grayscale">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-8 max-w-3xl mx-auto filter blur-[2px]">
               {[1,2,3,4].map(i => (
                 <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
               ))}
            </div>
            <p className="mt-8 text-xl font-medium text-gray-400">Upload images to unlock the view generator</p>
          </div>
        )}
      </main>

      <ImageModal 
        imageUrl={modalImage} 
        onClose={() => setModalImage(null)} 
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={handleSaveApiKey}
        currentKey={userApiKey}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />
    </div>
  );
};

export default App;