// POST /api/identify - Identify an animal in an image using AI

import { json, error } from '../lib/db';
import type { User } from '../lib/auth';

interface Env {
  DB: D1Database;
  OPENROUTER_API_KEY?: string;
}

interface ContextData {
  user: User;
}

interface IdentifyRequest {
  imageData: string; // base64 or data URL
  candidateAnimals: string[]; // list of animal names
}

interface IdentificationResult {
  animal: string | null;
  confidence: number;
  funFact?: string;
}

export const onRequestPost: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env } = context;

  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return error('OpenRouter API key not configured', 500);
  }

  try {
    const body = await request.json<IdentifyRequest>();

    if (!body.imageData || !body.candidateAnimals?.length) {
      return error('Image data and candidate animals are required', 400);
    }

    // Ensure image data is a proper data URL
    const imageUrl = body.imageData.startsWith('data:')
      ? body.imageData
      : `data:image/jpeg;base64,${body.imageData}`;

    const prompt = `Identify the animal in this photo. It should be one of these animals from the zoo: ${body.candidateAnimals.join(', ')}.

Return ONLY valid JSON in this exact format:
{"animal": "Animal Name", "confidence": 0.95, "funFact": "One interesting fact about this animal"}

Rules:
- "animal" must exactly match one of the names provided above
- "confidence" must be a number between 0 and 1
- "funFact" should be a short, interesting fact about the identified animal

If you cannot identify the animal or it's not in the list, return:
{"animal": null, "confidence": 0}`;

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
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      return error('Failed to identify animal', 500);
    }

    const result = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = result.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    let identification: IdentificationResult = { animal: null, confidence: 0 };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        identification = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error('Failed to parse AI response:', content);
    }

    // Validate the animal name matches our list (case-insensitive)
    if (identification.animal) {
      const matchedAnimal = body.candidateAnimals.find(
        name => name.toLowerCase() === identification.animal?.toLowerCase()
      );
      if (!matchedAnimal) {
        // Try fuzzy match
        const fuzzyMatch = body.candidateAnimals.find(name =>
          name.toLowerCase().includes(identification.animal?.toLowerCase() || '') ||
          identification.animal?.toLowerCase().includes(name.toLowerCase())
        );
        if (fuzzyMatch) {
          identification.animal = fuzzyMatch;
        } else {
          identification.animal = null;
          identification.confidence = 0;
        }
      } else {
        identification.animal = matchedAnimal;
      }
    }

    return json(identification);
  } catch (err) {
    console.error('Identification error:', err);
    return error('Failed to identify animal', 500);
  }
};
