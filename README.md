# Text Extractor (OCR)

1. `cd server && npm install && cp .env.example .env` (add your Groq API key to `.env`)
2. `npm start` (port 5002)
3. New terminal: `cd client && npm install && npm run dev`
4. Open the URL Vite prints (usually http://localhost:5173)

If you get a "model not found" error, check the current vision model ID at
console.groq.com/docs/vision and set VISION_MODEL in server/.env.
