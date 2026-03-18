# CLAUDE.md

This file provides guidance for AI assistants working with the sp_cam_test repository.

## Project Overview

**Nose Dodge** — a mobile-browser side-scrolling shooter controlled by nose tracking via the front camera. Built with vanilla HTML5/JS and MediaPipe Face Mesh. No build system or bundler required.

## Repository Structure

```
sp_cam_test/
├── index.html       # Entry point — HTML layout, styles, start screen
├── game.js          # All game logic (ES module)
│   ├── MediaPipe Face Mesh setup & nose tracking
│   ├── Game loop, rendering (Canvas 2D)
│   ├── Player, enemies, bullets, particles
│   ├── Collision detection & scoring
│   └── HUD & game-over screen
├── README.md        # Project readme
└── CLAUDE.md        # This file
```

## Tech Stack

- **Language**: Vanilla JavaScript (ES modules)
- **Rendering**: HTML5 Canvas 2D
- **Face tracking**: MediaPipe Face Mesh (loaded from CDN, no npm install needed)
- **Build system**: None — open `index.html` directly or serve with any static server
- **Dependencies**: Zero local deps; MediaPipe loaded via `cdn.jsdelivr.net`

## Running Locally

Serve the project root with any static HTTP server (required for ES module imports):

```bash
# Python
python3 -m http.server 8000

# Node.js (npx)
npx serve .
```

Then open on a smartphone browser (or desktop with webcam). Grant camera permission when prompted.

## Key Architecture Decisions

- **Single JS file**: All logic lives in `game.js` to keep the project simple
- **No build step**: CDN imports mean no `npm install`, no bundler config
- **Nose landmark**: Uses MediaPipe Face Mesh landmark index `1` (nose tip)
- **Coordinate mapping**: Camera X is mirrored so moving your head right moves the player right
- **Auto-fire**: Player shoots automatically; the challenge is dodging enemy fire
- **Difficulty ramp**: Enemy spawn rate and bullet speed increase every 10 seconds

## Game Mechanics

| Mechanic | Detail |
|---|---|
| Controls | Nose position mapped to player X/Y (left half of screen) |
| Scoring | +1/frame for survival, +100 per enemy destroyed |
| Enemies | Spawn from right, fly left, aim bullets at the player |
| Difficulty | Level increases every 10s — faster spawns, faster bullets |
| Game over | Hit by enemy bullet or enemy body |
| High score | Persisted in `localStorage` |

## Git Workflow

- **Primary branch**: `main` (remote) / `master` (local)
- **Feature branches**: Use the pattern `claude/<description>-<id>` for AI-assisted work
- **Commits**: Signed with SSH keys; write clear, descriptive commit messages
- **Push**: Always use `git push -u origin <branch-name>`

## Development Guidelines

- Keep the codebase simple; avoid over-engineering
- No build tools or bundlers unless truly necessary
- All game logic stays in `game.js` unless it grows beyond ~500 lines
- Test on mobile Chrome/Safari — these are the primary targets
- Update this CLAUDE.md when adding new files, features, or tooling
