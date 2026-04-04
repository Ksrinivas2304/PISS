const state = {
  username: "",
  stories: []
};

const elements = {
  sessionBadge: document.querySelector("#sessionBadge"),
  statusLog: document.querySelector("#statusLog"),
  storyGrid: document.querySelector("#storyGrid"),
  downloadButton: document.querySelector("#downloadButton"),
  usernameInput: document.querySelector("#usernameInput"),
  startLoginButton: document.querySelector("#startLoginButton"),
  saveSessionButton: document.querySelector("#saveSessionButton"),
  clearSessionButton: document.querySelector("#clearSessionButton"),
  fetchForm: document.querySelector("#fetchForm"),
  selectLatestButton: document.querySelector("#selectLatestButton"),
  selectVideosButton: document.querySelector("#selectVideosButton"),
  selectImagesButton: document.querySelector("#selectImagesButton"),
  clearSelectionButton: document.querySelector("#clearSelectionButton")
};

function appendLog(message) {
  elements.statusLog.textContent = `${new Date().toLocaleTimeString()}\n${message}\n\n${elements.statusLog.textContent}`.trim();
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json"
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
}

function selectedStories() {
  return state.stories.filter((story) => story.selected);
}

function updateDownloadButton() {
  elements.downloadButton.disabled = selectedStories().length === 0;
}

function renderStories() {
  if (!state.stories.length) {
    elements.storyGrid.className = "story-grid empty-state";
    elements.storyGrid.textContent = "No stories fetched yet.";
    updateDownloadButton();
    return;
  }

  elements.storyGrid.className = "story-grid";
  elements.storyGrid.innerHTML = state.stories.map((story) => {
    const media = story.mediaType === "video"
      ? `<video src="${story.previewUrl || story.mediaUrl}" muted playsinline preload="metadata" controls></video>`
      : `<img src="${story.previewUrl || story.mediaUrl}" alt="Story item ${story.itemIndex}" loading="lazy" />`;

    return `
      <article class="story-card">
        <figure>${media}</figure>
        <div class="story-card-body">
          <div class="story-card-head">
            <strong>Item ${story.itemIndex}</strong>
            <span>${story.mediaType}</span>
          </div>
          <p class="story-meta">${story.postedLabel || "Unknown time"}</p>
          <p class="story-meta">${new URL(story.mediaUrl).hostname}</p>
          <label class="story-toggle">
            <input type="checkbox" data-story-id="${story.id}" ${story.selected ? "checked" : ""} />
            Select for download
          </label>
        </div>
      </article>
    `;
  }).join("");

  elements.storyGrid.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const story = state.stories.find((item) => item.id === event.target.dataset.storyId);
      if (story) {
        story.selected = event.target.checked;
        updateDownloadButton();
      }
    });
  });

  updateDownloadButton();
}

async function refreshSessionStatus() {
  const data = await request("/api/session/status", { method: "GET" });
  elements.sessionBadge.textContent = data.hasSession ? "Session saved" : "No session";
  elements.sessionBadge.classList.toggle("warning", !data.hasSession);
}

function applySelector(predicate) {
  state.stories.forEach((story) => {
    story.selected = predicate(story);
  });
  renderStories();
}

elements.startLoginButton.addEventListener("click", async () => {
  try {
    await request("/api/session/login", { method: "POST" });
    appendLog("Instagram opened in a browser window. Log in there, then click Save Session here.");
  } catch (error) {
    appendLog(error.message);
  }
});

elements.saveSessionButton.addEventListener("click", async () => {
  try {
    await request("/api/session/complete", { method: "POST" });
    appendLog("Session state saved locally in the sessions folder.");
    await refreshSessionStatus();
  } catch (error) {
    appendLog(error.message);
  }
});

elements.clearSessionButton.addEventListener("click", async () => {
  try {
    await request("/api/session", { method: "DELETE" });
    appendLog("Saved session cleared.");
    await refreshSessionStatus();
  } catch (error) {
    appendLog(error.message);
  }
});

elements.fetchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = elements.usernameInput.value.trim().replace(/^@/, "");
  if (!username) {
    appendLog("Enter a username first.");
    return;
  }

  try {
    appendLog(`Fetching active stories for @${username}...`);
    const result = await request("/api/stories/fetch", {
      method: "POST",
      body: JSON.stringify({ username })
    });

    state.username = result.username;
    state.stories = result.items.map((item) => ({
      ...item,
      selected: false
    }));
    renderStories();
    appendLog(`Fetched ${state.stories.length} story item(s) for @${state.username}.`);
  } catch (error) {
    appendLog(error.message);
  }
});

elements.selectLatestButton.addEventListener("click", () => {
  const newest = [...state.stories]
    .sort((left, right) => {
      const leftTime = left.postedAt ? Date.parse(left.postedAt) : 0;
      const rightTime = right.postedAt ? Date.parse(right.postedAt) : 0;
      return rightTime - leftTime || right.itemIndex - left.itemIndex;
    })[0];

  applySelector((story) => story.id === newest?.id);
});

elements.selectVideosButton.addEventListener("click", () => {
  applySelector((story) => story.mediaType === "video");
});

elements.selectImagesButton.addEventListener("click", () => {
  applySelector((story) => story.mediaType === "image");
});

elements.clearSelectionButton.addEventListener("click", () => {
  applySelector(() => false);
});

elements.downloadButton.addEventListener("click", async () => {
  const selected = selectedStories();
  if (!selected.length) {
    appendLog("Select at least one story item first.");
    return;
  }

  try {
    appendLog(`Downloading ${selected.length} selected item(s) for @${state.username}...`);
    const result = await request("/api/stories/download", {
      method: "POST",
      body: JSON.stringify({
        username: state.username,
        items: selected
      })
    });

    appendLog(`Saved ${result.files.length} file(s) to ${result.directory}.`);
  } catch (error) {
    appendLog(error.message);
  }
});

await refreshSessionStatus();
renderStories();
