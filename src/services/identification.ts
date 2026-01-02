import { api } from '../lib/api';
import type { ZooAnimal, IdentificationResult } from '../types';

// ============================================
// Identification Service - Backend API
// ============================================

export async function identifyAnimal(
  imageData: string,
  candidateAnimals: ZooAnimal[]
): Promise<IdentificationResult> {
  const animalNames = candidateAnimals.map(a => a.commonName);

  try {
    const result = await api.post<IdentificationResult>('/api/identify', {
      imageData,
      candidateAnimals: animalNames,
    });

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
