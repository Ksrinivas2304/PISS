function normalizeStoryMedia({ itemIndex, mediaType, mediaUrl, previewUrl, postedAt, postedLabel }) {
  return {
    id: `story-${itemIndex}`,
    itemIndex,
    mediaType,
    mediaUrl,
    previewUrl: previewUrl || mediaUrl,
    postedAt: postedAt || null,
    postedLabel: postedLabel || "Unknown time"
  };
}

export async function readCurrentStoryItem(page, itemIndex) {
  const story = await page.evaluate(({ itemIndex }) => {
    const abs = (value) => {
      if (!value) {
        return null;
      }

      try {
        return new URL(value, window.location.href).toString();
      } catch {
        return value || null;
      }
    };

    const timeNode = document.querySelector("time");
    const postedAt = timeNode?.getAttribute("datetime") || null;
    const postedLabel = timeNode?.textContent?.trim() || null;

    const video = document.querySelector("video");
    if (video?.currentSrc) {
      const poster = video.getAttribute("poster");
      return {
        itemIndex,
        mediaType: "video",
        mediaUrl: abs(video.currentSrc),
        previewUrl: abs(poster),
        postedAt,
        postedLabel
      };
    }

    const candidates = Array.from(document.images)
      .map((img) => ({
        src: img.currentSrc || img.src,
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
        area: (img.naturalWidth || 0) * (img.naturalHeight || 0),
        alt: (img.alt || "").toLowerCase()
      }))
      .filter((img) => img.src && img.width >= 250 && img.height >= 250)
      .filter((img) => !img.src.includes("profile_pic"))
      .sort((left, right) => right.area - left.area);

    if (!candidates.length) {
      return null;
    }

    const bestImage = candidates[0];

    return {
      itemIndex,
      mediaType: "image",
      mediaUrl: abs(bestImage.src),
      previewUrl: abs(bestImage.src),
      postedAt,
      postedLabel
    };
  }, { itemIndex });

  if (!story?.mediaUrl) {
    return null;
  }

  return normalizeStoryMedia(story);
}
