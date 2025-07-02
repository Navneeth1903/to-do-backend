import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    // Temporarily disable HMR to prevent auto-refresh issues
    hmr: false,
    allowedHosts: undefined,
  };

  const vite = await createViteServer({
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // For separate frontend/backend deployment, we don't serve static files
  // The frontend will be deployed separately and will make API calls to this backend
  log("Running in production mode - static file serving disabled for separate deployment");
  
  // Add a simple health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", message: "Backend API is running" });
  });

  // For any non-API routes, return a message indicating this is the backend
  app.use("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ message: "API endpoint not found" });
    } else {
      res.status(404).json({ 
        message: "This is the backend API server. Please use the frontend application to access the task tracker.",
        apiBase: "/api"
      });
    }
  });
}
