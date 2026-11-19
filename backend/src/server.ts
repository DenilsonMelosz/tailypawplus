import express from "express";
import cors from "cors";
import { initDb } from "./db.js";
import { runLifecycle } from "./services.js";
import { errorHandler } from "./util.js";
import auth, { me } from "./routes/auth.js";
import alerts from "./routes/alerts.js";
import { images, pets, tags } from "./routes/pets.js";
import { conversations, notifications } from "./routes/social.js";
import users from "./routes/users.js";

export async function createApp() {
  await initDb();
  const app = express();
  app.set("trust proxy", 1);
  const origins = (process.env.CORS_ORIGIN ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true, name: "TailyPaw+ API" }));
  // RN05/RN06 aplicadas a cada requisicao (com intervalo minimo) e por um relogio.
  app.use("/api", (_req, _res, next) => { runLifecycle().catch(console.error).finally(() => next()); });

  app.use("/api/auth", auth);
  app.use("/api/me", me);
  app.use("/api/alerts", alerts);
  app.use("/api/images", images);
  app.use("/api/pets", pets);
  app.use("/api/tags", tags);
  app.use("/api/notifications", notifications);
  app.use("/api/conversations", conversations);
  app.use("/api/users", users);
  app.use("/api", (_req, res) => res.status(404).json({ message: "Rota não encontrada." }));
  app.use(errorHandler);
  return app;
}

const isMain = process.argv[1] && /server\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  const port = Number(process.env.PORT ?? 3333);
  createApp().then((app) => {
    app.listen(port, () => console.log(`TailyPaw+ API em http://localhost:${port}`));
    setInterval(() => runLifecycle(true).catch(console.error), 60_000);
  });
}
