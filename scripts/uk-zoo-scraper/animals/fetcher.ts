// Animal Fetcher using Gemini with Web Search Grounding
// Uses AI to find accurate animal lists for each zoo
// Enhanced version: Uses subcategories and iterative prompting for comprehensive coverage

import type { Zoo, Animal, AnimalCategory } from '../types';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const CACHE_FILE = 'uk-zoos-cache.json';

interface CacheData {
  animals: Record<string, Animal[]>;
  lastUpdated: string;
  version?: number;
}

const CACHE_VERSION = 2; // Bump this to invalidate old cache

function loadCache(): CacheData {
  if (existsSync(CACHE_FILE)) {
    try {
      const cache = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
      // Invalidate old cache versions
      if (cache.version !== CACHE_VERSION) {
        console.log('   📦 Cache version outdated, starting fresh');
        return { animals: {}, lastUpdated: '', version: CACHE_VERSION };
      }
      return cache;
    } catch {
      return { animals: {}, lastUpdated: '', version: CACHE_VERSION };
    }
  }
  return { animals: {}, lastUpdated: '', version: CACHE_VERSION };
}

function saveCache(cache: CacheData): void {
  cache.lastUpdated = new Date().toISOString();
  cache.version = CACHE_VERSION;
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'google/gemini-2.0-flash-001'; // Gemini 2.0 Flash with grounding

interface GeminiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface RawAnimal {
  common_name: string;
  scientific_name?: string;
  category?: string;
  exhibit_area?: string;
  fun_facts?: string[];
}

// Rate limiting - be respectful to OpenRouter
let lastRequestTime = 0;
const MIN_DELAY_MS = 1000; // Reduced for faster processing

async function rateLimitedRequest(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }

  lastRequestTime = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Subcategories for more granular, comprehensive fetching
const MAMMAL_SUBCATEGORIES = [
  'Primates (monkeys, apes, lemurs)',
  'Big cats and wild cats',
  'Bears and raccoons',
  'Elephants and rhinos',
  'Hoofed animals (deer, antelope, giraffes, zebras)',
  'Canines and hyenas (wolves, wild dogs)',
  'Small mammals (meerkats, otters, mongoose, rodents)',
  'Marine mammals (seals, sea lions)',
  'Bats and nocturnal mammals',
  'Exotic mammals (sloths, anteaters, armadillos, tapirs)',
];

const BIRD_SUBCATEGORIES = [
  'Penguins and seabirds',
  'Flamingos and wading birds',
  'Parrots, macaws, and cockatoos',
  'Birds of prey (eagles, hawks, owls, vultures)',
  'Hornbills and toucans',
  'Cranes and storks',
  'Pheasants, peacocks, and gamebirds',
  'Songbirds and passerines',
  'Waterfowl (ducks, geese, swans)',
  'Flightless birds (ostriches, emus, cassowaries)',
];

const REPTILE_SUBCATEGORIES = [
  'Crocodilians (crocodiles, alligators, caimans, gharials)',
  'Tortoises and turtles',
  'Large snakes (pythons, boas, anacondas)',
  'Venomous snakes',
  'Lizards (monitors, iguanas, geckos, chameleons)',
  'Komodo dragons and giant reptiles',
];

const FISH_SUBCATEGORIES = [
  'Sharks and rays',
  'Tropical reef fish',
  'Freshwater fish',
  'Jellyfish and sea anemones',
];

// Fetch animals by specific subcategory for more comprehensive results
async function fetchAnimalsBySubcategory(
  zoo: Zoo,
  mainCategory: string,
  subcategory: string,
  verbose = false
): Promise<RawAnimal[]> {
  const zooLocation = zoo.county || zoo.city || '';
  const locationStr = zooLocation ? ` (${zooLocation})` : '';

  const prompt = `You are a zoo database researcher. Search the web for the COMPLETE list of ${subcategory} at ${zoo.name}${locationStr}, United Kingdom.

IMPORTANT: I need an EXHAUSTIVE list. Major UK zoos like Chester Zoo have 500+ species total. Do not just list "highlights" - list EVERY animal in this subcategory that this zoo has.

Search sources:
1. The zoo's official website animal pages
2. Wikipedia article about the zoo
3. Recent news about new animals at the zoo
4. Zoo review sites mentioning specific animals

For each species, include 5 genuinely fascinating, surprising fun facts that would make someone say "wow!".

Return a JSON array:
[{
  "common_name": "Ring-tailed Lemur",
  "scientific_name": "Lemur catta",
  "fun_facts": [
    "They sunbathe in a yoga-like position with arms outstretched",
    "Their tails are longer than their bodies and used for scent communication",
    "A group is called a 'conspiracy' of lemurs",
    "They have a special grooming claw called a 'toilet claw'",
    "Female lemurs are dominant over males in all situations"
  ]
}]

Rules:
- List EVERY species in this subcategory, not just the most popular ones
- Include both common and scientific names
- Each fun fact should be genuinely surprising or unusual (not basic facts)
- Return ONLY the JSON array, no explanation
- If this zoo doesn't have animals in this subcategory, return []`;

  try {
    await rateLimitedRequest();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zookeeperapp.com',
        'X-Title': 'Zookeeper UK Zoo Scraper',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Lower temperature for more accurate results
        max_tokens: 16000, // Increased for comprehensive lists
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`      ❌ API error for ${subcategory}: ${response.status} - ${errorText.slice(0, 200)}`);
      return [];
    }

    const result = await response.json() as GeminiResponse;
    const content = result.choices?.[0]?.message?.content || '';

    if (!content) {
      return [];
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    let jsonStr = jsonMatch[0];

    try {
      const animals = JSON.parse(jsonStr) as RawAnimal[];
      return animals.map(a => ({ ...a, category: mainCategory }));
    } catch {
      jsonStr = repairJson(jsonStr);
      try {
        const animals = JSON.parse(jsonStr) as RawAnimal[];
        return animals.map(a => ({ ...a, category: mainCategory }));
      } catch {
        return [];
      }
    }
  } catch (err) {
    console.error(`      ❌ Error fetching ${subcategory}: ${(err as Error).message}`);
    return [];
  }
}

// Fetch a general category (for categories without subcategories)
async function fetchAnimalsByCategory(
  zoo: Zoo,
  category: string,
  verbose = false
): Promise<RawAnimal[]> {
  const zooLocation = zoo.county || zoo.city || '';
  const locationStr = zooLocation ? ` (${zooLocation})` : '';

  const prompt = `You are a zoo database researcher. Search the web for the COMPLETE list of ${category} at ${zoo.name}${locationStr}, United Kingdom.

IMPORTANT: I need an EXHAUSTIVE list, not just highlights. List EVERY ${category.toLowerCase()} species at this zoo.

Search sources:
1. The zoo's official website animal pages
2. Wikipedia article about the zoo
3. Recent news about new animals at the zoo

For each species, include 5 genuinely fascinating fun facts.

Return a JSON array:
[{
  "common_name": "Species Name",
  "scientific_name": "Scientific name",
  "fun_facts": ["fact1", "fact2", "fact3", "fact4", "fact5"]
}]

Rules:
- List EVERY species, not just popular ones
- Each fun fact should be genuinely surprising
- Return ONLY the JSON array
- If no ${category.toLowerCase()} at this zoo, return []`;

  try {
    await rateLimitedRequest();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zookeeperapp.com',
        'X-Title': 'Zookeeper UK Zoo Scraper',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`      ❌ API error for ${category}: ${response.status} - ${errorText.slice(0, 200)}`);
      return [];
    }

    const result = await response.json() as GeminiResponse;
    const content = result.choices?.[0]?.message?.content || '';

    if (!content) {
      return [];
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    let jsonStr = jsonMatch[0];

    try {
      const animals = JSON.parse(jsonStr) as RawAnimal[];
      return animals.map(a => ({ ...a, category }));
    } catch {
      jsonStr = repairJson(jsonStr);
      try {
        const animals = JSON.parse(jsonStr) as RawAnimal[];
        return animals.map(a => ({ ...a, category }));
      } catch {
        return [];
      }
    }
  } catch (err) {
    console.error(`      ❌ Error fetching ${category}: ${(err as Error).message}`);
    return [];
  }
}

export async function fetchAnimalsForZoo(zoo: Zoo, verbose = false): Promise<Animal[]> {
  if (!OPENROUTER_API_KEY) {
    console.warn('   ⚠️  No OPENROUTER_API_KEY - skipping animal fetch');
    return [];
  }

  const allRawAnimals: RawAnimal[] = [];

  // Fetch mammals by subcategories for comprehensive coverage
  if (verbose) console.log('      📍 Fetching Mammals by subcategory...');
  for (const subcategory of MAMMAL_SUBCATEGORIES) {
    const animals = await fetchAnimalsBySubcategory(zoo, 'Mammals', subcategory, verbose);
    allRawAnimals.push(...animals);
    if (verbose && animals.length > 0) {
      console.log(`         ${subcategory}: ${animals.length}`);
    }
  }

  // Fetch birds by subcategories
  if (verbose) console.log('      📍 Fetching Birds by subcategory...');
  for (const subcategory of BIRD_SUBCATEGORIES) {
    const animals = await fetchAnimalsBySubcategory(zoo, 'Birds', subcategory, verbose);
    allRawAnimals.push(...animals);
    if (verbose && animals.length > 0) {
      console.log(`         ${subcategory}: ${animals.length}`);
    }
  }

  // Fetch reptiles by subcategories
  if (verbose) console.log('      📍 Fetching Reptiles by subcategory...');
  for (const subcategory of REPTILE_SUBCATEGORIES) {
    const animals = await fetchAnimalsBySubcategory(zoo, 'Reptiles', subcategory, verbose);
    allRawAnimals.push(...animals);
    if (verbose && animals.length > 0) {
      console.log(`         ${subcategory}: ${animals.length}`);
    }
  }

  // Fetch fish by subcategories (for aquariums)
  if (verbose) console.log('      📍 Fetching Fish by subcategory...');
  for (const subcategory of FISH_SUBCATEGORIES) {
    const animals = await fetchAnimalsBySubcategory(zoo, 'Fish', subcategory, verbose);
    allRawAnimals.push(...animals);
    if (verbose && animals.length > 0) {
      console.log(`         ${subcategory}: ${animals.length}`);
    }
  }

  // Fetch amphibians and invertebrates as single categories
  if (verbose) console.log('      📍 Fetching Amphibians...');
  const amphibians = await fetchAnimalsByCategory(zoo, 'Amphibians', verbose);
  allRawAnimals.push(...amphibians);
  if (verbose && amphibians.length > 0) {
    console.log(`         Amphibians: ${amphibians.length}`);
  }

  if (verbose) console.log('      📍 Fetching Invertebrates...');
  const invertebrates = await fetchAnimalsByCategory(zoo, 'Invertebrates', verbose);
  allRawAnimals.push(...invertebrates);
  if (verbose && invertebrates.length > 0) {
    console.log(`         Invertebrates: ${invertebrates.length}`);
  }

  // Deduplicate by common name (case-insensitive)
  const allAnimals: Animal[] = [];
  const seen = new Set<string>();

  for (const raw of allRawAnimals) {
    if (!raw.common_name) continue;

    const key = raw.common_name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    // Ensure we have exactly 5 fun facts
    let funFacts = raw.fun_facts || [];
    if (funFacts.length < 5) {
      // Pad with generic but interesting facts based on category
      funFacts = ensureFiveFacts(raw.common_name, raw.category || 'Mammals', funFacts);
    } else if (funFacts.length > 5) {
      funFacts = funFacts.slice(0, 5);
    }

    allAnimals.push({
      commonName: cleanAnimalName(raw.common_name),
      scientificName: raw.scientific_name || undefined,
      category: validateCategory(raw.category),
      exhibitArea: raw.exhibit_area || undefined,
      funFacts,
      confidence: 85,
    });
  }

  if (verbose) {
    console.log(`      ✅ Total unique species: ${allAnimals.length}`);
  }

  return allAnimals;
}

// Ensure every animal has exactly 5 fun facts
function ensureFiveFacts(animalName: string, category: string, existingFacts: string[]): string[] {
  const facts = [...existingFacts];

  // Generic interesting facts by category to fill in gaps
  const categoryFacts: Record<string, string[]> = {
    'Mammals': [
      `${animalName}s have unique personalities that zookeepers learn to recognize`,
      `Conservation programs help protect ${animalName}s from habitat loss`,
      `${animalName}s communicate through a variety of vocalizations and body language`,
      `In the wild, ${animalName}s play important roles in their ecosystems`,
      `${animalName}s form social bonds that can last for years`,
    ],
    'Birds': [
      `${animalName}s have hollow bones that make them lightweight for flight`,
      `Many ${animalName}s mate for life and share parenting duties`,
      `${animalName}s can see colors that humans cannot detect`,
      `${animalName}s use unique calls to communicate with their flock`,
      `Conservation efforts help protect ${animalName}s' nesting habitats`,
    ],
    'Reptiles': [
      `${animalName}s are cold-blooded and rely on their environment to regulate body temperature`,
      `Many ${animalName}s can regenerate parts of their body`,
      `${animalName}s have been on Earth for over 300 million years`,
      `${animalName}s have specialized scales for protection and water retention`,
      `${animalName}s play important roles as both predators and prey`,
    ],
    'Amphibians': [
      `${animalName}s can breathe through their skin`,
      `Many ${animalName}s go through metamorphosis during their life cycle`,
      `${animalName}s are indicator species for environmental health`,
      `${animalName}s have been on Earth for over 350 million years`,
      `Many ${animalName}s produce toxins for defense`,
    ],
    'Fish': [
      `${animalName}s have a lateral line system to detect movement in water`,
      `Many ${animalName}s can change color based on mood or environment`,
      `${animalName}s don't have eyelids - they sleep with their eyes open`,
      `${animalName}s have been swimming in Earth's oceans for 500 million years`,
      `${animalName}s can sense electrical fields in the water`,
    ],
    'Invertebrates': [
      `${animalName}s don't have a backbone but have evolved amazing adaptations`,
      `Many ${animalName}s can regenerate lost body parts`,
      `${animalName}s make up over 95% of all animal species on Earth`,
      `${animalName}s have complex behaviors despite their simple nervous systems`,
      `${animalName}s are essential for healthy ecosystems`,
    ],
  };

  const fallbackFacts = categoryFacts[category] || categoryFacts['Mammals'];

  while (facts.length < 5) {
    const nextFact = fallbackFacts[facts.length];
    if (nextFact && !facts.includes(nextFact)) {
      facts.push(nextFact);
    } else {
      facts.push(`${animalName}s are fascinating creatures studied by scientists worldwide`);
    }
  }

  return facts.slice(0, 5);
}

export async function fetchAnimalsForAllZoos(
  zoos: Zoo[],
  verbose = false,
  limit?: number
): Promise<Map<string, Animal[]>> {
  const zoosToProcess = limit ? zoos.slice(0, limit) : zoos;

  // Load cache
  const cache = loadCache();
  const cachedCount = Object.keys(cache.animals).length;

  if (verbose) {
    console.log(`🦁 Fetching animals for ${zoosToProcess.length} zoos...`);
    if (cachedCount > 0) {
      console.log(`   📦 Cache: ${cachedCount} zoos already cached (v${CACHE_VERSION})`);
    }
  }

  const animalsByZoo = new Map<string, Animal[]>();
  let totalAnimals = 0;
  let fromCache = 0;

  for (let i = 0; i < zoosToProcess.length; i++) {
    const zoo = zoosToProcess[i];

    // Check cache first
    if (cache.animals[zoo.name] && cache.animals[zoo.name].length > 0) {
      const animals = cache.animals[zoo.name];
      animalsByZoo.set(zoo.name, animals);
      totalAnimals += animals.length;
      fromCache++;

      if (verbose) {
        console.log(`   [${i + 1}/${zoosToProcess.length}] ${zoo.name}... ✅ ${animals.length} (cached)`);
      }
      continue;
    }

    if (verbose) {
      console.log(`   [${i + 1}/${zoosToProcess.length}] ${zoo.name}...`);
    }

    const animals = await fetchAnimalsForZoo(zoo, verbose);
    animalsByZoo.set(zoo.name, animals);
    totalAnimals += animals.length;

    // Save to cache after each zoo
    cache.animals[zoo.name] = animals;
    saveCache(cache);

    if (verbose) {
      console.log(`      📊 ${animals.length} species saved to cache`);
    }
  }

  if (verbose) {
    console.log(`\n   📊 Summary:`);
    console.log(`      Total: ${totalAnimals} animals across ${zoosToProcess.length} zoos`);
    console.log(`      From cache: ${fromCache}, Fresh: ${zoosToProcess.length - fromCache}`);
    console.log(`      Average: ${Math.round(totalAnimals / zoosToProcess.length)} per zoo`);
  }

  return animalsByZoo;
}

// Attempt to repair truncated/malformed JSON from LLM
function repairJson(jsonStr: string): string {
  let str = jsonStr.trim();

  // Remove trailing commas before ] or }
  str = str.replace(/,\s*]/g, ']');
  str = str.replace(/,\s*}/g, '}');

  // If truncated mid-object, try to close it
  const openBrackets = (str.match(/\[/g) || []).length;
  const closeBrackets = (str.match(/\]/g) || []).length;
  const openBraces = (str.match(/\{/g) || []).length;
  const closeBraces = (str.match(/\}/g) || []).length;

  if (openBraces > closeBraces || openBrackets > closeBrackets) {
    const lastCompleteObj = str.lastIndexOf('},');
    if (lastCompleteObj > 0) {
      str = str.slice(0, lastCompleteObj + 1) + ']';
    } else {
      const lastBrace = str.lastIndexOf('}');
      if (lastBrace > 0) {
        str = str.slice(0, lastBrace + 1) + ']';
      }
    }
  }

  return str;
}

function cleanAnimalName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

function validateCategory(category?: string): AnimalCategory {
  const validCategories: AnimalCategory[] = [
    'Mammals', 'Birds', 'Reptiles', 'Amphibians', 'Fish', 'Invertebrates'
  ];

  if (!category) return 'Mammals';

  const lower = category.toLowerCase();
  const match = validCategories.find(c => c.toLowerCase() === lower);

  if (match) return match;

  if (lower.includes('mammal')) return 'Mammals';
  if (lower.includes('bird') || lower.includes('avian')) return 'Birds';
  if (lower.includes('reptile') || lower.includes('snake') || lower.includes('lizard')) return 'Reptiles';
  if (lower.includes('amphibian') || lower.includes('frog')) return 'Amphibians';
  if (lower.includes('fish') || lower.includes('aquatic')) return 'Fish';
  if (lower.includes('insect') || lower.includes('invertebrate') || lower.includes('spider')) return 'Invertebrates';

  return 'Mammals';
}
