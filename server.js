import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies. Increased limit for base64 images.
app.use(express.json({ limit: '50mb' }));

// Initialize Gemini Client (Server-side only)
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key is missing in environment variables.");
    throw new Error("API Key is missing on server.");
  }
  return new GoogleGenAI({ apiKey });
};

// Serve static files from the build directory (usually 'dist' in Vite)
app.use(express.static(path.join(__dirname, 'dist')));

// API Endpoint: Analyze Architecture
app.post('/api/analyze', async (req, res) => {
  try {
    const { images } = req.body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }

    const ai = getAiClient();
    
    const imageParts = images.map(img => {
      // Remove data URL prefix if present to get clean base64
      const cleanBase64 = img.includes('base64,') ? img.split('base64,')[1] : img;
      const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      const mimeType = match ? match[1] : 'image/jpeg';
      return { inlineData: { mimeType, data: cleanBase64 } };
    });

    const prompt = `
      Role: Bạn là một chuyên gia AI về hình ảnh kiến trúc và nhiếp ảnh chuyên nghiệp.
      Task: Phân tích chi tiết các hình ảnh được cung cấp để hiểu sâu về: 
      1. Cấu trúc nhà (Structure & Geometry)
      2. Vật liệu chi tiết (Materials - màu sơn, loại đá, gỗ, kính)
      3. Hệ thống cây xanh (Greenery - loại cây cụ thể như hoa giấy, trúc, cỏ)
      4. Phong cách thiết kế (Architectural Style)
      5. Ánh sáng và Bối cảnh (Lighting & Context - ví dụ: đường phố Việt Nam)

      Output Format: Trả về kết quả dưới dạng JSON object với 2 trường:
      - 'english': Phân tích chi tiết bằng tiếng Anh (dùng để làm prompt sinh ảnh).
      - 'vietnamese': Phân tích chi tiết bằng tiếng Việt (dùng để hiển thị cho người dùng đọc).
      
      Nội dung phân tích cần tập trung vào các chi tiết vật lý có thể nhìn thấy được để đảm bảo sự đồng bộ nhất quán (Consistency).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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

    // FIX: use response.text property, not function call
    const text = response.text;
    if (!text) {
      throw new Error("Empty response from analysis model");
    }
    const jsonResult = JSON.parse(text);
    res.json(jsonResult);

  } catch (error) {
    console.error("Analysis API Error:", error);
    res.status(500).json({ error: "Failed to analyze architectural style." });
  }
});

// API Endpoint: Generate View
app.post('/api/generate', async (req, res) => {
  try {
    const { images, prompt, resolution, aspectRatio, analysisContext, customPrompt } = req.body;

    if (!images || !prompt) {
      return res.status(400).json({ error: "Missing images or prompt" });
    }

    const ai = getAiClient();

    // Construct image parts
    const imageParts = images.map(img => {
      const cleanBase64 = img.includes('base64,') ? img.split('base64,')[1] : img;
      const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      const mimeType = match ? match[1] : 'image/jpeg';
      return { inlineData: { mimeType, data: cleanBase64 } };
    });

    // Model selection
    const isHighRes = resolution === '2K' || resolution === '4K';
    const model = isHighRes ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

    const config = {
      imageConfig: {
        ...(isHighRes ? { imageSize: resolution } : {}),
        aspectRatio: aspectRatio || '1:1'
      }
    };

    // Construct Final Prompt
    let finalPrompt = prompt;
    if (customPrompt && customPrompt.trim().length > 0) {
      finalPrompt += `\n\nADDITIONAL INSTRUCTIONS: ${customPrompt}`;
    }

    if (analysisContext) {
      finalPrompt = `
        ARCHITECTURAL DNA ANALYSIS:
        ${analysisContext}
        
        BASED ON THE ARCHITECTURAL ANALYSIS ABOVE AND THE REFERENCE IMAGES:
        ${finalPrompt}
        
        CRITICAL INSTRUCTION: Ensure the generated image is perfectly consistent with the analyzed materials, plants, and architectural style described above.
      `;
    }

    const response = await ai.models.generateContent({
      model: model,
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
          return res.json({ imageUrl: `data:image/png;base64,${part.inlineData.data}` });
        }
      }
    }

    // Capture text reason if image generation failed (e.g. safety refusal)
    const textOutput = response.text;
    console.warn("Image generation returned no image data. Text response:", textOutput);
    
    // Provide a more helpful error message
    const errorMessage = textOutput ? `AI Model Message: ${textOutput}` : "No image data received from Gemini API.";
    throw new Error(errorMessage);

  } catch (error) {
    console.error("Generation API Error:", error);
    // Return the actual error message to the client for debugging
    res.status(500).json({ error: error.message || "Failed to generate image." });
  }
});

// Catch-all handler for any request that doesn't match the above API routes
// Returns index.html so React Router works (if used)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});