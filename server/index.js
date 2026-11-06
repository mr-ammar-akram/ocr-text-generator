import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import Groq from "groq-sdk";

const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.VISION_MODEL || "qwen/qwen3.6-27b";
const PROMPT = "Extract all visible text from this image. Return only the text, nothing else.";
const WANT_JSON = false;

app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    const b64 = req.file.buffer.toString("base64");
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${req.file.mimetype};base64,${b64}` } },
          ],
        },
      ],
      ...(WANT_JSON && { response_format: { type: "json_object" } }),
    });
    let text = (completion.choices[0].message.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    let result = text;
    if (WANT_JSON) {
      try { result = JSON.parse(text); } catch { /* keep raw text */ }
    }
    res.json({ result });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Something went wrong" });
  }
});

app.listen(process.env.PORT || 5002, () => console.log("Server running on 5002"));
