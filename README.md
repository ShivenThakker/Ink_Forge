# InkForge

> Convert text into human-like handwriting — rendered as clean SVG vector paths, not fonts.

Most "handwriting" tools just swap in a cursive font. InkForge works differently. Every letter is defined as a set of anchor points connected by Catmull-Rom splines, with a variation engine that introduces controlled randomness on every render — so the same word never looks exactly the same twice.

---

## How It Works

Each letter is stored as a sequence of anchor points in a normalized coordinate space. At render time, the engine:

1. Samples anchors based on the current `anchorCount` (fewer anchors = rougher writing)
2. Applies per-render jitter to positions, angles, and spacing via a seeded RNG
3. Fits a Catmull-Rom spline through the points and converts it to an SVG cubic bezier path
4. Connects letters with smooth connector curves
5. Outputs a single SVG — no fonts, no rasterization

---

## Features

- **Vector output** — pure SVG, scales to any size without quality loss
- **13 tunable parameters** across layout, shape, randomness, and stroke
- **Seeded rendering** — same seed always produces identical output (useful for testing and reproducibility)
- **Preset system** — switch between styles like `neat`, `fast_notes`, and `messy_scrawl`
- **Letter editor** — drag anchors on a grid, preview the spline live, export to JSON
- **Anchor count as quality dial** — more anchors = cleaner writing, fewer = rushed or sloppy
- **Export to SVG**

---

## Parameters

| Group | Parameter | Description |
|---|---|---|
| Layout | `slant` | Forward/backward lean of the writing |
| Layout | `spacing` | Gap between letters |
| Layout | `baselineJitter` | How much the writing drifts up and down |
| Layout | `spacingJitter` | Random variation in letter spacing |
| Shape | `roundness` | Controls spline tension — angular to fluid |
| Shape | `loopSize` | Size of loops in letters like a, g, d |
| Shape | `strokeCurvature` | How curved strokes feel overall |
| Shape | `connectionSmoothness` | How cleanly letters join in cursive |
| Shape | `anchorCount` | Number of anchors used per letter (quality vs roughness) |
| Randomness | `anchorJitter` | How much anchor positions shift each render |
| Randomness | `angleJitter` | Slight rotation applied per letter |
| Randomness | `strokeBreakChance` | Probability of a tiny pen-lift gap mid-stroke |
| Stroke | `strokeWidth` | Pen thickness |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

---

### Running on Linux

```bash
# Clone the repository
git clone https://github.com/ShivenThakker/Ink_Forge.git
cd Ink_Forge

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

To build for production:

```bash
npm run build
npm run preview
```

---

### Running on Windows

**Option A — Using Command Prompt or PowerShell:**

```powershell
# Clone the repository
git clone https://github.com/ShivenThakker/Ink_Forge.git
cd Ink_Forge

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

**Option B — Using Windows Subsystem for Linux (WSL):**

If you have WSL set up, the Linux instructions above work exactly as written inside your WSL terminal.

**Note for Windows users:** If you see an error like `'vite' is not recognized`, run `npm install` again — this usually means the `node_modules` folder wasn't created correctly. If the issue persists, try:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

---

## Project Structure

```
src/
├── engine/
│   ├── spline.ts        # Catmull-Rom → SVG cubic bezier conversion
│   ├── variation.ts     # Seeded RNG, jitter functions, stroke breaks
│   ├── layout.ts        # Text → positioned anchor sets
│   ├── connector.ts     # Cursive join curves between letters
│   └── renderer.ts      # Full pipeline orchestration, SVG output
├── styles/
│   └── neat.json        # Default handwriting style (26 letters, 13 params)
├── components/
│   ├── TopBar.tsx
│   ├── PreviewCanvas.tsx
│   ├── ControlPanel.tsx
│   └── LetterEditor.tsx
└── App.tsx
```

---

## Letter Editor

InkForge ships with a built-in letter editor for creating and refining letter definitions:

- Click on the grid to place anchor points
- Drag anchors to adjust their position
- The Catmull-Rom spline preview updates live as you drag
- First anchor is the entry point (green), last is the exit point (red)
- Export any letter as JSON and add it to a style file

This is how the anchor data in `src/styles/neat.json` was originally produced.

---

## Style Files

Handwriting styles are stored as JSON in `src/styles/`. Each style file defines:

- Default values for all 13 parameters
- Anchor definitions for every letter

To create a new style, copy `neat.json`, give it a new name, adjust the defaults, and update the letter anchors using the editor.

---

## Tech Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- SVG rendered entirely in-browser — no canvas, no WebGL, no external rendering dependencies
- Catmull-Rom splines converted to SVG cubic bezier commands at runtime

---

## Roadmap

- [ ] Multiple anchor sets per letter (variants) for more natural repetition
- [ ] Uppercase letters, numbers, punctuation
- [ ] Additional style presets (`fast_notes`, `messy_scrawl`)
- [ ] PNG export via canvas
- [ ] Pen pressure simulation (stroke width variation along a path)
- [ ] Multi-line text support

---

## License

MIT
