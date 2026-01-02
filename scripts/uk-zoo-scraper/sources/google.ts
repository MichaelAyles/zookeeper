// Google/AI Search for additional UK zoos
// Uses Gemini with web search grounding to find zoos we might have missed

import type { RawZoo } from '../types';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function searchForZoos(existingZoos: RawZoo[], verbose = false): Promise<RawZoo[]> {
  if (verbose) console.log('🔍 Searching for additional UK zoos via AI...');

  if (!OPENROUTER_API_KEY) {
    console.warn('   ⚠️  No OPENROUTER_API_KEY - skipping Google search');
    return [];
  }

  const existingNames = existingZoos.map(z => z.name.toLowerCase());

  const prompt = `Search the web for a comprehensive list of zoos, safari parks, wildlife parks, and aquariums in the United Kingdom.

I already have these zoos: ${existingZoos.slice(0, 30).map(z => z.name).join(', ')}${existingZoos.length > 30 ? ` and ${existingZoos.length - 30} more` : ''}.

Find any UK zoos, safari parks, wildlife parks, or aquariums that I might be missing. Focus on:
1. Smaller local zoos
2. Wildlife parks and reserves with animal collections
3. Safari parks
4. Aquariums and sea life centres
5. Farm parks with exotic animals (not regular petting farms)

Return ONLY a JSON array of zoos I'm missing:
[
  {"name": "Zoo Name", "city": "City", "website": "https://..."}
]

Only include places that are actually open to the public and have a significant animal collection.
Do NOT include places I already have.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zookeeperapp.com',
        'X-Title': 'Zookeeper UK Zoo Scraper',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        // Enable web search grounding
        tools: [{ type: 'web_search' }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('   OpenRouter error:', errorText);
      return [];
    }

    const result = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = result.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      if (verbose) console.log('   No additional zoos found');
      return [];
    }

    const foundZoos = JSON.parse(jsonMatch[0]) as Array<{
      name: string;
      city?: string;
      website?: string;
    }>;

    // Filter out duplicates (case-insensitive)
    const newZoos: RawZoo[] = foundZoos
      .filter(z => z.name && !existingNames.includes(z.name.toLowerCase()))
      .map(z => ({
        name: z.name,
        city: z.city,
        website: z.website,
        source: 'google' as const,
      }));

    if (verbose) console.log(`   Found ${newZoos.length} additional zoos via AI search`);

    return newZoos;
  } catch (err) {
    console.error('   AI search failed:', err);
    return [];
  }
}
