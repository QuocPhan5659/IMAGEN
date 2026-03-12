
export interface ViewDefinition {
  id: number;
  titleVI: string;
  titleEN: string;
  description: string;
  prompt: string;
  isCustom?: boolean;
}

export interface GeneratedImage {
  id: number;
  status: 'idle' | 'loading' | 'success' | 'error';
  imageUrl?: string;
  error?: string;
}

export type Resolution = '1K' | '2K' | '4K';

export type ModelType = 
  | '2.5'
  | '3.1'
  | '3.2'
  | 'banana-free'
  | 'fast'
  | 'pro';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | 'random';

export type GenerationState = Record<number, GeneratedImage>;
