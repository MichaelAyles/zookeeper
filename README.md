# Zookeeper

> Turn every zoo visit into an interactive wildlife collection adventure

Zookeeper is a mobile-first PWA that transforms zoo visits into an engaging collection game. Select your zoo, receive an AI-generated animal checklist, and tick off animals as you spot them - either manually or by pointing your camera for instant AI identification.

**Core concept:** "Pokedex for real zoo animals"

## Features

- **Google Sign-In** - Secure authentication with cloud sync across devices
- **Smart Zoo Selection** - Search from a curated list of popular zoos worldwide
- **AI-Generated Checklists** - Powered by Gemini, get accurate animal lists for any zoo
- **Camera Identification** - Point your phone at an animal and let AI identify it
- **Progress Tracking** - See your completion rate for each zoo visit
- **Lifetime Statistics** - Track animals spotted, zoos visited, and photos taken
- **Fun Facts** - Learn interesting facts about every animal you encounter
- **Global Zoo Database** - Shared zoo and animal data, private user sightings

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Database | Cloudflare D1 (SQLite at the edge) |
| Photo Storage | Cloudflare R2 |
| API | Cloudflare Pages Functions |
| Auth | Google OAuth 2.0 + JWT |
| Data Fetching | TanStack Query |
| LLM Gateway | OpenRouter |
| Vision Model | Gemini 2.0 Flash |

## Getting Started

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- OpenRouter API key (for AI features)
- Google Cloud OAuth credentials

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Add your OpenRouter API key to .env.local
# VITE_OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx

# Create D1 database
npm run db:create

# Apply database migrations
npm run db:migrate:local

# Start development server
npm run dev
```

### Cloudflare Setup

1. **Create D1 Database**
   ```bash
   wrangler d1 create zookeeper-db
   # Copy the database_id to wrangler.toml
   ```

2. **Create R2 Bucket**
   ```bash
   wrangler r2 bucket create zookeeper-photos
   ```

3. **Set Secrets**
   ```bash
   wrangler secret put GOOGLE_CLIENT_SECRET
   wrangler secret put JWT_SECRET
   ```

4. **Configure Google OAuth**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create OAuth 2.0 credentials
   - Add redirect URI: `https://your-app.pages.dev/api/auth/callback`
   - Copy Client ID to `wrangler.toml`

5. **Deploy**
   ```bash
   npm run deploy
   ```

## Project Structure

```
zookeeper/
├── src/                    # Frontend (React)
│   ├── components/         # Reusable React components
│   ├── lib/                # Core libraries (API, utils)
│   ├── pages/              # Route components
│   ├── services/           # API service layer
│   ├── stores/             # Zustand state management
│   └── types/              # TypeScript interfaces
├── functions/              # Cloudflare Pages Functions
│   ├── api/                # API endpoints
│   └── lib/                # Shared backend utilities
├── migrations/             # D1 database migrations
└── wrangler.toml           # Cloudflare configuration
```

## Scripts

```bash
npm run dev           # Start Vite dev server (frontend only)
npm run dev:api       # Start full stack with Wrangler
npm run dev:full      # Build + start full stack
npm run build         # Build for production
npm run deploy        # Build and deploy to Cloudflare
npm run db:migrate    # Apply D1 migrations
npm run lint          # Run ESLint
```

## Demo Pages

The `demo-site/` directory contains static HTML mockups of the app's UI. Open these files in a browser to preview the design.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with Cloudflare Pages, D1, and R2
