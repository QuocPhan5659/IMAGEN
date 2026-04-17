import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser with high limit for images
  app.use(express.json({ limit: '50mb' }));

  // API Endpoint: Proxied AI Calls
  app.post('/api/ai', async (req, res) => {
    try {
      const { prompt, contents, model, config, apiKey: userKey } = req.body;

      const apiKey = userKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "Missing Gemini API Key." });
      }

      const genAI = new GoogleGenAI({ apiKey });
      
      const result = await genAI.models.generateContent({
        model: model || 'gemini-3-flash-preview',
        contents: { parts: contents },
        config: config || {}
      });

      const response = result;
      const candidates = response.candidates;
      
      let imageUrl = null;
      let text = "";

      try {
          text = response.text;
      } catch (e) {
          // No text found, might be a pure image response
      }

      if (candidates && candidates[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
              if (part.inlineData) {
                  imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              }
          }
      }

      res.json({ text, imageUrl });
    } catch (error: any) {
      console.error("[AI Error]", error);
      res.status(500).json({ 
        error: error.message || "Internal AI Processing Error",
        details: error.toString()
      });
    }
  });

  // Vite Middleware integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: Serve static files from 'dist'
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> COMMAND CENTER ONLINE: http://localhost:${PORT}`);
    console.log(`>>> Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(console.error);
