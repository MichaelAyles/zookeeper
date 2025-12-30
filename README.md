# Zookeeper

> Turn every zoo visit into an interactive wildlife collection adventure

Zookeeper is a mobile-first PWA that transforms zoo visits into an engaging collection game. Select your zoo, receive an AI-generated animal checklist, and tick off animals as you spot them - either manually or by pointing your camera for instant AI identification.

**Core concept:** "Pokedex for real zoo animals"

## Features

- **Smart Zoo Selection** - Search from a curated list of popular zoos worldwide
- **AI-Generated Checklists** - Powered by Gemini, get accurate animal lists for any zoo
- **Camera Identification** - Point your phone at an animal and let AI identify it
- **Progress Tracking** - See your completion rate for each zoo visit
- **Lifetime Statistics** - Track animals spotted, zoos visited, and photos taken
- **Fun Facts** - Learn interesting facts about every animal you encounter
- **Offline-First** - Data stored locally with IndexedDB (Dexie)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Data | Dexie (IndexedDB) - swap-ready for Supabase |
| Data Fetching | TanStack Query |
| LLM Gateway | OpenRouter |
| Vision Model | Gemini 2.0 Flash |

## Getting Started

### Prerequisites

- Node.js 18+
- OpenRouter API key (for AI features)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Add your OpenRouter API key to .env.local
# VITE_OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx

# Start development server
npm run dev
```

## Project Structure

```
src/
├── components/     # Reusable React components
├── lib/            # Core libraries (Dexie, OpenRouter, utils)
├── pages/          # Route components
├── services/       # Business logic (swap-ready for Supabase)
├── stores/         # Zustand state management
└── types/          # TypeScript interfaces
```

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

## Swapping to Supabase

The service layer is designed for easy database swapping. Each service file (e.g., `src/services/zoos.ts`) uses Dexie locally but can be swapped to Supabase by changing ~5 lines per file.

## Demo Pages

The `demo-site/` directory contains static HTML mockups of the app's UI. Open these files in a browser to preview the design.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built for the Gemini Hackathon
