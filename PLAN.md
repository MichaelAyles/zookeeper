# Zookeeper - Project Plan

> **Hackathon:** Gemini 3 Hackathon (gemini3.devpost.com)
> **Deadline:** February 9, 2026 @ 5:00pm PST
> **Days Remaining:** 41 days
> **Prize Pool:** $100,000

---

## Executive Summary

Zookeeper is a mobile-first web app that transforms zoo visits into an interactive collection game. Users select or detect their current zoo, receive an AI-generated animal checklist, and tick off animals as they spot them - either manually or by pointing their camera for AI identification. The app tracks lifetime statistics across all zoo visits.

**Core Hook:** "Pokédex for real zoo animals"

---

## Technical Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | React 18 + Vite | Fast dev, PWA support, your girlfriend's team can read it |
| **Styling** | Tailwind CSS | Rapid iteration, consistent design |
| **State** | Zustand | Simple, no boilerplate |
| **Data Fetching** | TanStack Query | Caching, background refresh |
| **Backend** | Supabase | Auth, Postgres, Storage - all-in-one, generous free tier |
| **LLM Gateway** | OpenRouter | Single API for multiple models, easy billing |
| **Text Model** | `google/gemini-3-flash-preview` | Zoo animal list generation |
| **Vision Model** | `google/gemini-2.5-flash-image` | Animal photo identification |
| **Hosting** | Vercel | Free tier, instant deploys, edge functions |
| **PWA** | vite-plugin-pwa | Installable app, home screen icon |

---

## OpenRouter Configuration

```bash
# .env.local
VITE_OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx
VITE_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
VITE_TEXT_MODEL=google/gemini-3-flash-preview
VITE_IMAGE_MODEL=google/gemini-2.5-flash-image
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxx
```

### OpenRouter API Usage

```typescript
// lib/openrouter.ts
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
}

export async function chatCompletion(
  model: string,
  messages: OpenRouterMessage[],
  options?: { max_tokens?: number; temperature?: number }
): Promise<string> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Zookeeper"
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options?.max_tokens ?? 4096,
      temperature: options?.temperature ?? 0.7
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// Vision request helper
export async function identifyAnimal(
  imageBase64: string,
  candidateAnimals: string[]
): Promise<{ animal: string | null; confidence: number; funFact?: string }> {
  const response = await chatCompletion(
    import.meta.env.VITE_IMAGE_MODEL,
    [{
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
        },
        {
          type: "text",
          text: `Identify the animal in this photo. It should be one of these: ${candidateAnimals.join(", ")}.
          
Return ONLY valid JSON in this exact format:
{"animal": "Animal Name", "confidence": 0.95, "funFact": "One interesting fact about this animal"}

If you cannot identify the animal or it's not in the list, return:
{"animal": null, "confidence": 0}`
        }
      ]
    }]
  );

  return JSON.parse(response);
}
```

---

## Data Model

### Supabase Schema

```sql
-- Enable PostGIS for location queries (optional, for future geofencing)
-- create extension if not exists postgis;

-- ============================================
-- ZOOS
-- ============================================
create table public.zoos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  country text not null,
  latitude double precision,
  longitude double precision,
  website_url text,
  animals_generated_at timestamptz,
  created_at timestamptz default now()
);

-- Index for search
create index zoos_name_idx on public.zoos using gin (to_tsvector('english', name));

-- ============================================
-- ZOO ANIMALS (LLM-generated, cached)
-- ============================================
create table public.zoo_animals (
  id uuid primary key default gen_random_uuid(),
  zoo_id uuid references public.zoos(id) on delete cascade,
  common_name text not null,
  scientific_name text,
  category text, -- 'Mammals', 'Birds', 'Reptiles', 'Amphibians', 'Fish', 'Invertebrates'
  exhibit_area text,
  fun_fact text,
  image_url text, -- optional: could fetch from Wikipedia
  created_at timestamptz default now()
);

create index zoo_animals_zoo_idx on public.zoo_animals(zoo_id);

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- VISITS (a user's trip to a zoo)
-- ============================================
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  zoo_id uuid references public.zoos(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  notes text
);

create index visits_user_idx on public.visits(user_id);
create index visits_zoo_idx on public.visits(zoo_id);

-- ============================================
-- SIGHTINGS (animals seen during a visit)
-- ============================================
create table public.sightings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete cascade,
  zoo_animal_id uuid references public.zoo_animals(id) on delete cascade,
  seen_at timestamptz default now(),
  photo_url text,
  ai_identified boolean default false,
  ai_confidence double precision,
  notes text,
  
  -- Prevent duplicate sightings of same animal in same visit
  unique(visit_id, zoo_animal_id)
);

create index sightings_visit_idx on public.sightings(visit_id);
create index sightings_user_idx on public.sightings(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.zoos enable row level security;
alter table public.zoo_animals enable row level security;
alter table public.profiles enable row level security;
alter table public.visits enable row level security;
alter table public.sightings enable row level security;

-- Zoos: readable by all authenticated users
create policy "Zoos are viewable by authenticated users" on public.zoos
  for select using (auth.role() = 'authenticated');

-- Zoo animals: readable by all authenticated users
create policy "Zoo animals are viewable by authenticated users" on public.zoo_animals
  for select using (auth.role() = 'authenticated');

-- Profiles: users can read all, but only update their own
create policy "Profiles are viewable by authenticated users" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Visits: users can only see/manage their own
create policy "Users can view own visits" on public.visits
  for select using (auth.uid() = user_id);

create policy "Users can create own visits" on public.visits
  for insert with check (auth.uid() = user_id);

create policy "Users can update own visits" on public.visits
  for update using (auth.uid() = user_id);

-- Sightings: users can only see/manage their own
create policy "Users can view own sightings" on public.sightings
  for select using (auth.uid() = user_id);

create policy "Users can create own sightings" on public.sightings
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own sightings" on public.sightings
  for delete using (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user stats
create or replace function public.get_user_stats(p_user_id uuid)
returns json as $$
  select json_build_object(
    'total_zoos_visited', (select count(distinct zoo_id) from visits where user_id = p_user_id),
    'total_animals_spotted', (select count(distinct zoo_animal_id) from sightings where user_id = p_user_id),
    'total_photos', (select count(*) from sightings where user_id = p_user_id and photo_url is not null),
    'total_visits', (select count(*) from visits where user_id = p_user_id)
  );
$$ language sql security definer;

-- Get visit progress (for checklist)
create or replace function public.get_visit_progress(p_visit_id uuid)
returns table (
  zoo_animal_id uuid,
  common_name text,
  scientific_name text,
  category text,
  exhibit_area text,
  fun_fact text,
  seen boolean,
  photo_url text,
  seen_at timestamptz
) as $$
  select 
    za.id as zoo_animal_id,
    za.common_name,
    za.scientific_name,
    za.category,
    za.exhibit_area,
    za.fun_fact,
    s.id is not null as seen,
    s.photo_url,
    s.seen_at
  from zoo_animals za
  join visits v on v.zoo_id = za.zoo_id
  left join sightings s on s.zoo_animal_id = za.id and s.visit_id = p_visit_id
  where v.id = p_visit_id
  order by za.category, za.common_name;
$$ language sql security definer;
```

---

## Feature Breakdown

### MVP Features (Must Ship)

#### 1. Authentication
- **Method:** Supabase Magic Link (email)
- **Why:** Zero friction, no password to forget
- **Screens:** Login/Signup (single screen), simple email input

#### 2. Zoo Selection
- **Method:** Search + dropdown from pre-seeded list
- **Data:** Start with ~50 popular zoos pre-loaded
- **UX:** Type to search, tap to select
- **Future:** "Add a zoo" flow for unlisted zoos

#### 3. Animal List Generation
- **Trigger:** When user selects a zoo that has no animals cached
- **Model:** `google/gemini-3-flash-preview` via OpenRouter
- **Caching:** Store in Supabase `zoo_animals` table
- **Refresh:** Manual button, or auto after 90 days

```typescript
// services/generateAnimals.ts
export async function generateZooAnimals(zooName: string, country: string): Promise<ZooAnimal[]> {
  const prompt = `You are a zoo animal database. List all animals currently on display at ${zooName} in ${country}.

Return ONLY a valid JSON array with this exact format (no markdown, no explanation):
[
  {
    "common_name": "African Elephant",
    "scientific_name": "Loxodonta africana",
    "category": "Mammals",
    "exhibit_area": "African Savanna",
    "fun_fact": "Elephants can recognize themselves in mirrors."
  }
]

Categories must be one of: Mammals, Birds, Reptiles, Amphibians, Fish, Invertebrates

Include 30-80 animals depending on zoo size. Only include animals you're confident are actually at this zoo.`;

  const response = await chatCompletion(
    import.meta.env.VITE_TEXT_MODEL,
    [{ role: "user", content: prompt }],
    { temperature: 0.3 } // Lower temperature for factual accuracy
  );

  return JSON.parse(response);
}
```

#### 4. Visit & Checklist
- **Start Visit:** User taps "I'm here!" on zoo page
- **Checklist:** Grouped by category (Mammals, Birds, etc.)
- **Interactions:**
  - Tap checkbox to mark seen
  - Tap camera icon to photograph
  - Swipe/tap to see fun fact
- **Progress:** "12 of 47 animals spotted" with progress bar

#### 5. Camera & AI Identification
- **Capture:** Use device camera (rear-facing)
- **Flow:**
  1. User taps camera button
  2. Takes photo
  3. Photo sent to Gemini Vision via OpenRouter
  4. AI returns best match from zoo's animal list
  5. User confirms or corrects
  6. Sighting recorded with photo
- **Model:** `google/gemini-2.5-flash-image`

#### 6. Statistics Dashboard
- **Lifetime Stats:**
  - Zoos visited (with list)
  - Unique animals spotted
  - Photos taken
  - Total visits
- **Per-Zoo Stats:**
  - Completion percentage
  - Last visited
  - Animals remaining

#### 7. Basic PWA
- **Installable:** Add to home screen prompt
- **Icon:** Zoo-themed logo
- **Splash:** Branded loading screen

---

### Post-MVP Features (If Time Permits)

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Geolocation auto-detect zoo | 3 days | High | P2 |
| Offline mode (IndexedDB) | 4 days | Medium | P3 |
| Animal photos from Wikipedia | 2 days | Medium | P2 |
| Share visit summary | 1 day | Low | P3 |
| Achievements/badges | 2 days | Medium | P3 |
| "Rarest animal" leaderboard | 2 days | Low | P4 |

---

## UI/UX Design

### Screen Map

```
┌─────────────────────────────────────────────────────────────┐
│                        SCREENS                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Login] ─────► [Home] ─────► [Zoo Select] ─────► [Visit]   │
│                   │                                  │       │
│                   │                                  ▼       │
│                   │                            [Checklist]   │
│                   │                                  │       │
│                   │                                  ▼       │
│                   │                             [Camera]     │
│                   │                                          │
│                   ▼                                          │
│               [Stats]                                        │
│                   │                                          │
│                   ▼                                          │
│            [Zoo History]                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Screens

#### Home (Logged In)
```
┌────────────────────────────────┐
│  🦁 Zookeeper                  │
├────────────────────────────────┤
│                                │
│  Welcome back, Sarah!          │
│                                │
│  ┌────────────────────────┐   │
│  │  🎯 Current Visit       │   │
│  │  Chester Zoo            │   │
│  │  12/47 animals spotted  │   │
│  │  ████████░░░░░░ 25%     │   │
│  │  [Continue Visit]       │   │
│  └────────────────────────┘   │
│                                │
│  ── or ──                      │
│                                │
│  [🏛️ Start New Visit]          │
│                                │
├────────────────────────────────┤
│  📊 Your Stats                 │
│  5 zoos · 127 animals · 43 📸 │
│                                │
└────────────────────────────────┘
│ 🏠 Home │ 📊 Stats │ ⚙️ Settings │
└────────────────────────────────┘
```

#### Checklist
```
┌────────────────────────────────┐
│ ← Chester Zoo        12/47 🔍 │
├────────────────────────────────┤
│ [All] [Seen] [Remaining]       │
├────────────────────────────────┤
│                                │
│ 🦁 MAMMALS (8/23)              │
│ ┌────────────────────────────┐ │
│ │ ☑️ African Elephant     📷 │ │
│ │ ☑️ Red Panda            📷 │ │
│ │ ☐ Sumatran Tiger        📷 │ │
│ │ ☐ Asian Lion            📷 │ │
│ └────────────────────────────┘ │
│                                │
│ 🦅 BIRDS (3/15)                │
│ ┌────────────────────────────┐ │
│ │ ☑️ Flamingo             📷 │ │
│ │ ☐ Penguin               📷 │ │
│ └────────────────────────────┘ │
│                                │
└────────────────────────────────┘
│        [📸 Identify Animal]    │
└────────────────────────────────┘
```

#### Camera/Identification
```
┌────────────────────────────────┐
│ ×                    [Flip] 🔄 │
├────────────────────────────────┤
│                                │
│                                │
│      ┌──────────────────┐      │
│      │                  │      │
│      │   📷 VIEWFINDER  │      │
│      │                  │      │
│      │                  │      │
│      └──────────────────┘      │
│                                │
│  Point at an animal and tap    │
│                                │
├────────────────────────────────┤
│         [ 🔴 CAPTURE ]         │
└────────────────────────────────┘

-- After capture --

┌────────────────────────────────┐
│        🎉 Spotted!             │
├────────────────────────────────┤
│      ┌──────────────────┐      │
│      │   [Photo]        │      │
│      └──────────────────┘      │
│                                │
│   🦁 African Lion              │
│   Panthera leo                 │
│   95% confidence               │
│                                │
│   "Lions are the only cats     │
│    that live in groups."       │
│                                │
├────────────────────────────────┤
│ [✓ Confirm]  [✎ Wrong Animal] │
└────────────────────────────────┘
```

### Design Tokens

```css
/* Colors - Safari/Zoo themed */
:root {
  --color-primary: #2D5A27;      /* Forest green */
  --color-secondary: #8B4513;    /* Saddle brown */
  --color-accent: #F4A460;       /* Sandy brown */
  --color-background: #FFF9F0;   /* Warm cream */
  --color-surface: #FFFFFF;
  --color-text: #1A1A1A;
  --color-text-muted: #666666;
  --color-success: #22C55E;
  --color-error: #EF4444;
  
  /* Category colors */
  --color-mammals: #8B4513;
  --color-birds: #4A90D9;
  --color-reptiles: #22C55E;
  --color-amphibians: #9333EA;
  --color-fish: #06B6D4;
  --color-invertebrates: #F97316;
}

/* Typography */
--font-display: 'Fredoka', sans-serif;  /* Playful headers */
--font-body: 'Inter', sans-serif;        /* Clean body text */
```

### Logo Specification

```
     Z  🔍  OKEEPER
        ↑
   Magnifying glass replaces first 'O'
   - Glass shows paw print or animal silhouette inside
   - Handle extends down-right at 45°
   
   Colors:
   - "Z" and "KEEPER": Forest green (#2D5A27)
   - Magnifying glass: Sandy brown rim (#F4A460)
   - Glass interior: Light blue tint
   - Paw print: Brown (#8B4513)
```

---

## Project Structure

```
zookeeper/
├── public/
│   ├── favicon.ico
│   ├── logo-192.png
│   ├── logo-512.png
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── ui/                    # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── Spinner.tsx
│   │   ├── AnimalCard.tsx         # Single animal in checklist
│   │   ├── AnimalChecklist.tsx    # Full checklist with categories
│   │   ├── Camera.tsx             # Camera capture component
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
│   │   ├── openrouter.ts          # OpenRouter API client
│   │   ├── supabase.ts            # Supabase client
│   │   └── utils.ts
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Home.tsx
│   │   ├── ZooSelect.tsx
│   │   ├── Visit.tsx              # Active visit with checklist
│   │   ├── Stats.tsx
│   │   └── Settings.tsx
│   ├── services/
│   │   ├── animals.ts             # Animal list generation
│   │   ├── identification.ts      # Photo identification
│   │   ├── visits.ts              # Visit CRUD
│   │   └── zoos.ts                # Zoo CRUD
│   ├── stores/
│   │   └── useStore.ts            # Zustand store
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.local
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── PLAN.md                        # This file
```

---

## Development Schedule

### Week 1: Foundation (Dec 30 - Jan 5)
| Day | Tasks | Owner |
|-----|-------|-------|
| Mon 30 | Project setup, Supabase schema, OpenRouter integration | Dev |
| Tue 31 | Auth flow (magic link), basic routing | Dev |
| Wed 1 | Zoo selection UI, seed 50 popular zoos | Dev |
| Thu 2 | Animal list generation via Gemini | Dev |
| Fri 3 | Checklist UI (no camera yet) | Dev |
| Sat 4 | Polish checklist, add/remove sightings | Dev |
| Sun 5 | **Milestone: Can select zoo, see animals, tick off** | - |

### Week 2: Camera & AI (Jan 6 - Jan 12)
| Day | Tasks | Owner |
|-----|-------|-------|
| Mon 6 | Camera component (capture photo) | Dev |
| Tue 7 | Gemini Vision integration | Dev |
| Wed 8 | Identification result UI, confirm/correct flow | Dev |
| Thu 9 | Photo storage (Supabase Storage) | Dev |
| Fri 10 | Stats dashboard | Dev |
| Sat 11 | Polish stats, per-zoo completion | Dev |
| Sun 12 | **Milestone: Full loop working - photo → identify → save** | - |

### Week 3: Polish & PWA (Jan 13 - Jan 19)
| Day | Tasks | Owner |
|-----|-------|-------|
| Mon 13 | PWA setup (manifest, icons, install prompt) | Dev |
| Tue 14 | Logo design, branding pass | Design |
| Wed 15 | UI polish, animations, loading states | Dev |
| Thu 16 | Error handling, edge cases | Dev |
| Fri 17 | Mobile testing, responsive fixes | Dev |
| Sat 18 | Bug fixes, performance | Dev |
| Sun 19 | **Milestone: App feels complete and polished** | - |

### Week 4: Demo & Submission (Jan 20 - Jan 26)
| Day | Tasks | Owner |
|-----|-------|-------|
| Mon 20 | Write demo script | Dev |
| Tue 21 | Record demo video (draft 1) | Dev |
| Wed 22 | Re-record demo video (final) | Dev |
| Thu 23 | Write project description (~200 words) | Dev |
| Fri 24 | Screenshots, submission assets | Dev |
| Sat 25 | Submit to Devpost | Dev |
| Sun 26 | **Milestone: Submitted!** | - |

### Week 5-6: Buffer (Jan 27 - Feb 9)
- Fix any issues found
- Add bonus features if time
- Re-submit if needed (allowed until deadline)

---

## Demo Video Script (3 minutes)

### Opening (0:00 - 0:20)
*Screen recording of phone*

"Meet Zookeeper - an app that turns every zoo visit into an adventure. Let me show you how it works."

### Zoo Selection (0:20 - 0:45)
*Show zoo search and selection*

"First, I search for my zoo - Chester Zoo. The app uses Gemini 3 to automatically generate a checklist of every animal at this zoo. This list is cached, so it's instant for future visitors."

### The Checklist (0:45 - 1:15)
*Show checklist, scroll through categories*

"Here's my checklist - 47 animals across mammals, birds, reptiles, and more. I can tap to mark animals as seen, or filter to see what I'm still looking for."

### AI Identification (1:15 - 2:00)
*Show camera capture and identification*

"But here's where it gets fun. I point my camera at an animal..."

*Capture photo*

"...and Gemini's vision model identifies it instantly. 'African Elephant - 97% confidence.' It even gives me a fun fact. I confirm, and it's added to my collection with the photo."

### Statistics (2:00 - 2:30)
*Show stats dashboard*

"Over time, I build up my collection. I can see how many zoos I've visited, how many unique species I've spotted, and my completion rate for each zoo. It's like Pokémon Go, but for real animals."

### Closing (2:30 - 3:00)
*Show app icon, logo*

"Zookeeper - built with Gemini 3 for the Gemini 3 Hackathon. Thanks for watching!"

---

## Submission Checklist

- [ ] **Working demo URL** (Vercel deployment)
- [ ] **Public GitHub repo** with README
- [ ] **Demo video** (~3 minutes, YouTube/Vimeo)
- [ ] **Project description** (~200 words)
- [ ] **Screenshots** (at least 3)
- [ ] **Gemini integration explanation** (which features, how used)

### 200-Word Description (Draft)

> **Zookeeper** transforms zoo visits into an interactive wildlife collection game.
>
> **The Problem:** Zoo visits are passive experiences. Families walk through, see animals, and forget most of them by the time they leave. There's no way to track what you've seen across multiple zoo visits.
>
> **The Solution:** Zookeeper gives every zoo visitor a personalized checklist. Select your zoo, and Gemini 3 instantly generates a complete animal roster. As you explore, tick off animals manually or point your camera - Gemini's vision model identifies the species in real-time and adds it to your collection with a photo.
>
> **Gemini 3 Integration:**
> - **Text generation** (`gemini-3-flash-preview`): Generates accurate, up-to-date animal lists for any zoo worldwide
> - **Vision** (`gemini-2.5-flash-image`): Real-time animal identification from user photos, matched against the zoo's known species
>
> **Features:**
> - Works with any zoo globally
> - AI-powered photo identification
> - Lifetime statistics across all visits
> - Fun facts for every animal
> - Mobile-first PWA (installable)
>
> Zookeeper makes every zoo visit memorable and turns wildlife observation into an engaging collection game for families and animal lovers.

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gemini API rate limits | Medium | High | Cache aggressively, batch requests |
| Animal list inaccuracy | Medium | Medium | Lower temperature, validate JSON, allow manual correction |
| Photo ID failures | Medium | Low | Always allow manual selection fallback |
| Supabase free tier limits | Low | Medium | Optimize queries, clean up test data |
| Camera permissions denied | Medium | Medium | Graceful fallback to manual mode |
| Demo video quality | Low | Medium | Record multiple takes, practice script |

---

## Success Metrics

### For Hackathon
- [ ] Working demo that doesn't crash
- [ ] Judges can actually use it
- [ ] Clear Gemini 3 integration visible
- [ ] Video is watchable and shows value prop

### For Product (Post-Hackathon)
- Active users at 3+ different zoos
- 50%+ checklist completion rate per visit
- Photo identification accuracy >80%
- User returns for second zoo visit

---

## Open Questions

1. **Zoo data source:** Pre-seed with top 50 zoos, or let users add any zoo?
   - *Decision:* Pre-seed top 50, add "Request a zoo" for others

2. **Photo storage:** Supabase Storage or external (Cloudflare R2)?
   - *Decision:* Start with Supabase, migrate if needed

3. **Offline support:** Worth the complexity for MVP?
   - *Decision:* No, cut for MVP. Zoos usually have WiFi.

4. **Monetization:** Free forever or freemium?
   - *Decision:* Not relevant for hackathon, decide later

---

## Resources

- [Gemini 3 Hackathon Rules](https://gemini3.devpost.com/rules)
- [OpenRouter Docs](https://openrouter.ai/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## Contact

- **Project Lead:** [Your girlfriend's name]
- **Developer:** Mike
- **Hackathon Page:** https://gemini3.devpost.com/

---

*Last updated: December 30, 2025*
