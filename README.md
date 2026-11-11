# Local Instagram Story Saver

Local-only selective Instagram story saver for personal use. It keeps everything on your computer, reuses a locally saved browser session, and lets you fetch one account's active stories, select specific items, and download only those items.

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
- ffmpeg
- Homebrew (macOS only, used below to install ffmpeg)
- A desktop session (the login step opens a visible browser window, so it will not work on a headless server)

Check what you already have:

```bash
node -v
npm -v
ffmpeg -version
```

## One-Time Setup

### 1. Open the project folder

```bash
cd /path/to/PISS
```

### 2. Install project dependencies

```bash
npm install
```

`package-lock.json` pins Playwright to version 1.58.2. Check it with `npx playwright --version`.

### 3. Install the Playwright Chromium browser

```bash
npx playwright install chromium
```

### 4. Install ffmpeg

This is required if you want downloaded Instagram story videos to include audio.

On macOS:

```bash
brew install ffmpeg
```

On Debian or Ubuntu:

```bash
sudo apt-get install -y ffmpeg
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

To use a different port, set the `PORT` environment variable first:

```bash
PORT=5000 npm start
```

Then open `http://localhost:5000`.

## First-Time App Flow

1. Click `Login to Instagram`
2. Log in manually in the opened browser window
3. Come back to the app and click `Save Session`
4. Enter an Instagram username (without the `@`, and without slashes)
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
cd /path/to/PISS
npm start
```

If Instagram logged you out, repeat the login flow inside the app and save a new session.

## Security Notes

- **The server listens on all network interfaces**, not only on this computer. Anyone who can reach the port can use the login, session and download endpoints. Only run it on a trusted network, or block the port in your firewall. Restricting it to `127.0.0.1` requires a code change; it is not done yet.
- **`sessions/instagram-state.json` holds your live Instagram login cookies.** Anyone who gets this file can use your account. Do not share it or copy it to other machines. It is excluded from git.
- **Download folder names come from the username you type.** Enter a plain Instagram username only. A `/` creates nested folders, and `..` can place files outside `downloads/`.
- The app never asks for or stores your Instagram password, but the saved session is equivalent to being logged in.

## Troubleshooting

### Videos download without audio

Make sure `ffmpeg` is installed:

```bash
ffmpeg -version
```

If that command fails, install it using the steps in "Install ffmpeg" above. The app checks for ffmpeg each time you download, so you do not need to restart it. Download the story again.

### Playwright browser is missing

Run:

```bash
npx playwright install chromium
```

### Login window does not open

The login step needs a desktop with a display. Run the app on a machine with a graphical session, not over SSH on a headless server.

### Session expired

- Click `Clear Session`
- Click `Login to Instagram`
- Log in again
- Click `Save Session`

## Testing

There are no automated tests yet. `npm run check` only checks that the server file parses:

```bash
npm run check
```

## Notes

- This app is intentionally local-only.
- The `logs/` folder is created on start, but the app does not write any log files yet.
- Story extraction depends on Instagram's current web UI and may need updates if Instagram changes selectors or story loading behavior.
