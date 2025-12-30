import { analyzeImage } from '../lib/openrouter';
import { extractJSON } from '../lib/utils';
import type { ZooAnimal, IdentificationResult } from '../types';

// ============================================
// Identification Service - Gemini Vision
// ============================================

export async function identifyAnimal(
  imageBase64: string,
  candidateAnimals: ZooAnimal[]
): Promise<IdentificationResult> {
  const animalNames = candidateAnimals.map(a => a.commonName);

  const prompt = `Identify the animal in this photo. It should be one of these animals from the zoo: ${animalNames.join(', ')}.

Return ONLY valid JSON in this exact format:
{"animal": "Animal Name", "confidence": 0.95, "funFact": "One interesting fact about this animal"}

Rules:
- "animal" must exactly match one of the names provided above
- "confidence" must be a number between 0 and 1
- "funFact" should be a short, interesting fact about the identified animal

If you cannot identify the animal or it's not in the list, return:
{"animal": null, "confidence": 0}`;

  try {
    const response = await analyzeImage(imageBase64, prompt, { temperature: 0.3 });
    const result = extractJSON<IdentificationResult>(response, { animal: null, confidence: 0 });

    // Validate the animal name matches our list
    if (result.animal) {
      const matchedAnimal = candidateAnimals.find(
        a => a.commonName.toLowerCase() === result.animal?.toLowerCase()
      );
      if (!matchedAnimal) {
        // Try fuzzy match
        const fuzzyMatch = candidateAnimals.find(a =>
          a.commonName.toLowerCase().includes(result.animal?.toLowerCase() || '') ||
          result.animal?.toLowerCase().includes(a.commonName.toLowerCase())
        );
        if (fuzzyMatch) {
          result.animal = fuzzyMatch.commonName;
        } else {
          result.animal = null;
          result.confidence = 0;
        }
      } else {
        result.animal = matchedAnimal.commonName;
      }
    }

    return result;
  } catch (error) {
    console.error('Identification failed:', error);
    return { animal: null, confidence: 0 };
  }
}

// Find animal by name in list
export function findAnimalByName(
  name: string,
  animals: ZooAnimal[]
): ZooAnimal | undefined {
  return animals.find(
    a => a.commonName.toLowerCase() === name.toLowerCase()
  );
}
