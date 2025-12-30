import { db, generateId } from '../lib/db';
import { generateText } from '../lib/openrouter';
import { extractJSON } from '../lib/utils';
import type { Zoo, ZooAnimal, GeneratedAnimal, AnimalCategory } from '../types';

// ============================================
// Animals Service - Swap-ready for Supabase
// ============================================

export async function getAnimalsByZoo(zooId: string): Promise<ZooAnimal[]> {
  return db.animals.where('zooId').equals(zooId).toArray();
}

export async function getAnimalById(id: string): Promise<ZooAnimal | undefined> {
  return db.animals.get(id);
}

export async function createAnimal(animal: Omit<ZooAnimal, 'id' | 'createdAt'>): Promise<ZooAnimal> {
  const newAnimal: ZooAnimal = {
    ...animal,
    id: generateId(),
    createdAt: new Date(),
  };
  await db.animals.add(newAnimal);
  return newAnimal;
}

export async function deleteAnimalsByZoo(zooId: string): Promise<void> {
  await db.animals.where('zooId').equals(zooId).delete();
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

    // Save to database
    const savedAnimals: ZooAnimal[] = [];
    for (const animal of animals) {
      const saved = await createAnimal({
        zooId: zoo.id,
        commonName: animal.common_name,
        scientificName: animal.scientific_name,
        category: animal.category as AnimalCategory,
        exhibitArea: animal.exhibit_area,
        funFact: animal.fun_fact,
      });
      savedAnimals.push(saved);
    }

    // Update zoo with generation timestamp
    await db.zoos.update(zoo.id, { animalsGeneratedAt: new Date() });

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
export async function refreshZooAnimals(zoo: Zoo): Promise<ZooAnimal[]> {
  await deleteAnimalsByZoo(zoo.id);
  return generateZooAnimals(zoo);
}
