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
  failMessage?: string;
  failEmoji?: string;
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

    const prompt = `You're helping identify animals at a zoo. The zoo has these animals: ${body.candidateAnimals.join(', ')}.

Look at this photo and determine what's in it.

Return ONLY valid JSON in one of these formats:

IF it's a zoo animal from the list above:
{"animal": "Animal Name", "confidence": 0.95, "funFact": "One interesting fact about this animal"}

IF it's NOT a zoo animal, generate a fun, friendly message based on what you see:
{"animal": null, "confidence": 0, "failEmoji": "emoji", "failMessage": "Your witty message here"}

Examples of fun fail messages:
- People: {"animal": null, "confidence": 0, "failEmoji": "👨‍🔬", "failMessage": "Looks like some trainee zookeepers! They're doing a great job, but they're not on the animal checklist."}
- Dog: {"animal": null, "confidence": 0, "failEmoji": "🐕", "failMessage": "What a cute pup! But I don't think you're at the zoo right now... unless it's a very unusual zoo!"}
- Cat: {"animal": null, "confidence": 0, "failEmoji": "🐱", "failMessage": "Aww, adorable kitty! Sadly house cats aren't on today's zoo scavenger hunt."}
- Toy/stuffed animal: {"animal": null, "confidence": 0, "failEmoji": "🧸", "failMessage": "Nice try! That's a cuddly toy, not the real deal. Go find the living, breathing version!"}
- Food: {"animal": null, "confidence": 0, "failEmoji": "🍔", "failMessage": "Getting hungry? That's not an animal... although the zoo café is pretty good!"}
- Random object: {"animal": null, "confidence": 0, "failEmoji": "🤔", "failMessage": "Hmm, I'm not sure what I'm looking at, but it's definitely not a zoo animal!"}
- Solid color/nothing: {"animal": null, "confidence": 0, "failEmoji": "📷", "failMessage": "I can't see much here. Try pointing the camera at an animal!"}

Be creative and playful with your fail messages! Keep them short, friendly, and fun.

Rules:
- "animal" must EXACTLY match one of the zoo animal names, or be null
- "confidence" must be 0-1
- "funFact" should be a short, interesting fact (only for successful matches)
- "failMessage" should be playful and encouraging (only for non-matches)`;

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
          // Not a zoo animal - generate a generic fail message if LLM didn't provide one
          identification.animal = null;
          identification.confidence = 0;
          if (!identification.failMessage) {
            identification.failEmoji = '🤔';
            identification.failMessage = "I spotted something, but it's not one of the animals at this zoo!";
          }
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
