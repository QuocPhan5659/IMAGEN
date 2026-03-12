import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose }) => {
  // Handle space key to close
  useEffect(() => {
    if (!imageUrl) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onClose();
      }
      // Also handle Escape as per standard accessibility
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `archiview-large.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div className="relative max-w-7xl max-h-screen w-full flex flex-col items-center justify-center cursor-default">
        
        <div 
          className="absolute top-0 right-0 p-4 flex gap-4 z-10"
          onClick={(e) => e.stopPropagation()}
        >
           <button 
            onClick={handleDownload}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
            title="Download"
          >
            <Download size={24} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
            title="Close (Space or Esc)"
          >
            <X size={24} />
          </button>
        </div>

        <img 
          src={imageUrl} 
          alt="Full View" 
          className="max-h-[90vh] max-w-full object-contain rounded shadow-2xl select-none"
          onClick={(e) => e.stopPropagation()}
        />
        
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs pointer-events-none">
          Press SPACE to close
        </div>
      </div>
    </div>
  );
};