// Wikipedia UK Zoo Scraper
// Source: https://en.wikipedia.org/wiki/List_of_zoos_in_the_United_Kingdom
// (redirects to List_of_zoological_gardens_and_aquariums_in_United_Kingdom)

import * as cheerio from 'cheerio';
import type { RawZoo } from '../types';

const WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/List_of_zoos_in_the_United_Kingdom';

export async function scrapeWikipedia(verbose = false): Promise<RawZoo[]> {
  if (verbose) console.log('📖 Fetching Wikipedia UK zoo list...');

  const response = await fetch(WIKIPEDIA_URL, {
    headers: {
      'User-Agent': 'ZookeeperApp/1.0 (https://zookeeperapp.com; contact@zookeeperapp.com)',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Wikipedia fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const zoos: RawZoo[] = [];

  // The page structure is simple: <li><a href="/wiki/Zoo_Name">Zoo Name</a></li>
  // These are in the main content area under various section headings

  // Find the main content div
  const $content = $('#mw-content-text .mw-parser-output');

  // Find all list items with wiki links to zoo pages
  $content.find('li').each((_, li) => {
    const $li = $(li);
    const $link = $li.find('a').first();

    // Must have a wiki link
    const href = $link.attr('href');
    if (!href || !href.startsWith('/wiki/')) return;

    // Skip non-zoo links (categories, special pages, etc.)
    if (href.includes(':') || href.includes('#')) return;

    const name = $link.text().trim();
    if (!name || name.length < 3) return;

    // Skip navigation/meta links
    if (name.toLowerCase().includes('edit') ||
        name.toLowerCase().includes('citation') ||
        name.toLowerCase().includes('reference') ||
        name === 'hide' ||
        name === 'show') return;

    // Skip if it's clearly not a zoo (just text without "zoo", "park", "aquarium", etc.)
    // But include all for now since they're in the zoo list
    const lowerName = name.toLowerCase();

    // Skip obvious non-zoos that might be in the same lists
    if (lowerName.includes('list of') ||
        lowerName.includes('category') ||
        lowerName.includes('united kingdom') ||
        lowerName.includes('england') ||
        lowerName.includes('scotland') ||
        lowerName.includes('wales') ||
        lowerName.includes('northern ireland')) return;

    // Check if we already have this zoo
    if (zoos.some(z => z.name.toLowerCase() === lowerName)) return;

    zoos.push({
      name: cleanZooName(name),
      source: 'wikipedia',
      wikiUrl: `https://en.wikipedia.org${href}`,
    });
  });

  // Also check tables if they exist (some zoo lists use tables)
  $content.find('table.wikitable').each((_, table) => {
    const $table = $(table);

    $table.find('tbody tr').each((_, row) => {
      const $row = $(row);
      const $firstCell = $row.find('td').first();
      const $link = $firstCell.find('a').first();

      if (!$link.length) return;

      const href = $link.attr('href');
      if (!href || !href.startsWith('/wiki/')) return;

      const name = $link.text().trim();
      if (!name || name.length < 3) return;

      // Check if we already have this zoo
      if (zoos.some(z => z.name.toLowerCase() === name.toLowerCase())) return;

      // Try to get city from other columns
      const cells = $row.find('td');
      let city: string | undefined;

      cells.each((idx, cell) => {
        if (idx === 0) return; // Skip name column
        const text = $(cell).text().trim();
        if (text && text.length > 2 && text.length < 50 && !text.includes('[')) {
          if (!city) city = text.split(',')[0].trim();
        }
      });

      zoos.push({
        name: cleanZooName(name),
        city,
        source: 'wikipedia',
        wikiUrl: `https://en.wikipedia.org${href}`,
      });
    });
  });

  if (verbose) console.log(`   Found ${zoos.length} zoos on Wikipedia`);

  return zoos;
}

function cleanZooName(name: string): string {
  return name
    .replace(/\[.*?\]/g, '') // Remove references like [1]
    .replace(/†/g, '')       // Remove dagger symbols
    .trim();
}
