// POST /api/zoos/:id/animals/generate - Generate animals for a zoo using AI

import { json, error, generateId } from '../../../../lib/db';
import type { User } from '../../../../lib/auth';

interface Env {
  DB: D1Database;
  OPENROUTER_API_KEY?: string;
}

interface ContextData {
  user: User;
}

interface GeneratedAnimal {
  common_name: string;
  scientific_name?: string;
  category: string;
  exhibit_area?: string;
  fun_fact?: string;
}

export const onRequestPost: PagesFunction<Env, string, ContextData> = async (context) => {
  const { env, params, data } = context;
  const zooId = params.id as string;

  // Only admins can generate animals
  // TODO: Add admin check here

  try {
    // Get zoo info
    const zoo = await env.DB.prepare(
      'SELECT id, name, city, country FROM zoos WHERE id = ?'
    ).bind(zooId).first<{ id: string; name: string; city: string; country: string }>();

    if (!zoo) {
      return error('Zoo not found', 404);
    }

    // Check if we have an API key
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return error('OpenRouter API key not configured', 500);
    }

    // Generate animals using AI
    const prompt = `You are a zoo animal database. List all animals currently on display at ${zoo.name} in ${zoo.city ? `${zoo.city}, ` : ''}${zoo.country}.

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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zookeeperapp.com',
        'X-Title': 'Zookeeper',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter error:', await response.text());
      return error('Failed to generate animals', 500);
    }

    const result = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = result.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    let animals: GeneratedAnimal[] = [];
    try {
      // Try to find JSON array in the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        animals = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error('Failed to parse AI response:', content);
      return error('Failed to parse animal data', 500);
    }

    if (!Array.isArray(animals) || animals.length === 0) {
      return error('No animals generated', 500);
    }

    // Delete existing animals for this zoo (fresh generation)
    await env.DB.prepare('DELETE FROM animals WHERE zoo_id = ?').bind(zooId).run();

    // Insert all animals
    const savedAnimals = [];
    const now = new Date().toISOString();

    for (const animal of animals) {
      const id = generateId();
      await env.DB.prepare(
        `INSERT INTO animals (id, zoo_id, common_name, scientific_name, category, exhibit_area, fun_fact, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        zooId,
        animal.common_name,
        animal.scientific_name || null,
        animal.category,
        animal.exhibit_area || null,
        animal.fun_fact || null,
        now
      ).run();

      savedAnimals.push({
        id,
        zooId,
        commonName: animal.common_name,
        scientificName: animal.scientific_name || null,
        category: animal.category,
        exhibitArea: animal.exhibit_area || null,
        funFact: animal.fun_fact || null,
        createdAt: now,
      });
    }

    // Update zoo's animalsGeneratedAt
    await env.DB.prepare(
      'UPDATE zoos SET animals_generated_at = ? WHERE id = ?'
    ).bind(now, zooId).run();

    return json({
      animals: savedAnimals,
      message: `Generated ${savedAnimals.length} animals for ${zoo.name}`,
    });
  } catch (err) {
    console.error('Generate animals error:', err);
    return error('Failed to generate animals', 500);
  }
};
