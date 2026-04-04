import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

export const paths = {
  rootDir,
  uiDir: path.join(rootDir, "app", "ui"),
  sessionsDir: path.join(rootDir, "sessions"),
  downloadsDir: path.join(rootDir, "downloads"),
  logsDir: path.join(rootDir, "logs"),
  sessionStateFile: path.join(rootDir, "sessions", "instagram-state.json")
};
