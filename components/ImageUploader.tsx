import React, { useCallback, useState } from 'react';
import { Upload, Image as ImageIcon, X, Plus, Trash2 } from 'lucide-react';

interface ImageUploaderProps {
  currentImages: string[];
  onImagesUpload: (newImages: string[]) => void;
  onRemoveImage: (index: number) => void;
  onClearAll: () => void;
  theme?: 'light' | 'dark';
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ currentImages, onImagesUpload, onRemoveImage, onClearAll, theme = 'light' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const MAX_IMAGES = 5;

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Trigger upload on click anywhere in the container
    triggerUpload();
  }, [triggerUpload]);

  const processFiles = useCallback((files: FileList | File[]) => {
    const remainingSlots = MAX_IMAGES - currentImages.length;
    if (remainingSlots <= 0) {
      alert(`You can only upload a maximum of ${MAX_IMAGES} images.`);
      return;
    }

    const filesToProcess = Array.from(files).filter(file => file.type.startsWith('image/')).slice(0, remainingSlots);
    
    if (filesToProcess.length === 0) {
      if (Array.from(files).length > 0 && remainingSlots > 0) {
        alert('Please select valid image files.');
      }
      return;
    }

    const promises = filesToProcess.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(base64Images => {
      onImagesUpload(base64Images);
    });
  }, [currentImages.length, onImagesUpload]);
  
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files);
      // Reset input value to allow selecting the same file again if needed
      event.target.value = '';
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  return (
    <div className="w-full mb-8">
      {/* Upload Area / Gallery */}
      <div className="space-y-4">
        
        {/* If no images, show large upload box */}
        {currentImages.length === 0 ? (
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerUpload}
            className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 group max-w-4xl mx-auto
              ${isDragging 
                ? (theme === 'dark' ? 'border-blue-500 bg-blue-900/20 scale-[1.02] shadow-xl shadow-blue-900/20' : 'border-blue-500 bg-blue-50 scale-[1.02] shadow-xl') 
                : (theme === 'dark' ? 'border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-blue-500' : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-blue-400')
              }
            `}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4 pointer-events-none">
              <div className={`p-4 rounded-full mb-4 transition-transform duration-300 ${isDragging ? (theme === 'dark' ? 'bg-blue-900/40 text-blue-400 scale-110' : 'bg-blue-100 text-blue-600 scale-110') : (theme === 'dark' ? 'bg-gray-700 text-gray-400 group-hover:scale-110 group-hover:text-blue-400' : 'bg-blue-50 text-blue-500 group-hover:scale-110')}`}>
                <Upload size={32} />
              </div>
              <p className={`mb-2 text-lg font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                {isDragging ? 'Drop images here' : 'Click or drag to upload reference images'}
              </p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Upload up to 5 images (JPG, PNG, WebP)</p>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept="image/*"
              multiple
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-end mb-1">
              <button 
                onClick={onClearAll}
                className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                title="Remove all images"
              >
                <Trash2 size={12} /> Clear All
              </button>
            </div>
            
            {/* Grid View for uploaded images - Full Width */}
            <div 
              onClick={handleContainerClick}
              className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800' : 'bg-gray-50/50 border-gray-100 hover:bg-gray-100/50'}`}
            >
              {currentImages.map((img, index) => (
                <div key={index} className={`relative group aspect-square rounded-xl shadow-sm border overflow-hidden cursor-default transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <img 
                    src={img} 
                    alt={`Reference ${index + 1}`} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveImage(index);
                    }}
                    className={`absolute top-2 right-2 p-1.5 rounded-full shadow-sm border opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-red-900/40 hover:text-red-400' : 'bg-white/90 border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600'}`}
                    title="Remove image"
                  >
                    <X size={16} />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                    Ref {index + 1}
                  </div>
                </div>
              ))}

              {/* Add Button (if less than MAX_IMAGES) */}
              {currentImages.length < MAX_IMAGES && (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerUpload}
                  className={`flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300
                    ${isDragging 
                      ? (theme === 'dark' ? 'border-blue-500 bg-blue-900/20' : 'border-blue-500 bg-blue-50') 
                      : (theme === 'dark' ? 'border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-blue-500' : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-blue-400')
                    }
                  `}
                >
                  <div className={`flex flex-col items-center justify-center pointer-events-none ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Plus size={24} className="mb-2" />
                    <span className="text-xs font-medium">Add Image</span>
                    <span className="text-[10px] mt-1">{currentImages.length}/{MAX_IMAGES}</span>
                  </div>
                </div>
              )}
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept="image/*"
              multiple
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};