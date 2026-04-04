import { chromium } from "playwright";
import { paths } from "../config/paths.mjs";
import { getLoginSession, hasSavedSession, setLoginSession } from "../storage/session-store.mjs";
import { readCurrentStoryItem } from "../parser/story-parser.mjs";

const INSTAGRAM_HOME = "https://www.instagram.com/";

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openAuthenticatedPage() {
  if (!(await hasSavedSession())) {
    throw new Error("No saved Instagram session. Log in first.");
  }

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    storageState: paths.sessionStateFile
  });

  const page = await context.newPage();
  return { browser, context, page };
}

async function clickNextStory(page) {
  const roleNames = ["Next", "Next story", "Next photo", "Next video"];

  for (const name of roleNames) {
    const button = page.getByRole("button", { name }).first();
    if (await button.count()) {
      await button.click({ timeout: 2000 });
      return true;
    }
  }

  const textButton = page.locator("button", { hasText: "Next" }).first();
  if (await textButton.count()) {
    await textButton.click({ timeout: 2000 });
    return true;
  }

  return false;
}

async function clickStoryGate(page) {
  const gateTargets = ["View story", "View Story", "View all stories"];

  for (const label of gateTargets) {
    const candidate = page.getByText(label, { exact: true }).last();
    if (await candidate.count()) {
      await candidate.click({ timeout: 5000 });
      await delay(1500);
      return true;
    }
  }

  return false;
}

async function assertLoggedIn(page) {
  const loginPrompt = page.locator('input[name="username"]').first();
  if (await loginPrompt.count()) {
    throw new Error("Saved session is no longer authenticated. Please log in again.");
  }
}

function normalizeMediaUrl(url) {
  const normalized = new URL(url);
  normalized.searchParams.delete("bytestart");
  normalized.searchParams.delete("byteend");
  return normalized.toString();
}

function parseAssetMetadata(url) {
  const parsed = new URL(url);
  const efg = parsed.searchParams.get("efg");
  let decoded = "";

  if (efg) {
    try {
      decoded = Buffer.from(efg, "base64").toString("utf8");
    } catch {
      decoded = "";
    }
  }

  const assetIdMatch = decoded.match(/"xpv_asset_id":(\d+)/);
  const variantMatch = decoded.match(/"vencode_tag":"([^"]+)"/);

  return {
    assetId: assetIdMatch?.[1] || null,
    variant: variantMatch?.[1] || null
  };
}

function createMediaCollector(page) {
  const responses = [];
  const listener = (response) => {
    const contentType = (response.headers()["content-type"] || "").toLowerCase();
    const url = response.url();

    if (!url.startsWith("https://")) {
      return;
    }

    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      return;
    }

    const metadata = parseAssetMetadata(url);
    responses.push({
      mediaType: contentType.startsWith("video/") ? "video" : "image",
      contentType,
      url,
      normalizedUrl: normalizeMediaUrl(url),
      assetId: metadata.assetId,
      variant: metadata.variant
    });
  };

  page.on("response", listener);

  return {
    count() {
      return responses.length;
    },
    latestSince(startIndex, mediaType) {
      const matches = responses
        .slice(startIndex)
        .filter((response) => response.mediaType === mediaType)
        .filter((response) => !response.url.includes("profile_pic"))
        .filter((response) => !response.url.includes("s150x150"))
        .filter((response) => !response.url.includes(".webp"));

      const targetAssetId = matches.at(-1)?.assetId || null;
      const scopedMatches = targetAssetId
        ? responses.filter((response) => response.mediaType === mediaType && response.assetId === targetAssetId)
        : matches;

      const preferredMatches = mediaType === "video"
        ? scopedMatches.filter((response) => !(response.variant || "").includes("audio"))
        : scopedMatches;

      const pool = preferredMatches.length ? preferredMatches : matches;
      const seen = new Set();

      for (let index = pool.length - 1; index >= 0; index -= 1) {
        const candidate = pool[index];
        if (seen.has(candidate.normalizedUrl)) {
          continue;
        }

        seen.add(candidate.normalizedUrl);
        return candidate;
      }

      return null;
    },
    mediaForStory(startIndex, mediaType) {
      const recent = responses
        .slice(startIndex)
        .filter((response) => response.mediaType === mediaType)
        .filter((response) => !response.url.includes("profile_pic"))
        .filter((response) => !response.url.includes("s150x150"))
        .filter((response) => !response.url.includes(".webp"));

      if (!recent.length) {
        return null;
      }

      if (mediaType !== "video") {
        const image = this.latestSince(startIndex, mediaType);
        return image ? { mediaUrl: image.normalizedUrl, audioUrl: null } : null;
      }

      const assetId = recent.at(-1)?.assetId || null;
      const scoped = assetId
        ? responses.filter((response) => response.mediaType === "video" && response.assetId === assetId)
        : recent;

      const videoCandidates = scoped
        .filter((response) => !(response.variant || "").includes("audio"));

      const audioCandidates = scoped
        .filter((response) => (response.variant || "").includes("audio"));

      const video = videoCandidates.at(-1) || this.latestSince(startIndex, mediaType);
      const audio = audioCandidates.at(-1) || null;

      if (!video) {
        return null;
      }

      return {
        mediaUrl: video.normalizedUrl,
        audioUrl: audio?.normalizedUrl || null
      };
    },
    detach() {
      page.off("response", listener);
    }
  };
}

export async function startInteractiveLogin() {
  const existing = getLoginSession();
  if (existing?.browser?.isConnected()) {
    return { alreadyOpen: true };
  }

  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(INSTAGRAM_HOME, { waitUntil: "domcontentloaded" });

  setLoginSession({ browser, context, page });

  return { alreadyOpen: false };
}

export async function completeInteractiveLogin() {
  const current = getLoginSession();
  if (!current?.browser?.isConnected()) {
    throw new Error("No active login window. Start login first.");
  }

  await current.page.goto(INSTAGRAM_HOME, { waitUntil: "domcontentloaded" });
  await current.context.storageState({ path: paths.sessionStateFile });
  await current.browser.close();
  setLoginSession(null);

  return { saved: true };
}

export async function fetchStoriesForUsername(username) {
  const normalizedUsername = username.trim().replace(/^@/, "");
  if (!normalizedUsername) {
    throw new Error("Username is required.");
  }

  const { browser, context, page } = await openAuthenticatedPage();
  const mediaCollector = createMediaCollector(page);

  try {
    await page.goto(`https://www.instagram.com/stories/${normalizedUsername}/`, {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });

    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await assertLoggedIn(page);
    await clickStoryGate(page);

    const unavailableText = await page.locator("text=This story is unavailable").count();
    const noStoriesText = await page.locator("text=Story unavailable").count();
    if (unavailableText || noStoriesText) {
      throw new Error(`No active story is available for @${normalizedUsername}.`);
    }

    const items = [];
    const seenUrls = new Set();
    let mediaCursor = 0;

    for (let index = 1; index <= 20; index += 1) {
      await delay(1800);
      const item = await readCurrentStoryItem(page, index);
      const effectiveType = item?.mediaType || "image";
      const recentMedia = mediaCollector.latestSince(mediaCursor, effectiveType);
      const storyMedia = mediaCollector.mediaForStory(mediaCursor, effectiveType);
      mediaCursor = mediaCollector.count();

      const resolvedItem = item ? {
        ...item,
        mediaUrl: storyMedia?.mediaUrl || recentMedia?.normalizedUrl || item.mediaUrl,
        audioUrl: storyMedia?.audioUrl || null,
        previewUrl: item.previewUrl?.startsWith("blob:") ? storyMedia?.mediaUrl || recentMedia?.normalizedUrl || item.previewUrl : item.previewUrl
      } : recentMedia ? {
        id: `story-${index}`,
        itemIndex: index,
        mediaType: recentMedia.mediaType,
        mediaUrl: storyMedia?.mediaUrl || recentMedia.normalizedUrl,
        audioUrl: storyMedia?.audioUrl || null,
        previewUrl: storyMedia?.mediaUrl || recentMedia.normalizedUrl,
        postedAt: null,
        postedLabel: "Unknown time"
      } : null;

      if (!resolvedItem?.mediaUrl) {
        break;
      }

      if (seenUrls.has(resolvedItem.mediaUrl)) {
        break;
      }

      seenUrls.add(resolvedItem.mediaUrl);
      items.push(resolvedItem);

      const advanced = await clickNextStory(page);
      if (!advanced) {
        break;
      }
    }

    if (!items.length) {
      throw new Error(`Couldn't extract any active stories for @${normalizedUsername}.`);
    }

    return {
      username: normalizedUsername,
      fetchedAt: new Date().toISOString(),
      items
    };
  } finally {
    mediaCollector.detach();
    await context.close();
    await browser.close();
  }
}
