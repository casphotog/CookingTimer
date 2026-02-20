# Cooking Timer

A minimal, dark-themed multi-timer app for the kitchen. Built for use on a tablet mounted near the stove. Timers are freely positionable to mirror your physical cooktop layout.

## Features

- **Multiple timers** — add as many as you need, delete the ones you don't
- **Countdown timers** — three configurable presets per tile, tap to start
- **Stopwatch** — per-tile count-up timer with pause/resume
- **Freeform canvas** — drag tiles anywhere on screen to match your stove layout
- **Resizable tiles** — drag the bottom-right corner to resize each tile independently
- **Snap to grid** — positions and sizes snap to a 40 px grid for easy alignment
- **Arrange mode** — iOS-style jiggle locks tiles during normal use; tap Arrange to reposition
- **Persistent layout** — positions, sizes, labels, and presets survive page reload (localStorage)
- **Done alerts** — finished timers flash and animate from green → red until dismissed

## Usage

### Normal mode
- Tap a time button to start a countdown
- Tap ⏱ to start a count-up stopwatch; tap the display to pause/resume
- Tap **Cancel** to stop a running timer
- Tap a done (flashing) tile to dismiss it
- Tap a timer label to rename it

### Arrange mode
Tap **Arrange** (bottom-right corner) to enter arrange mode:
- Tiles wiggle and can be dragged freely
- Drag the striped handle in the bottom-right of a tile to resize it
- Tap **+** to add a new timer tile
- Tap the **×** badge on a tile to delete it
- Tap **Clean Up** to re-center the group on screen while preserving relative positions
- Tap **Done** to lock the layout and save

### Editing presets
Tap the pencil icon (top-right of a tile in normal mode) to edit the three countdown presets using scroll pickers.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview build at http://localhost:4173
```

## Docker

A multi-stage Dockerfile builds the app and serves it via nginx.

```bash
docker build -t cookingtimer .
docker run -p 8080:80 cookingtimer
```

Or with Docker Compose:

```bash
docker compose up -d
```

## Stack

- [Svelte 5](https://svelte.dev/) — UI framework (uses runes: `$state`, `$derived`, `$effect`)
- [Vite](https://vitejs.dev/) — build tool
- [nginx](https://nginx.org/) — static file server in production
