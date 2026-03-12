import { GoogleGenAI, Type } from "@google/genai";
import { Resolution, AspectRatio, ModelType } from "../types";

const getAiClient = (providedApiKey?: string) => {
  // Priority: 1. User-provided key, 2. Platform-selected key (API_KEY), 3. Platform default key (GEMINI_API_KEY)
  const apiKey = providedApiKey || 
                 (typeof process !== 'undefined' ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : undefined) ||
                 (typeof window !== 'undefined' && ((window as any).process?.env?.API_KEY || (window as any).process?.env?.GEMINI_API_KEY));
  
  if (!apiKey) {
    console.error("API Key not found");
    throw new Error("API Key is missing. Please click the API Key button to configure it.");
  }
  return new GoogleGenAI({ apiKey });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface ArchitecturalAnalysis {
  english: string;
  vietnamese: string;
}

/**
 * Analyzes the provided architectural images to create a detailed description
 * of style, materials, and greenery to ensure consistency.
 */
export const analyzeArchitecturalStyle = async (base64Images: string[], apiKey?: string): Promise<ArchitecturalAnalysis> => {
  const ai = getAiClient(apiKey);
  
  const imageParts = base64Images.map(img => {
    // Handle both raw base64 and data URL formats
    const cleanBase64 = img.includes('base64,') ? img.split('base64,')[1] : img;
    const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    const mimeType = match ? match[1] : 'image/jpeg';
    return { inlineData: { mimeType, data: cleanBase64 } };
  });

  const prompt = `
    Role: You are a Lead Architectural AI Specialist.
    
    CRITICAL RULE: MULTI-IMAGE SYNTHESIS & OBJECT UNITY
    1. Treat ALL uploaded images as DIFFERENT ANGLES of the SAME SINGLE ARCHITECTURAL OBJECT.
    2. Do NOT treat them as separate buildings. They are puzzle pieces of ONE house/building.
    3. SYNTHESIS TASK: Combine data from all images to create a comprehensive "Material & Structural Map".
       - Example: If Image 1 shows a stone facade and Image 2 shows a wooden side window, the final mental model MUST have BOTH a stone facade and wooden side windows.
    4. You must infer the spatial relationship between the images (e.g., "This is the front," "This is the left side").
    
    Task: Analyze the synthesized building to generate a Unified Architectural DNA:
    1. Structure & Geometry (Massing, roof shape, floor heights - consistent across all views).
    2. Unified Material Palette (Specific stone types, wood colors, glass transparency - merged from all angles).
    3. Greenery System (Location of planters, vines, specific plant types observed in ANY image).
    4. Architectural Style (The single defining style of this building).
    5. Context & Lighting (The surrounding atmosphere).
    6. Output Format: JSON object with 2 fields:
    - 'english': Detailed technical description for image generation prompts. Explicitly state: "This building features [Details from Img 1] on the front and [Details from Img 2] on the side..."
    - 'vietnamese': Detailed analysis for the user (Tiếng Việt).

    Constraint: Absolutely DO NOT omit specific distinct details found in any reference image. If a detail exists in one photo, it belongs to the building.
  `;

  try {
    // Using gemini-1.5-flash-latest for analysis as it's more stable across key tiers
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash-latest',
      contents: {
        parts: [
          { text: prompt },
          ...imageParts
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            vietnamese: { type: Type.STRING }
          },
          required: ['english', 'vietnamese']
        }
      }
    });
    
    const text = response.text;
    if (!text) {
      return { english: "Analysis failed.", vietnamese: "Phân tích thất bại." };
    }
    return JSON.parse(text);
  } catch (error) {
    console.error("Analysis failed", error);
    throw new Error("Failed to analyze architectural style.");
  }
};

export const generateArchitecturalView = async (
  base64Images: string[],
  prompt: string,
  resolution: Resolution = '1K',
  aspectRatio: AspectRatio = '1:1',
  analysisContext?: string,
  customPrompt?: string,
  useMasterLighting: boolean = false,
  apiKey?: string,
  selectedModel?: ModelType
): Promise<string> => {
  const ai = getAiClient(apiKey);
  
  // Construct image parts for the API
  const imageParts = base64Images.map(img => {
    const cleanBase64 = img.includes('base64,') ? img.split('base64,')[1] : img;
    const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    const mimeType = match ? match[1] : 'image/jpeg';

    return {
      inlineData: {
        mimeType: mimeType,
        data: cleanBase64,
      },
    };
  });

  // Handle Random Aspect Ratio
  let finalAspectRatio = aspectRatio;
  let randomAngleInstruction = "";
  if (aspectRatio === 'random') {
    const ratios: AspectRatio[] = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'];
    finalAspectRatio = ratios[Math.floor(Math.random() * ratios.length)];
    randomAngleInstruction = "\n\nRANDOM OUTPUT MODE: Choose a random, unique, and artistic architectural camera angle (e.g., extreme low angle, high oblique, or unique perspective) that differs from the standard reference view. IMPORTANT: You must strictly maintain all structural details, geometry, and materials without any distortion or redesign.";
  }

  // Determine model and config based on resolution or user selection
  const isHighRes = resolution === '2K' || resolution === '4K';
  let model = selectedModel || (isHighRes ? '3.1' : '2.5');
  
  // Map aliases to actual model names
  let actualModel = 'gemini-2.5-flash-image';
  if (model === '3.1' || model === 'fast') actualModel = 'gemini-3.1-flash-image-preview';
  if (model === '3.2') actualModel = 'gemini-3.2-flash-image-preview';
  if (model === 'pro') actualModel = 'gemini-3-pro-image-preview';
  if (model === '2.5' || model === 'banana-free') actualModel = 'gemini-2.5-flash-image';

  // Configuration for the model
  const config: any = {
    imageConfig: {
      aspectRatio: finalAspectRatio
    }
  };

  // Only certain models support imageSize
  if (actualModel === 'gemini-3.2-flash-image-preview' || actualModel === 'gemini-3.1-flash-image-preview' || actualModel === 'gemini-3-pro-image-preview') {
    if (isHighRes) {
      config.imageConfig.imageSize = resolution;
    }
  }

  // ... (rest of the code should use actualModel instead of model for the API call)

  // Enhance the prompt with the analysis context if available
  let finalPrompt = prompt;
  
  // Append custom user prompt instructions if provided
  if (customPrompt && customPrompt.trim().length > 0) {
    finalPrompt += `\n\nADDITIONAL INSTRUCTIONS: ${customPrompt}`;
  }

  // Master Lighting Logic
  if (useMasterLighting) {
    finalPrompt += `\n\nLIGHTING CONSTRAINT: STRICTLY MATCH the lighting, time of day, and atmospheric conditions of the reference image(s). Do not change the mood (e.g. if reference is night, output must be night).`;
  }

  // Inject Synthesis Logic into Generation
  finalPrompt = `
    SYSTEM INSTRUCTION: MULTI-IMAGE CONSISTENCY MODE
    - You are viewing the SAME building from different angles (the attached reference images).
    - You must reconstruct the 3D logic of this single building in your mind.
    - If generating a side view, include details seen in the side-angle references.
    - If generating a front view, include details seen in the front-angle references.
    - Ensure material continuity: The wood/stone/paint colors must be identical to the references.
    
    STRICT ARCHITECTURAL CONSTRAINTS:
    - KEEP THE GEOMETRY REALISTIC AND BELIEVABLE.
    - DO NOT REDESIGN THE BUILDING. Maintain the exact structural proportions, materials, and architectural style of the provided reference image(s).
    - NO DISTORTION: Details must not be warped, skewed, or altered from the original upload.
    - AVOID EXAGGERATED PERSPECTIVES unless specifically requested. Use professional, realistic architectural photography principles.
    - Ensure material continuity: The wood/stone/paint colors must be identical to the references.
    ${randomAngleInstruction}
    
    ${analysisContext ? `
    UNIFIED ARCHITECTURAL DNA (SYNTHESIZED FROM ALL ANGLES):
    ${analysisContext}
    ` : ''}
    
    TASK PROMPT:
    ${finalPrompt}
    
    STRICT CONSTRAINT: The result must look like it belongs to the exact same project as the reference images. Correct vertical perspective. No hallucinations of non-existent styles. No structural modifications.
    UNIQUE_ID: ${Math.random().toString(36).substring(7)}
  `;

  let attempt = 0;
  const maxRetries = 5; // Increased retries
  let lastError: any;

  while (attempt <= maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: actualModel,
        contents: {
          parts: [
            { text: finalPrompt },
            ...imageParts
          ],
        },
        config: config
      });

      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
        const parts = candidates[0].content.parts;
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
      
      const textOutput = response.text;
      if (textOutput) {
         console.warn("Model returned text instead of image:", textOutput);
      }

      throw new Error("No image data received from Gemini API.");
    } catch (error: any) {
      lastError = error;
      
      const errorCode = error.status || error.code || (error.error && error.error.code);
      const errorMessage = error.message || JSON.stringify(error);
      const isRateLimit = errorCode === 429 || errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED');
      const isServerOverload = errorCode === 503 || errorMessage.includes('503');
      const isPermissionDenied = errorCode === 403 || errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED');

      if (isPermissionDenied) {
        throw new Error(`Permission Denied (403): The selected model "${model}" likely requires a Paid API Key or specific permissions. Please check your API key tier in Google AI Studio or switch to a free model.`);
      }

      if ((isRateLimit || isServerOverload) && attempt < maxRetries) {
        attempt++;
        // For rate limits, use a more aggressive backoff
        const baseDelay = isRateLimit ? 5000 : 2000;
        const delay = baseDelay * Math.pow(2, attempt - 1); 
        console.warn(`Gemini API Error (${errorCode}). Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
        await wait(delay);
        continue;
      }
      break;
    }
  }

  console.error("Gemini API Error after retries:", lastError);
  throw lastError;
};
