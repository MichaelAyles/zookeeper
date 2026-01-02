#!/usr/bin/env npx tsx
// UK Zoo Scraper - Comprehensive UK Zoo & Animal Database Builder
//
// Usage:
//   npx tsx scripts/uk-zoo-scraper/index.ts [options]
//
// Options:
//   --dry-run          Don't write to DB, just output JSON
//   --skip-animals     Skip animal fetching (zoos only)
//   --skip-geocode     Skip geocoding
//   --source=<source>  Only use specific source (wikipedia, biaza, google)
//   --zoo="<name>"     Only process zoos matching name
//   --limit=<n>        Only process first N zoos
//   --output=<file>    Export to JSON file (default: uk-zoos.json)
//   --verbose          Verbose output
//   --write-db         Write to D1 database (requires wrangler auth)

import type { ScraperOptions, Zoo, Animal } from './types';
import { scrapeWikipedia } from './sources/wikipedia';
import { scrapeBiaza } from './sources/biaza';
import { searchForZoos } from './sources/google';
import { dedupeZoos, sortZoosByQuality } from './utils/dedupe';
import { geocodeAllZoos, applyGeocodingToZoos } from './utils/geocode';
import { fetchAnimalsForAllZoos } from './animals/fetcher';
import { exportToJson, exportZoosOnly } from './output/json';
import { writeToD1 } from './output/db';

// Parse command line arguments
function parseArgs(): ScraperOptions & { writeDb: boolean } {
  const args = process.argv.slice(2);
  const options: ScraperOptions & { writeDb: boolean } = {
    verbose: false,
    writeDb: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--skip-animals') {
      options.skipAnimals = true;
    } else if (arg === '--skip-geocode') {
      // New option
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--write-db') {
      options.writeDb = true;
    } else if (arg.startsWith('--source=')) {
      const source = arg.split('=')[1] as 'wikipedia' | 'biaza' | 'google';
      if (['wikipedia', 'biaza', 'google'].includes(source)) {
        options.source = source;
      }
    } else if (arg.startsWith('--zoo=')) {
      options.zooFilter = arg.split('=')[1].replace(/"/g, '');
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--output=')) {
      options.outputFile = arg.split('=')[1];
    }
  }

  return options;
}

async function main() {
  const startTime = Date.now();
  const options = parseArgs();
  const verbose = options.verbose ?? true; // Default to verbose

  console.log('🦁 UK Zoo Scraper');
  console.log('================\n');

  // Step 1: Collect zoos from all sources
  console.log('📥 Step 1: Collecting zoos from sources...\n');

  const allRawZoos: Awaited<ReturnType<typeof scrapeWikipedia>> = [];

  // Wikipedia
  if (!options.source || options.source === 'wikipedia') {
    try {
      const wikiZoos = await scrapeWikipedia(verbose);
      allRawZoos.push(...wikiZoos);
    } catch (err) {
      console.error('   ❌ Wikipedia scrape failed:', (err as Error).message);
    }
  }

  // BIAZA
  if (!options.source || options.source === 'biaza') {
    try {
      const biazaZoos = await scrapeBiaza(verbose);
      allRawZoos.push(...biazaZoos);
    } catch (err) {
      console.error('   ❌ BIAZA scrape failed:', (err as Error).message);
    }
  }

  // Google/AI search for additional zoos
  if (!options.source || options.source === 'google') {
    try {
      const googleZoos = await searchForZoos(allRawZoos, verbose);
      allRawZoos.push(...googleZoos);
    } catch (err) {
      console.error('   ❌ Google search failed:', (err as Error).message);
    }
  }

  console.log(`\n   Total raw entries: ${allRawZoos.length}\n`);

  // Step 2: Deduplicate
  console.log('🔄 Step 2: Deduplicating zoos...\n');

  let zoos = dedupeZoos(allRawZoos, verbose);
  zoos = sortZoosByQuality(zoos);

  // Apply filter if specified
  if (options.zooFilter) {
    const filter = options.zooFilter.toLowerCase();
    zoos = zoos.filter(z => z.name.toLowerCase().includes(filter));
    console.log(`   Filtered to ${zoos.length} zoos matching "${options.zooFilter}"`);
  }

  // Apply limit if specified
  if (options.limit) {
    zoos = zoos.slice(0, options.limit);
    console.log(`   Limited to first ${options.limit} zoos`);
  }

  console.log(`\n   Unique zoos: ${zoos.length}\n`);

  // Step 3: Geocoding
  console.log('📍 Step 3: Geocoding zoos...\n');

  // Some zoos already have coordinates from BIAZA's embedded map
  const alreadyGeocoded = zoos.filter(z => z.latitude && z.longitude).length;
  if (alreadyGeocoded > 0 && verbose) {
    console.log(`   ${alreadyGeocoded} zoos already have coordinates from scraped sources`);
  }

  if (!process.argv.includes('--skip-geocode')) {
    // Only geocode zoos that don't have coordinates yet
    const needsGeocoding = zoos.filter(z => !z.latitude || !z.longitude);
    if (needsGeocoding.length > 0) {
      const locations = await geocodeAllZoos(needsGeocoding, verbose);
      zoos = applyGeocodingToZoos(zoos, locations);
    }
  }

  const zoosWithCoords = zoos.filter(z => z.latitude && z.longitude).length;
  console.log(`   Zoos with coordinates: ${zoosWithCoords}/${zoos.length}\n`);

  // Step 4: Fetch animals
  let animalsByZoo = new Map<string, Animal[]>();

  if (!options.skipAnimals) {
    console.log('🐘 Step 4: Fetching animals for each zoo...\n');
    animalsByZoo = await fetchAnimalsForAllZoos(zoos, verbose, options.limit);

    const totalAnimals = Array.from(animalsByZoo.values()).reduce((sum, a) => sum + a.length, 0);
    console.log(`\n   Total animals: ${totalAnimals}\n`);
  } else {
    console.log('⏭️  Step 4: Skipping animal fetch (--skip-animals)\n');
  }

  // Step 5: Export
  console.log('💾 Step 5: Exporting data...\n');

  const outputFile = options.outputFile || 'uk-zoos.json';

  if (options.skipAnimals) {
    await exportZoosOnly(zoos, outputFile, verbose);
  } else {
    await exportToJson(zoos, animalsByZoo, outputFile, verbose);
  }

  // Step 6: Write to D1 (if requested)
  if (options.writeDb && !options.dryRun) {
    console.log('\n🗄️  Step 6: Writing to D1 database...\n');
    const result = await writeToD1(zoos, animalsByZoo, {
      clearExisting: true,
      verbose,
    });

    if (result.errors.length > 0) {
      console.error('   ⚠️  Errors:', result.errors);
    }
  } else if (options.dryRun) {
    console.log('\n⏭️  Step 6: Skipping DB write (--dry-run)\n');
  } else {
    console.log('\n⏭️  Step 6: Skipping DB write (use --write-db to write)\n');
  }

  // Done
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('✅ Complete!\n');
  console.log(`   Time: ${elapsed}s`);
  console.log(`   Zoos: ${zoos.length}`);
  console.log(`   Animals: ${Array.from(animalsByZoo.values()).reduce((sum, a) => sum + a.length, 0)}`);
  console.log(`   Output: ${outputFile}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
