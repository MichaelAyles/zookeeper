# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev       # Start Vite development server (http://localhost:5173)
npm run build     # TypeScript check + production build
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

## Architecture Overview

Zookeeper is a mobile-first PWA for tracking zoo animal sightings - "Pokédex for real zoo animals".

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 with custom design tokens
- **State**: Zustand for global state
- **Data**: Dexie (IndexedDB) - swap-ready for Supabase
- **Data Fetching**: TanStack Query
- **LLM**: OpenRouter API (Gemini 2.0 Flash for vision + text)

### Directory Structure
```
src/
├── components/     # Reusable React components (BottomNav)
├── lib/            # Core libraries
│   ├── db.ts       # Dexie IndexedDB schema
│   ├── openrouter.ts # LLM API client
│   └── utils.ts    # Helper functions
├── pages/          # Route components (Welcome, Home, ZooSelect, Visit, Camera, Stats)
├── services/       # Database operations (swap-ready layer)
│   ├── zoos.ts     # Zoo CRUD
│   ├── animals.ts  # Animal operations + AI generation
│   ├── visits.ts   # Visit tracking
│   ├── sightings.ts # Sighting records
│   ├── identification.ts # AI image identification
│   └── stats.ts    # User statistics
├── stores/         # Zustand state (useStore.ts)
└── types/          # TypeScript interfaces
```

### Key Patterns

**Service Layer**: All database operations go through `src/services/`. Each file uses Dexie but can be swapped to Supabase by changing ~5 lines per file.

**Design Tokens**: Custom colors defined in `src/index.css` - forest green, savanna gold, terracotta. Fonts: Fredoka (display) + Nunito (body).

**Mobile-First**: All pages designed for mobile with bottom navigation (`BottomNav` component).

### Environment Variables
Copy `.env.example` to `.env.local` and add:
- `VITE_OPENROUTER_API_KEY` - Required for AI features

## Screenshots with Playwright

Use the Playwright MCP tools to capture screenshots of the app:

```bash
# Navigate to a page
mcp__plugin_playwright_playwright__browser_navigate url="http://localhost:5173"

# Take a screenshot
mcp__plugin_playwright_playwright__browser_take_screenshot filename="my-screenshot.png"
```

Screenshots are saved to `.playwright-mcp/` (gitignored). Move important screenshots to `blogs/` with sequential numbering.

## Blog Documentation

After completing a major feature, create a blog entry in `blogs/`:

1. Check existing files in `blogs/` to find the next available number
2. Name files sequentially: `0001blog.md`, `0002screenshot.png`, `0003screenshot.png`, etc.
3. All blog content and screenshots share the same numbering sequence
4. Blog posts should document what was built, design decisions, and technical notes
