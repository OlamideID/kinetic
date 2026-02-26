# Kinetic — Gesture-Controlled Card Interface

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Python](https://img.shields.io/badge/python-3.8--3.11-blue)
![OpenCV](https://img.shields.io/badge/OpenCV-4.x-orange)
![MediaPipe](https://img.shields.io/badge/MediaPipe-0.9.x-red)

A real-time gesture-controlled card interface that uses your webcam to track hand movements and control image cards on screen. Point at a card to select it, close your fist to drag it, and open your hand to release — all without touching a keyboard or mouse.

---

## ⚠️ Python Version

**Requires Python 3.8 – 3.11**

MediaPipe does not support Python 3.12 or above. If you're on a newer version, install 3.11 via [python.org](https://www.python.org/downloads/release/python-3119/) or use `pyenv`:

```bash
pyenv install 3.11.9
pyenv local 3.11.9
```

---

## Demo

> Move your hand → cursor follows  
> ☝️ Point at a card → highlights with glow  
> ✊ Close fist on card → drag it anywhere  
> ✊ Close fist on empty space → whole stack follows your fist  
> ✋ Open hand → release / scatter  

---

## Tech Stack

| Layer | Technology |
|---|---|
| Hand Tracking | Python, OpenCV, MediaPipe |
| Communication | WebSockets (`websockets` library) |
| Frontend | HTML, CSS, JavaScript (Vanilla) |
| Fonts | Syne, JetBrains Mono (Google Fonts) |
| Server | Python `http.server` (local) |

---

## Project Structure

```
kinetic/
├── hand_tracker.py     # Python webcam + MediaPipe + WebSocket server
├── index.html          # Frontend UI
├── README.md
└── assets/
    ├── 1.jpg
    ├── 2.jpg
    ├── 3.jpg
    ├── 4.jpg
    ├── 5.jpg
    ├── 6.jpg
    └── 7.jpg
```

---

## Getting Started

### 1. Install Python dependencies

```bash
pip install opencv-python mediapipe==0.9.3 websockets
```

### 2. Run the hand tracker

```bash
python hand_tracker.py
```

This opens your webcam in a preview window and starts a WebSocket server on `ws://localhost:6789`.

### 3. Serve the frontend

```bash
python -m http.server 8000
```

### 4. Open in browser

```
http://localhost:8000
```

> **Note:** You must use `http://localhost:8000` not `file://` — browsers block local asset loading from the filesystem.

---

## Gesture Reference

| Gesture | Action |
|---|---|
| Open hand / 1+ fingers up | Scatter mode — cards rest in position |
| Hover over card | Card highlights with glow ring |
| Close fist on hovered card | Grab and drag that card |
| Close fist on empty space | Entire stack follows your fist |
| Open fist | Release — card stays where dropped |

---

## How It Works

### Hand Tracking (`hand_tracker.py`)
- Captures webcam frames via OpenCV
- Runs MediaPipe Hands to extract 21 hand landmarks per frame
- Detects open/closed gesture using **wrist-to-fingertip distance ratio** — more reliable than y-axis comparison alone
- Applies **exponential moving average** smoothing to coordinates to eliminate jitter
- Uses a **debouncer** (5 consistent frames) before switching gesture state to prevent flickering
- Broadcasts `{x, y, gesture, detected}` JSON to all connected WebSocket clients at ~60fps

### Frontend (`index.html`)
- Connects to WebSocket and lerps cursor position every animation frame for fluid motion
- Spring physics system drives all card movement (position + rotation)
- Hover detection via proximity radius from cursor to card center
- `draggedIdx` and `stackMode` persist across hand-loss events — re-detecting your hand mid-gesture resumes the action
- Light/dark mode toggled with CSS custom properties and `data-theme` attribute

---

## Customization

**Change card images** — replace files in `assets/` named `1.jpg` through `7.jpg`, or update `CARD_DATA` in `index.html`:
```js
const CARD_DATA = [
  { label: 'My Label', img: 'assets/myimage.jpg' },
  ...
];
```

**Adjust hover sensitivity** — change `HOVER_RADIUS` in `index.html` (default: `115px`)

**Adjust smoothing** — change `alpha` in `Smoother` class in `hand_tracker.py` (lower = smoother, more lag)

**Adjust gesture debounce** — change `threshold` in `GestureDebouncer` (higher = more stable, slower to switch)

---

## Known Limitations

- Requires **Python 3.8 – 3.11** — MediaPipe does not support Python 3.12+
- Works best with a **plain background** (non-skin-colored wall behind hand)
- Good, even lighting improves detection accuracy
- Requires Python to be running locally — cannot be fully hosted on static platforms like Netlify
- Currently supports **one hand** only

---

## License

MIT