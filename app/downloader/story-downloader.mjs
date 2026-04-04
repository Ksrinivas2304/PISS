import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { paths } from "../config/paths.mjs";

function padIndex(index) {
  return String(index).padStart(2, "0");
}

function inferExtension(contentType, mediaType, mediaUrl) {
  if (contentType?.includes("mp4")) {
    return "mp4";
  }

  if (contentType?.includes("png")) {
    return "png";
  }

  if (contentType?.includes("webp")) {
    return "webp";
  }

  if (mediaType === "video") {
    return "mp4";
  }

  const match = mediaUrl.match(/\.([a-z0-9]{3,4})(?:\?|$)/i);
  return match?.[1]?.toLowerCase() || "jpg";
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

async function hasFfmpeg() {
  try {
    await runCommand("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function downloadBinary(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  return {
    contentType: response.headers.get("content-type"),
    buffer: Buffer.from(await response.arrayBuffer())
  };
}

async function mergeVideoAndAudio({ videoUrl, audioUrl, outputPath }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "story-merge-"));
  const videoPath = path.join(tempDir, "video.mp4");
  const audioPath = path.join(tempDir, "audio.mp4");

  try {
    const [video, audio] = await Promise.all([
      downloadBinary(videoUrl),
      downloadBinary(audioUrl)
    ]);

    await fs.writeFile(videoPath, video.buffer);
    await fs.writeFile(audioPath, audio.buffer);
    await runCommand("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-i", audioPath,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c", "copy",
      "-shortest",
      outputPath
    ]);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function downloadSelectedStories(username, selectedStories) {
  const today = new Date().toISOString().slice(0, 10);
  const targetDir = path.join(paths.downloadsDir, username, today);
  await fs.mkdir(targetDir, { recursive: true });

  const results = [];
  const ffmpegReady = await hasFfmpeg();

  for (const story of selectedStories) {
    const extension = inferExtension(null, story.mediaType, story.mediaUrl);
    const fileName = `${username}_${today}_${padIndex(story.itemIndex)}_${story.mediaType}.${extension}`;
    const filePath = path.join(targetDir, fileName);

    if (story.mediaType === "video" && story.audioUrl) {
      if (!ffmpegReady) {
        throw new Error("This story needs audio+video merging. Install ffmpeg first, then retry the download.");
      }

      await mergeVideoAndAudio({
        videoUrl: story.mediaUrl,
        audioUrl: story.audioUrl,
        outputPath: filePath
      });
    } else {
      const response = await fetch(story.mediaUrl);
      if (!response.ok) {
        throw new Error(`Download failed for item ${story.itemIndex}: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    }

    results.push({
      itemIndex: story.itemIndex,
      fileName,
      filePath
    });
  }

  return {
    directory: targetDir,
    files: results
  };
}
