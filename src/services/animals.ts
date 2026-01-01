import { api } from '../lib/api';
import { generateText } from '../lib/openrouter';
import { extractJSON } from '../lib/utils';
import type { Zoo, ZooAnimal, GeneratedAnimal, AnimalCategory } from '../types';

// ============================================
// Animals Service - Cloudflare D1 via API
// ============================================

export async function getAnimalsByZoo(zooId: string): Promise<ZooAnimal[]> {
  return api.get<ZooAnimal[]>(`/api/zoos/${zooId}/animals`);
}

export async function getAnimalById(_id: string): Promise<ZooAnimal | undefined> {
  // This would need a dedicated endpoint, for now fetch all and filter
  // In practice, we usually have the animal from the list already
  return undefined;
}

export async function createAnimal(
  zooId: string,
  animal: Omit<ZooAnimal, 'id' | 'createdAt' | 'zooId'>
): Promise<ZooAnimal> {
  return api.post<ZooAnimal>(`/api/zoos/${zooId}/animals`, animal);
}

// Generate animal list for a zoo using Gemini
export async function generateZooAnimals(zoo: Zoo): Promise<ZooAnimal[]> {
  const prompt = `You are a zoo animal database. List all animals currently on display at ${zoo.name} in ${zoo.country}.

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

Include 30-60 animals depending on zoo size. Only include animals you're confident are actually at this zoo.`;

  try {
    const response = await generateText(prompt, { temperature: 0.3 });
    const animals = extractJSON<GeneratedAnimal[]>(response, []);

    if (!animals.length) {
      throw new Error('No animals generated');
    }

    // Save to database via API
    const savedAnimals: ZooAnimal[] = [];
    for (const animal of animals) {
      const saved = await createAnimal(zoo.id, {
        commonName: animal.common_name,
        scientificName: animal.scientific_name,
        category: animal.category as AnimalCategory,
        exhibitArea: animal.exhibit_area,
        funFact: animal.fun_fact,
      });
      savedAnimals.push(saved);
    }

    return savedAnimals;
  } catch (error) {
    console.error('Failed to generate animals:', error);
    throw error;
  }
}

// Get or generate animals for a zoo
export async function getOrGenerateAnimals(zoo: Zoo): Promise<ZooAnimal[]> {
  const existing = await getAnimalsByZoo(zoo.id);

  if (existing.length > 0) {
    return existing;
  }

  return generateZooAnimals(zoo);
}

// Refresh animal list (delete and regenerate)
// Note: This now just regenerates - existing animals will be kept
// Server-side could handle deletion if needed
export async function refreshZooAnimals(zoo: Zoo): Promise<ZooAnimal[]> {
  return generateZooAnimals(zoo);
}
