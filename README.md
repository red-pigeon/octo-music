![Octo Player Banner](assets/banner.png)

Vite + Vue 3 desktop music player packaged with Electron (electron-builder).

## Features

- **Emby Integration** - Connect to your Emby media server
- **Music Library Browsing** - Browse albums, artists, playlists, and songs
- **Advanced Equalizer** - Built-in EQ with presets and custom settings
- **Favorites Management** - Mark and organize your favorite music
- **Cross-platform** - Available for Windows and Linux

## Requirements

- Node.js (LTS recommended)

## Development

Install deps:

```bash
npm install
```

Run the app (starts Vite on `http://localhost:5173` and launches Electron):

```bash
npm run dev
```

The `dev` script runs both processes via `concurrently`.

## Build & package

Build the Vite frontend:

```bash
npm run build
```

### Windows

Create a Windows installer (NSIS):

```bash
npm run dist
```

This creates a fresh output folder under `release-builds/` each run (avoids Windows file-lock issues).

If you only want the unpacked folder build (no installer):

```bash
npm run dist:dir
```

Outputs:

- `release-builds/<version>-<timestamp>/Octo Setup <version>.exe` (installer)
- `release-builds/<version>-<timestamp>/win-unpacked/` (portable folder)

Installer note:

- The NSIS installer is configured as a per-machine install (defaults to `Program Files`), so Windows will prompt for admin elevation.

If you get file-lock errors (common if the app is still running or Windows Defender is scanning the output), close Octo completely and bump the `version` in `package.json` so the installer filename changes, then rerun `npm run dist`.

### Linux

Create a Linux AppImage:

```bash
node tools/build-stamped.mjs appimage linux
```

Or create a `.deb` package:

```bash
npx electron-builder --linux deb
```

Outputs will be in the `release-builds/<version>-<timestamp>/` directory.

## Lint

```bash
npm run lint
npm run lint:fix
```

## Repo notes

- Local environment files are ignored (`.env`, `.env.*`). Commit an `.env.example` if you want to document required variables.
- Build artifacts and caches (e.g. `dist/`, `out/`, `.vite/`) are ignored via `.gitignore`.

## License

Octo Player is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute.
In plain English: you can do almost anything with it, as long as you keep the copyright and license notice.