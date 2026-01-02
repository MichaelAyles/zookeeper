// BIAZA (British and Irish Association of Zoos and Aquariums) Scraper
// Source: https://biaza.org.uk/members/all

import * as cheerio from 'cheerio';
import type { RawZoo } from '../types';

const BIAZA_URL = 'https://biaza.org.uk/members/all';

export async function scrapeBiaza(verbose = false): Promise<RawZoo[]> {
  if (verbose) console.log('🦁 Fetching BIAZA member list...');

  const response = await fetch(BIAZA_URL, {
    headers: {
      'User-Agent': 'ZookeeperApp/1.0 (https://zookeeperapp.com; contact@zookeeperapp.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`BIAZA fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const zoos: RawZoo[] = [];

  // Extract coordinates from Google Maps markers embedded in the page
  // Format: markers[N] = new google.maps.Marker({ position: {lat: X, lng: Y}, ... title: 'Zoo Name' });
  const coordsMap = extractMapCoordinates(html);
  if (verbose && coordsMap.size > 0) {
    console.log(`   Found ${coordsMap.size} zoo coordinates from BIAZA map`);
  }

  // BIAZA structure:
  // <a href="/members/detail/chester-zoo">
  //   <div class="zool">...</div>
  //   <div class="zoor">
  //     <span class="title">Chester Zoo</span>
  //     <span class="region">Region: North West</span>
  //     <span class="county">County: Cheshire</span>
  //   </div>
  // </a>

  $('a[href^="/members/detail/"]').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href');

    if (!href) return;

    // Get the zoo name from the title span
    const name = $link.find('span.title').text().trim();
    if (!name || name.length < 3) return;

    // Get region and county
    const regionText = $link.find('span.region').text().trim();
    const countyText = $link.find('span.county').text().trim();

    // Parse region (format: "Region: North West")
    const regionMatch = regionText.match(/Region:\s*(.+)/i);
    const region = regionMatch ? regionMatch[1].trim() : undefined;

    // Parse county (format: "County: Cheshire")
    const countyMatch = countyText.match(/County:\s*(.+)/i);
    let county = countyMatch ? countyMatch[1].trim() : undefined;

    // Skip placeholder values
    if (county === 'Please select...' || county === '') {
      county = undefined;
    }

    // Skip if already added
    if (zoos.some(z => z.name.toLowerCase() === name.toLowerCase())) return;

    // Look up coordinates from the map
    const coords = coordsMap.get(name.toLowerCase());

    zoos.push({
      name: cleanZooName(name),
      county,
      source: 'biaza',
      latitude: coords?.lat,
      longitude: coords?.lng,
    });
  });

  // Filter to UK only (BIAZA includes Irish members too)
  const ukZoos = zoos.filter(z => !isIrishZoo(z));

  if (verbose) console.log(`   Found ${ukZoos.length} UK zoos on BIAZA (${zoos.length} total including Ireland)`);

  return ukZoos;
}

// Extract coordinates from the embedded Google Maps JavaScript
function extractMapCoordinates(html: string): Map<string, { lat: number; lng: number }> {
  const coordsMap = new Map<string, { lat: number; lng: number }>();

  // Match patterns like: position: {lat: 51.686878, lng: -4.764857}, ... title: 'Manor Wildlife Park'
  const markerRegex = /position:\s*\{lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)\}[^}]*title:\s*'([^']+)'/g;

  let match;
  while ((match = markerRegex.exec(html)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    const title = match[3];

    if (!isNaN(lat) && !isNaN(lng) && title) {
      coordsMap.set(title.toLowerCase(), { lat, lng });
    }
  }

  return coordsMap;
}

function cleanZooName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

function isIrishZoo(zoo: RawZoo): boolean {
  // Known Irish counties/cities
  const irishLocations = [
    'dublin', 'cork', 'galway', 'limerick', 'waterford', 'kilkenny',
    'wexford', 'kerry', 'clare', 'mayo', 'donegal', 'sligo', 'louth',
    'meath', 'wicklow', 'kildare', 'laois', 'offaly', 'westmeath',
    'longford', 'roscommon', 'leitrim', 'cavan', 'monaghan', 'tipperary',
    'carlow', 'killarney', 'fota', 'republic of ireland',
  ];

  // Northern Ireland is UK - don't filter these
  const northernIrelandLocations = [
    'belfast', 'derry', 'londonderry', 'antrim', 'armagh', 'down',
    'fermanagh', 'tyrone', 'northern ireland',
  ];

  const lowerName = zoo.name.toLowerCase();
  const lowerCounty = (zoo.county || '').toLowerCase();

  // Check if Northern Ireland (keep these)
  for (const ni of northernIrelandLocations) {
    if (lowerName.includes(ni) || lowerCounty.includes(ni)) {
      return false; // Keep NI zoos
    }
  }

  // Check if Republic of Ireland (filter these)
  for (const irish of irishLocations) {
    if (lowerName.includes(irish) || lowerCounty.includes(irish)) {
      return true; // Filter out Irish zoos
    }
  }

  return false;
}
