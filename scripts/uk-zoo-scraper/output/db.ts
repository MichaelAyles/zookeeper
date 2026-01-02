// D1 Database Writer
// Writes scraped zoo and animal data to Cloudflare D1

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import type { Zoo, Animal } from '../types';

const execAsync = promisify(exec);

// Generate a unique ID
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

// Escape SQL string
function escapeSql(str: string | undefined): string {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

// Build INSERT statement for a zoo
function buildZooInsert(zoo: Zoo): { id: string; sql: string } {
  const id = generateId('zoo');

  const sql = `INSERT INTO zoos (id, name, city, country, latitude, longitude, website_url, animals_generated_at) VALUES (
    ${escapeSql(id)},
    ${escapeSql(zoo.name)},
    ${escapeSql(zoo.city)},
    ${escapeSql(zoo.country)},
    ${zoo.latitude ?? 'NULL'},
    ${zoo.longitude ?? 'NULL'},
    ${escapeSql(zoo.website)},
    ${escapeSql(new Date().toISOString())}
  );`;

  return { id, sql };
}

// Build INSERT statement for an animal
function buildAnimalInsert(animal: Animal, zooId: string): string {
  const id = generateId('animal');

  // Store funFacts array as JSON string
  const funFactsJson = animal.funFacts && animal.funFacts.length > 0
    ? JSON.stringify(animal.funFacts)
    : null;

  return `INSERT INTO animals (id, zoo_id, common_name, scientific_name, category, exhibit_area, fun_fact) VALUES (
    ${escapeSql(id)},
    ${escapeSql(zooId)},
    ${escapeSql(animal.commonName)},
    ${escapeSql(animal.scientificName)},
    ${escapeSql(animal.category)},
    ${escapeSql(animal.exhibitArea)},
    ${escapeSql(funFactsJson)}
  );`;
}

export interface WriteResult {
  zoosWritten: number;
  animalsWritten: number;
  errors: string[];
}

export async function writeToD1(
  zoos: Zoo[],
  animalsByZoo: Map<string, Animal[]>,
  options: {
    dbName?: string;
    clearExisting?: boolean;
    verbose?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<WriteResult> {
  const {
    dbName = 'zookeeper-db',
    clearExisting = false,
    verbose = false,
    dryRun = false,
  } = options;

  const result: WriteResult = {
    zoosWritten: 0,
    animalsWritten: 0,
    errors: [],
  };

  if (verbose) console.log(`🗄️  Writing to D1 database: ${dbName}...`);

  // Build all SQL statements
  const statements: string[] = [];

  // Optionally clear existing UK zoos
  if (clearExisting) {
    if (verbose) console.log('   Clearing existing UK zoos and animals...');
    statements.push(
      `-- Delete animals for UK zoos first (foreign key constraint)`,
      `DELETE FROM animals WHERE zoo_id IN (SELECT id FROM zoos WHERE country = 'United Kingdom');`,
      `-- Delete UK zoos`,
      `DELETE FROM zoos WHERE country = 'United Kingdom';`
    );
  }

  // Add zoos and animals
  const zooIdMap = new Map<string, string>();

  for (const zoo of zoos) {
    const { id, sql } = buildZooInsert(zoo);
    zooIdMap.set(zoo.name, id);
    statements.push(`-- Zoo: ${zoo.name}`);
    statements.push(sql);
    result.zoosWritten++;

    const animals = animalsByZoo.get(zoo.name) || [];
    for (const animal of animals) {
      statements.push(buildAnimalInsert(animal, id));
      result.animalsWritten++;
    }
  }

  const fullSql = statements.join('\n');

  if (dryRun) {
    // Write SQL to file for review
    const sqlPath = './uk-zoos-d1.sql';
    await writeFile(sqlPath, fullSql);
    if (verbose) {
      console.log(`   📝 Dry run - SQL written to ${sqlPath}`);
      console.log(`   Would write ${result.zoosWritten} zoos and ${result.animalsWritten} animals`);
    }
    return result;
  }

  // Execute via wrangler
  try {
    // Write SQL to temp file (wrangler d1 execute --file works better for large scripts)
    const tempFile = `/tmp/uk-zoos-${Date.now()}.sql`;
    await writeFile(tempFile, fullSql);

    if (verbose) console.log(`   Executing ${statements.length} SQL statements...`);

    const { stdout, stderr } = await execAsync(
      `npx wrangler d1 execute ${dbName} --file=${tempFile} --remote`,
      { cwd: process.cwd() }
    );

    if (stderr && !stderr.includes('Executing')) {
      result.errors.push(stderr);
    }

    // Cleanup temp file
    await unlink(tempFile).catch(() => {});

    if (verbose) {
      console.log(`   ✅ Wrote ${result.zoosWritten} zoos and ${result.animalsWritten} animals to D1`);
    }
  } catch (err) {
    const error = err as Error;
    result.errors.push(error.message);
    if (verbose) {
      console.error(`   ❌ D1 write failed:`, error.message);
    }
  }

  return result;
}

// Preview what would be written (for debugging)
export function generateSql(
  zoos: Zoo[],
  animalsByZoo: Map<string, Animal[]>
): string {
  const statements: string[] = [
    '-- UK Zoo Scraper D1 Import',
    `-- Generated at: ${new Date().toISOString()}`,
    `-- Zoos: ${zoos.length}`,
    '',
    '-- Clear existing UK zoos',
    `DELETE FROM animals WHERE zoo_id IN (SELECT id FROM zoos WHERE country = 'United Kingdom');`,
    `DELETE FROM zoos WHERE country = 'United Kingdom';`,
    '',
  ];

  for (const zoo of zoos) {
    const { id, sql } = buildZooInsert(zoo);
    statements.push(`-- ${zoo.name} (${zoo.city || 'Unknown city'})`);
    statements.push(sql);

    const animals = animalsByZoo.get(zoo.name) || [];
    if (animals.length > 0) {
      statements.push(`-- Animals for ${zoo.name}: ${animals.length}`);
      for (const animal of animals) {
        statements.push(buildAnimalInsert(animal, id));
      }
    }
    statements.push('');
  }

  return statements.join('\n');
}
