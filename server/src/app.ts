import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import { formsRouter } from "./routes/forms";

export function createApp(): Express {
  const app = express();

  // FRONTEND_URL can be a single origin or a comma-separated list
  // (e.g. "https://your-app.web.app,https://your-app.firebaseapp.com").
  // Falls back to allowing all origins if unset, so things work out of
  // the box before you've deployed the frontend - tighten this once you
  // have your Firebase Hosting URL.
  const allowedOrigins = process.env.FRONTEND_URL?.split(",").map((o) =>
    o.trim()
  );

  app.use(
    cors(
      allowedOrigins
        ? { origin: allowedOrigins }
        : { origin: true } // reflect any origin (dev-friendly default)
    )
  );
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.use("/", formsRouter);

  // 404 fallback
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "NotFound", message: "Route not found" });
  });

  return app;
}
