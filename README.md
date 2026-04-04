# Local Instagram Story Saver

Local-only selective Instagram story saver for personal use. It keeps everything on your laptop, reuses a locally saved browser session, and lets you fetch one account's active stories, select specific items, and download only those items.

## What it does

- Opens Instagram in a real browser for manual login
- Saves only Playwright storage state locally in `sessions/`
- Fetches currently active story items for a single username
- Shows media type, timestamp, and source URL previews in a local web UI
- Downloads selected items into `downloads/<username>/<date>/`
- Merges separate Instagram video and audio streams when `ffmpeg` is installed

## Prerequisites

You need these installed before running the project:

- Node.js 20 or newer
- npm
- Homebrew
- ffmpeg

Check what you already have:

```bash
node -v
npm -v
brew -v
ffmpeg -version
```

## One-Time Setup

### 1. Open the project folder

```bash
cd /Users/yanthraa/Desktop/PISS
```

### 2. Install project dependencies

```bash
npm install
```

### 3. Install the Playwright Chromium browser

```bash
npx playwright install chromium
```

### 4. Install ffmpeg

This is required if you want downloaded Instagram story videos to include audio.

```bash
brew install ffmpeg
```

Verify it:

```bash
ffmpeg -version
```

## Run the Project

Start the local server:

```bash
npm start
```

Then open:

```text
http://localhost:4318
```

## First-Time App Flow

1. Click `Login to Instagram`
2. Log in manually in the opened browser window
3. Come back to the app and click `Save Session`
4. Enter an Instagram username
5. Click `Fetch Stories`
6. Select the story items you want
7. Click `Download Selected`

Downloads are saved in:

```text
downloads/<username>/<date>/
```

## Every Time You Reopen the Project

If your saved session is still valid:

```bash
cd /Users/yanthraa/Desktop/PISS
npm start
```

If Instagram logged you out, repeat the login flow inside the app and save a new session.

## Troubleshooting

### Videos download without audio

Make sure `ffmpeg` is installed:

```bash
ffmpeg -version
```

If that command fails, install it:

```bash
brew install ffmpeg
```

Then restart the app and download the story again.

### Playwright browser is missing

Run:

```bash
npx playwright install chromium
```

### Session expired

- Click `Clear Session`
- Click `Login to Instagram`
- Log in again
- Click `Save Session`

## Notes

- This app is intentionally local-only.
- It never asks for or stores your Instagram password.
- Story extraction depends on Instagram's current web UI and may need updates if Instagram changes selectors or story loading behavior.
