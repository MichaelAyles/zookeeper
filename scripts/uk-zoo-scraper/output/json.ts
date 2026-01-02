// JSON Export Utility
// Exports scraped zoo and animal data to JSON for review

import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { Zoo, Animal } from '../types';

export interface ZooExport extends Zoo {
  animals: Animal[];
}

export interface ScraperOutput {
  generated_at: string;
  stats: {
    total_zoos: number;
    total_animals: number;
    zoos_with_coordinates: number;
    average_animals_per_zoo: number;
    sources: Record<string, number>;
    categories: Record<string, number>;
  };
  zoos: ZooExport[];
}

export async function exportToJson(
  zoos: Zoo[],
  animalsByZoo: Map<string, Animal[]>,
  outputPath: string,
  verbose = false
): Promise<ScraperOutput> {
  if (verbose) console.log(`📄 Exporting to ${outputPath}...`);

  // Build export data
  const zoosWithAnimals: ZooExport[] = zoos.map(zoo => ({
    ...zoo,
    animals: animalsByZoo.get(zoo.name) || [],
  }));

  // Calculate stats
  const totalAnimals = zoosWithAnimals.reduce((sum, z) => sum + z.animals.length, 0);
  const zoosWithCoords = zoos.filter(z => z.latitude && z.longitude).length;

  // Count by source
  const sources: Record<string, number> = {};
  for (const zoo of zoos) {
    for (const source of zoo.sources) {
      sources[source] = (sources[source] || 0) + 1;
    }
  }

  // Count by animal category
  const categories: Record<string, number> = {};
  for (const zoo of zoosWithAnimals) {
    for (const animal of zoo.animals) {
      categories[animal.category] = (categories[animal.category] || 0) + 1;
    }
  }

  const output: ScraperOutput = {
    generated_at: new Date().toISOString(),
    stats: {
      total_zoos: zoos.length,
      total_animals: totalAnimals,
      zoos_with_coordinates: zoosWithCoords,
      average_animals_per_zoo: Math.round(totalAnimals / zoos.length),
      sources,
      categories,
    },
    zoos: zoosWithAnimals.sort((a, b) => {
      // Sort by number of sources (most verified first), then by animal count
      if (b.sources.length !== a.sources.length) {
        return b.sources.length - a.sources.length;
      }
      return b.animals.length - a.animals.length;
    }),
  };

  // Ensure directory exists
  await mkdir(dirname(outputPath), { recursive: true });

  // Write file
  await writeFile(outputPath, JSON.stringify(output, null, 2));

  if (verbose) {
    console.log(`   ✅ Exported ${zoos.length} zoos with ${totalAnimals} animals`);
    console.log(`   📊 Stats:`);
    console.log(`      - Zoos with coordinates: ${zoosWithCoords}/${zoos.length}`);
    console.log(`      - Average animals per zoo: ${output.stats.average_animals_per_zoo}`);
    console.log(`      - Sources: ${Object.entries(sources).map(([k, v]) => `${k}(${v})`).join(', ')}`);
  }

  return output;
}

// Export a summary report (smaller file for quick review)
export async function exportSummary(
  zoos: Zoo[],
  animalsByZoo: Map<string, Animal[]>,
  outputPath: string,
  verbose = false
): Promise<void> {
  if (verbose) console.log(`📋 Exporting summary to ${outputPath}...`);

  const summary = zoos.map(zoo => {
    const animals = animalsByZoo.get(zoo.name) || [];
    return {
      name: zoo.name,
      city: zoo.city,
      sources: zoo.sources,
      hasCoordinates: !!(zoo.latitude && zoo.longitude),
      animalCount: animals.length,
      categories: Array.from(new Set(animals.map(a => a.category))),
      topAnimals: animals.slice(0, 5).map(a => a.commonName),
    };
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(summary, null, 2));

  if (verbose) {
    console.log(`   ✅ Exported summary for ${zoos.length} zoos`);
  }
}

// Export just the zoos (without animals) for quick testing
export async function exportZoosOnly(
  zoos: Zoo[],
  outputPath: string,
  verbose = false
): Promise<void> {
  if (verbose) console.log(`📍 Exporting zoos only to ${outputPath}...`);

  const output = {
    generated_at: new Date().toISOString(),
    count: zoos.length,
    zoos: zoos.sort((a, b) => a.name.localeCompare(b.name)),
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2));

  if (verbose) {
    console.log(`   ✅ Exported ${zoos.length} zoos`);
  }
}
