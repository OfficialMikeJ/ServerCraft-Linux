# ServerCraft Linux — Changelog

All notable changes to this project are documented here.  
Format: `[vYYYY.MINOR.PATCH] — YYYY-MM-DD`

---

## [v2026.3.0-BETA] — 2026-05-31

### Added
- **Arma Reforger panel** — dedicated nav tab that appears automatically when at least one Reforger server is installed and hides itself when all are removed
  - **Servers sub-tab** — status cards with per-server Start / Stop / Restart controls
  - **Scenarios sub-tab** — 30+ scenario dropdown (all official Conflict, HQ Commander, Combat Ops, Game Master, Capture & Hold maps plus Freedom Fighters workshop scenarios with auto-injected mod dependencies), blue Save button writes directly to `ServerConfig.json`
  - **Mods sub-tab** — live table of mods currently written into each server's config
- **Assetto Corsa panel** — dedicated nav tab with full server management
  - **Servers sub-tab** — status + start/stop/restart per server
  - **Server Config sub-tab** — track picker (20 base tracks), car picker with quick-add buttons, session times, weather presets; saved to `cfg/server_cfg.ini`
  - **Entry List sub-tab** — per-slot car/driver/GUID/ballast/restrictor table; saved to `cfg/entry_list.ini`
  - **Mods sub-tab** — upload any mod `.zip` (no Steam Workshop needed); extracted into `content/cars/` or `content/tracks/` with live installed-mod listing
- **Assetto Corsa game support** — added to `GAME_DEFINITIONS` (ports 9600–9699, `acServer` executable, Steam App 302550)
- **FiveM install handler** — fetches latest build from cfx.re artifacts, downloads `fx.tar.xz`, extracts, makes `run.sh` executable, writes a default `server.cfg`
- **TeamSpeak 3 install handler** — fetches latest version from TeamSpeak's version API, downloads and extracts the Linux tar.bz2, auto-accepts the license, makes `ts3server` executable
- **Post-install config generation** — `ServerConfig.json` (Arma Reforger) and `cfg/server_cfg.ini` + `cfg/entry_list.ini` (Assetto Corsa) are now written immediately after SteamCMD finishes, not just on first start
- **AC backend API endpoints**
  - `GET/PUT /api/servers/{id}/assetto/config` — read/write `server_cfg.ini`
  - `GET/PUT /api/servers/{id}/assetto/entry-list` — read/write `entry_list.ini`
  - `GET /api/servers/{id}/assetto/mods` — list installed cars and tracks
  - `POST /api/servers/{id}/assetto/mods/upload` — install a mod zip
- **Reforger scenario API** — `PUT /api/servers/{id}/reforger/scenario` writes `scenarioId` and injects required mods into `ServerConfig.json`
- **Per-installation auth salt** — random 32-byte hex salt generated on first run and persisted to `.auth_salt`; existing installs migrate transparently

### Fixed
- **Font Awesome icons** — downgraded `@fortawesome/fontawesome-free` from v7 to v6.7.2; FA7's `content: var(--fa)/""` alt-text syntax was stripped by PostCSS/webpack in the CRA build, causing all icons to render as empty boxes
- **Arma Reforger startup** — `ServerConfig.json` is now generated before the server process is launched (was missing entirely)
- **Arma Reforger CLI args** — args like `"-maxPlayers 32"` were passed as single strings; subprocess list mode does not shell-split them, so the server received them as unrecognised arguments; split into separate list elements
- **Arma Reforger executable** — `ArmaReforgerServer.exe` → `ArmaReforgerServer` (Linux has no `.exe`)
- **Project Zomboid start command** — was an empty `pass` block; now passes `-servername <name>` so PZ can locate its config file
- **Valheim start command** — args packed as single strings (e.g. `"-port 2456"`); split into separate elements; added `-savedir` for persistent world storage
- **All Linux executable names** — removed `.exe`/`.bat` extensions from every game definition; corrected names: `arma3server_x64`, `DayZServer`, `RustDedicated`, `start-server.sh` (PZ), `valheim_server.x86_64`, `SquadGameServer`, `GroundBranchServer`, `IcarusServer`, `NoOneSurvivedServer`, `run.sh` (FiveM), `srcds_run` (Source Engine), `ts3server` (TS3)
- **Linux binary fallback** — executable search now uses `os.access(candidate, os.X_OK)` to find Linux binaries without file extensions when the primary name isn't found
- **Install route null-guard** — games with `server_app_id: None` now return HTTP 400 instead of silently failing inside SteamCMD
- **Docker frontend build** — added `chmod +x node_modules/.bin/*` step and committed `yarn.lock` so `--frozen-lockfile` builds succeed in CI
- **WebSocket host** — was connecting to wrong host on login screen, causing repeated errors in console
- **Static files 404** — fixed FastAPI static mount path so React JS/CSS bundles load correctly

### Changed
- Nav tabs for game-specific panels (Arma Reforger, Assetto Corsa) are **conditional** — they appear only when servers of that type exist and auto-redirect to Dashboard when the last server of that type is deleted
- Custom tab labels use a `TAB_LABELS` map so "reforger" → "Arma Reforger" and "assetto" → "Assetto Corsa" display correctly in the header nav

---

## [v2026.2.0-BETA] — 2026-04-15

### Added
- SteamCMD console streaming via WebSocket
- Custom file browser with path-traversal protection for all server directories
- File upload / download endpoints for server directories
- Java 21 (OpenJDK headless) bundled in Docker image for Minecraft servers

### Fixed
- Minecraft install: downloads latest release JAR directly from Mojang manifest; writes `eula.txt` and default `server.properties`
- Missing CSS variables causing invisible UI on first load
- Setup overlay z-index and inline styles bypass CSS variable issues
- All Windows-specific paths and references replaced with Linux equivalents

---

## [v2026.1.0-BETA] — 2026-03-01

### Added
- First-run onboarding wizard (4-step: welcome → SteamCMD → games → finish)
- ServerCraft logo, custom favicon, and Linux edition branding
- Sub-user management system (Admin / Moderator / Viewer roles with per-server assignment)
- UPnP port-forwarding support
- Workshop / mod browser with search, download, and cache management
- Template Marketplace with version tracking and one-click updates
- Analytics and feedback submission
- Custom domain / SSL configuration via Nginx Proxy Manager integration
- PayPal-based server sales with package management
- Cluster management for multi-node deployments
- Background slideshow with per-game themes and configurable intervals
- Self-update system with semantic versioning and changelog preview

### Fixed
- `.env.example` no longer ignored by `.gitignore`
- Removed fabricated environment variables from example config
- `jsconfig.json` baseUrl and `$schema` corrected for VS Code

---

## [v2026.0.0-BETA] — 2026-02-01 — Initial Release

### Added
- FastAPI backend with uvicorn serving React 19 frontend as static files
- Docker multi-stage build (Node.js → Python/Ubuntu 22.04)
- Admin authentication with SHA-256 hashing, session tokens, remember-me, and AFK timeout
- Password reset via security questions (3-question system)
- Server CRUD: create, read, update, delete game servers
- Server lifecycle: start, stop, restart with `subprocess.Popen` process management
- Console output streaming (WebSocket per server with 1000-line ring buffer)
- System stats monitoring: CPU, RAM, disk via WebSocket
- SteamCMD integration for downloading and updating Steam-based game servers
- Game support: Arma 3, Arma Reforger, DayZ (Vanilla + Modded), Rust, Valheim, Squad, Ground Branch, ICARUS, No One Survived, FiveM, Source Engine, Minecraft, TeamSpeak 3
- Port auto-allocation with per-game port ranges (no overlaps)
- Dashboard view: system gauges, running/stopped server counts, quick actions
- Servers view: tabbed per-server console, install, start/stop/restart controls
- Settings view: UPnP, clustering, background slideshow, custom domain, server sales
- About view: version info, changelog, system information
