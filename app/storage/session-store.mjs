import fs from "node:fs/promises";
import { paths } from "../config/paths.mjs";

let loginSession = null;

export async function ensureAppDirectories() {
  await Promise.all([
    fs.mkdir(paths.sessionsDir, { recursive: true }),
    fs.mkdir(paths.downloadsDir, { recursive: true }),
    fs.mkdir(paths.logsDir, { recursive: true })
  ]);
}

export async function hasSavedSession() {
  try {
    await fs.access(paths.sessionStateFile);
    return true;
  } catch {
    return false;
  }
}

export function getLoginSession() {
  return loginSession;
}

export function setLoginSession(session) {
  loginSession = session;
}

export async function clearSavedSession() {
  if (loginSession?.browser?.isConnected()) {
    await loginSession.browser.close();
  }

  loginSession = null;

  try {
    await fs.rm(paths.sessionStateFile);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}
