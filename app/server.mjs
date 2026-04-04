import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";
import { paths } from "./config/paths.mjs";
import { startInteractiveLogin, completeInteractiveLogin, fetchStoriesForUsername } from "./automation/instagram.mjs";
import { downloadSelectedStories } from "./downloader/story-downloader.mjs";
import { clearSavedSession, ensureAppDirectories, hasSavedSession } from "./storage/session-store.mjs";

const port = Number(process.env.PORT || 4318);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  response.end(payload);
}

async function readJsonBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
  }

  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

async function serveStaticFile(response, filePath) {
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(paths.uiDir)) {
    throw new Error("Not found");
  }

  const content = await fs.readFile(normalized);
  const extension = path.extname(normalized);
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
  }[extension] || "application/octet-stream";

  sendText(response, 200, content, contentType);
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/session/status") {
    return sendJson(response, 200, { hasSession: await hasSavedSession() });
  }

  if (request.method === "POST" && url.pathname === "/api/session/login") {
    const result = await startInteractiveLogin();
    return sendJson(response, 200, result);
  }

  if (request.method === "POST" && url.pathname === "/api/session/complete") {
    const result = await completeInteractiveLogin();
    return sendJson(response, 200, result);
  }

  if (request.method === "DELETE" && url.pathname === "/api/session") {
    await clearSavedSession();
    return sendJson(response, 200, { cleared: true });
  }

  if (request.method === "POST" && url.pathname === "/api/stories/fetch") {
    const body = await readJsonBody(request);
    const result = await fetchStoriesForUsername(body.username || "");
    return sendJson(response, 200, result);
  }

  if (request.method === "POST" && url.pathname === "/api/stories/download") {
    const body = await readJsonBody(request);
    const username = body.username || "";
    const selectedStories = Array.isArray(body.items) ? body.items : [];

    if (!selectedStories.length) {
      return sendJson(response, 400, { error: "Choose at least one story item to download." });
    }

    const result = await downloadSelectedStories(username, selectedStories);
    return sendJson(response, 200, result);
  }

  return sendJson(response, 404, { error: "Not found" });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    const filePath = url.pathname === "/"
      ? path.join(paths.uiDir, "index.html")
      : path.join(paths.uiDir, url.pathname);

    await serveStaticFile(response, filePath);
  } catch (error) {
    const statusCode = url.pathname.startsWith("/api/") ? 500 : 404;
    const message = error instanceof Error ? error.message : "Unknown error";

    if (url.pathname.startsWith("/api/")) {
      sendJson(response, statusCode, { error: message });
      return;
    }

    sendText(response, statusCode, message);
  }
});

await ensureAppDirectories();

server.listen(port, () => {
  console.log(`Local story saver running at http://localhost:${port}`);
});
