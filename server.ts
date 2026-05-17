import express from "express";
import path from "path";
import { Readable } from "stream";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());

  // Gemini API Proxy
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, agentName } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `你现在是 ${agentName}，是一个创意工作室团队中的 AI 代理。
      请以你的人设风格回应以下消息。请务必使用中文回答。
      
      消息内容: "${message}"`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });

      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate response" });
    }
  });

  app.use("/api", async (req, res) => {
    const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:8080";
    const targetUrl = new URL(req.originalUrl, backendBaseUrl);
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      if (
        !value ||
        lowerKey === "host" ||
        lowerKey === "content-length" ||
        lowerKey === "expect" ||
        lowerKey === "origin" ||
        lowerKey === "referer"
      ) {
        continue;
      }
      headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }

    try {
      const hasRequestBody = req.method !== "GET" && req.method !== "HEAD";
      const contentType = String(req.headers["content-type"] || "").toLowerCase();
      const isJsonRequest = contentType.includes("application/json");
      const upstreamOptions: RequestInit & { duplex?: "half" } = {
        method: req.method,
        headers,
      };
      if (hasRequestBody) {
        if (isJsonRequest) {
          upstreamOptions.body = JSON.stringify(req.body ?? {});
        } else {
          upstreamOptions.body = req as any;
          upstreamOptions.duplex = "half";
        }
      }

      const upstream = await fetch(targetUrl, upstreamOptions);

      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (!upstream.body) {
        res.end();
        return;
      }

      Readable.fromWeb(upstream.body as any).pipe(res);
    } catch (error: any) {
      res.status(502).json({
        success: false,
        message: `Backend proxy failed: ${error.message || "unknown error"}`,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
