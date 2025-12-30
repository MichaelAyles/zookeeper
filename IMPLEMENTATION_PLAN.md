# Zookeeper - Implementation Plan

> Comprehensive technical implementation guide for the Zookeeper mobile-first PWA

---

## Phase 1: Project Foundation

### 1.1 Initialize Project Structure

```bash
npm create vite@latest . -- --template react-ts
npm install
```

**Core Dependencies:**
```bash
# UI & Styling
npm install tailwindcss postcss autoprefixer
npm install @tailwindcss/forms

# State & Data
npm install zustand
npm install @tanstack/react-query

# Routing
npm install react-router-dom

# Backend
npm install @supabase/supabase-js

# PWA
npm install vite-plugin-pwa workbox-precaching

# Utilities
npm install clsx
npm install date-fns
```

### 1.2 Configuration Files

**tailwind.config.js** - Custom design tokens from demo:
- Colors: forest (#1a3a1a), canopy (#4a7c43), savanna (#c4a35a), cream (#faf6ed), terracotta (#c45d3a)
- Fonts: Fredoka (display), Nunito (body)
- Border radius: sm (12px), md (20px), lg (28px)
- Shadows: soft, card variants

**vite.config.ts** - PWA configuration:
- Manifest with icons
- Service worker registration
- Offline fallback

---

## Phase 2: Design System & UI Components

### 2.1 Base Components (src/components/ui/)

| Component | Purpose | Props |
|-----------|---------|-------|
| `Button` | Primary/secondary/ghost variants | variant, size, loading, disabled |
| `Card` | Container with shadow/radius | variant, padding, className |
| `Input` | Text input with label | label, error, placeholder |
| `ProgressBar` | Animated progress indicator | value, max, showLabel |
| `Spinner` | Loading indicator | size, color |
| `Modal` | Overlay dialog | isOpen, onClose, title |
| `Badge` | Status/count indicator | variant, children |
| `Avatar` | User avatar with initials | name, src, size |
| `BottomNav` | Fixed navigation bar | items, activeItem |
| `Checkbox` | Animated checkmark | checked, onChange |

### 2.2 Feature Components (src/components/)

| Component | Purpose | Location |
|-----------|---------|----------|
| `AnimalCard` | Single animal in checklist | Checklist page |
| `AnimalChecklist` | Grouped list with categories | Visit page |
| `CategoryHeader` | Category section header | Checklist |
| `Camera` | Camera capture interface | Visit page |
| `IdentificationResult` | AI result with confirm/deny | Camera flow |
| `VisitCard` | Current/past visit summary | Home page |
| `StatsCard` | Individual stat display | Stats page |
| `ZooSearch` | Search/select zoo input | Zoo selection |
| `FunFact` | Expandable fun fact card | Various |
| `ConfettiOverlay` | Celebration animation | Identification |

---

## Phase 3: Core Features Implementation

### 3.1 Authentication (Supabase Magic Link)

**Files:**
- `src/lib/supabase.ts` - Client initialization
- `src/hooks/useAuth.ts` - Auth state hook
- `src/pages/Login.tsx` - Email input screen
- `src/pages/AuthCallback.tsx` - Magic link handler

**Flow:**
1. User enters email
2. Supabase sends magic link
3. User clicks link, redirected to /auth/callback
4. Token exchange, redirect to /home
5. Session stored in localStorage

### 3.2 Zoo Selection & Animal List Generation

**Files:**
- `src/services/zoos.ts` - Zoo CRUD operations
- `src/services/animals.ts` - Animal list generation
- `src/pages/ZooSelect.tsx` - Zoo search UI
- `src/lib/openrouter.ts` - API client

**Gemini Integration:**
```typescript
// Generate animal list for a zoo
const prompt = `List all animals at ${zooName} in ${country}...`;
const response = await chatCompletion('google/gemini-3-flash-preview', messages);
const animals = JSON.parse(response); // ZooAnimal[]
```

**Caching Strategy:**
- Store generated lists in `zoo_animals` table
- Check `animals_generated_at` before regenerating
- Allow manual refresh after 90 days

### 3.3 Visit & Checklist Management

**Files:**
- `src/services/visits.ts` - Visit CRUD
- `src/services/sightings.ts` - Sighting CRUD
- `src/hooks/useVisit.ts` - Active visit state
- `src/pages/Visit.tsx` - Checklist UI

**State Structure (Zustand):**
```typescript
interface VisitStore {
  activeVisit: Visit | null;
  checklist: ChecklistItem[];
  progress: { seen: number; total: number };
  startVisit: (zooId: string) => Promise<void>;
  endVisit: () => Promise<void>;
  toggleSeen: (animalId: string) => Promise<void>;
  addPhoto: (animalId: string, photoUrl: string) => Promise<void>;
}
```

### 3.4 Camera & AI Identification

**Files:**
- `src/components/Camera.tsx` - Camera capture
- `src/hooks/useCamera.ts` - Camera access hook
- `src/services/identification.ts` - Vision API
- `src/pages/Identify.tsx` - Result screen

**Camera Flow:**
1. Request camera permission
2. Display live viewfinder
3. User taps capture
4. Convert frame to base64
5. Send to Gemini Vision via OpenRouter
6. Parse response, display result
7. User confirms or selects different animal
8. Save sighting with optional photo

**Gemini Vision Request:**
```typescript
const response = await chatCompletion('google/gemini-2.5-flash-image', [{
  role: 'user',
  content: [
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
    { type: 'text', text: `Identify the animal. Options: ${animals.join(', ')}...` }
  ]
}]);
```

### 3.5 Statistics Dashboard

**Files:**
- `src/services/stats.ts` - Stats queries
- `src/hooks/useStats.ts` - Stats hook
- `src/pages/Stats.tsx` - Stats UI

**Computed Stats:**
- Total zoos visited
- Total unique animals spotted
- Total photos taken
- Per-category breakdown
- Per-zoo completion rates
- Recent activity timeline

---

## Phase 4: Data Layer

### 4.1 Supabase Schema

Execute `supabase/migrations/001_initial_schema.sql` containing:
- `zoos` - Zoo metadata
- `zoo_animals` - LLM-generated animal lists
- `profiles` - User profiles (extends auth.users)
- `visits` - User zoo visits
- `sightings` - Animals spotted during visits

### 4.2 Row Level Security (RLS)

- Zoos: Public read for authenticated users
- Zoo animals: Public read for authenticated users
- Profiles: Read all, update own
- Visits: CRUD own only
- Sightings: CRUD own only

### 4.3 Storage Buckets

- `photos` - User-uploaded animal photos
- Public URLs for display
- Max 5MB per image
- Allowed types: jpg, png, webp

---

## Phase 5: Routing Structure

```typescript
const routes = [
  { path: '/login', element: <Login />, public: true },
  { path: '/auth/callback', element: <AuthCallback />, public: true },
  { path: '/', element: <Home /> },
  { path: '/zoo-select', element: <ZooSelect /> },
  { path: '/visit/:visitId', element: <Visit /> },
  { path: '/identify', element: <Identify /> },
  { path: '/stats', element: <Stats /> },
  { path: '/settings', element: <Settings /> },
];
```

---

## Phase 6: PWA Configuration

### 6.1 Manifest (public/manifest.json)

```json
{
  "name": "Zookeeper",
  "short_name": "Zookeeper",
  "description": "Track animals at every zoo you visit",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#faf6ed",
  "theme_color": "#1a3a1a",
  "icons": [
    { "src": "/logo-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/logo-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 6.2 Service Worker

- Precache static assets
- Cache API responses (zoo animals)
- Offline fallback page
- Background sync for sightings

---

## Phase 7: Implementation Order

### Week 1: Foundation
1. Project setup (Vite, Tailwind, dependencies)
2. Design system components
3. Supabase setup (auth, database, storage)
4. Authentication flow

### Week 2: Core Features
5. Zoo selection + search
6. Animal list generation (Gemini text)
7. Checklist UI + sighting management
8. Basic stats display

### Week 3: Camera & AI
9. Camera component
10. Gemini Vision integration
11. Identification result flow
12. Photo upload to Supabase Storage

### Week 4: Polish
13. PWA configuration
14. Loading states & error handling
15. Animations & transitions
16. Mobile testing & responsive fixes

---

## File Structure

```
zookeeper/
├── public/
│   ├── favicon.ico
│   ├── logo-192.png
│   ├── logo-512.png
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   └── Checkbox.tsx
│   │   ├── AnimalCard.tsx
│   │   ├── AnimalChecklist.tsx
│   │   ├── Camera.tsx
│   │   ├── IdentificationResult.tsx
│   │   ├── StatsCard.tsx
│   │   ├── VisitCard.tsx
│   │   └── ZooSearch.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCamera.ts
│   │   ├── useVisit.ts
│   │   └── useStats.ts
│   ├── lib/
│   │   ├── openrouter.ts
│   │   ├── supabase.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── AuthCallback.tsx
│   │   ├── Home.tsx
│   │   ├── ZooSelect.tsx
│   │   ├── Visit.tsx
│   │   ├── Identify.tsx
│   │   ├── Stats.tsx
│   │   └── Settings.tsx
│   ├── services/
│   │   ├── animals.ts
│   │   ├── identification.ts
│   │   ├── sightings.ts
│   │   ├── stats.ts
│   │   ├── visits.ts
│   │   └── zoos.ts
│   ├── stores/
│   │   └── useStore.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── demo-site/                    # Reference mockups
│   ├── home.html
│   ├── checklist.html
│   ├── identification.html
│   └── stats.html
├── .env.example
├── .env.local
├── .gitignore
├── index.html
├── LICENSE
├── package.json
├── PLAN.md
├── IMPLEMENTATION_PLAN.md
├── README.md
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Key Technical Decisions

### Why Zustand over Redux?
- Minimal boilerplate
- No actions/reducers complexity
- Perfect for this scope
- Easy persist middleware for offline

### Why TanStack Query?
- Automatic caching of zoo/animal data
- Background refetching
- Loading/error states built-in
- Optimistic updates for sightings

### Why OpenRouter?
- Single API key for multiple models
- Easy billing management
- Fallback model support
- Rate limiting handled

### Why Supabase?
- Auth + Database + Storage in one
- Generous free tier
- Real-time subscriptions (future)
- Row Level Security

---

## Critical Path Items

1. **OpenRouter API key** - Required for any LLM features
2. **Supabase project** - Required for auth and data
3. **Camera permissions** - Must handle denial gracefully
4. **Gemini model access** - Verify models available on OpenRouter
5. **Mobile viewport** - Must test on actual devices

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| LLM generates incorrect animal list | Lower temperature (0.3), allow manual correction |
| Vision model fails to identify | Always show manual selection fallback |
| Camera permission denied | Graceful fallback to manual-only mode |
| Supabase free tier limits | Optimize queries, lazy load images |
| Offline usage | Cache zoo data, queue sighting uploads |

---

*Last updated: December 30, 2025*
