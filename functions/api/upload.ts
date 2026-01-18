// POST /api/upload - Upload photo to R2 and return URL

import { json, error, generateId } from '../lib/db';
import type { User } from '../lib/auth';

interface Env {
  PHOTOS: R2Bucket;
}

interface ContextData {
  user: User;
}

export const onRequestPost: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env, data } = context;

  try {
    const body = await request.json<{
      image: string; // base64 data URL
    }>();

    if (!body.image) {
      return error('Image data is required', 400);
    }

    // Extract base64 data from data URL
    // Format: data:image/jpeg;base64,/9j/4AAQSkZJRg...
    const matches = body.image.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
    if (!matches) {
      return error('Invalid image format. Expected base64 data URL.', 400);
    }

    const imageType = matches[1];
    const base64Data = matches[2];

    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate unique filename
    const id = generateId();
    const filename = `${data.user.id}/${id}.${imageType}`;
    const contentType = `image/${imageType}`;

    // Upload to R2
    await env.PHOTOS.put(filename, bytes, {
      httpMetadata: {
        contentType,
      },
    });

    // Return the path - will be served via R2 public bucket or custom domain
    // For now, we'll construct a URL that can be used with R2's public access
    const photoUrl = `/api/photos/${filename}`;

    return json({ photoUrl });
  } catch (err) {
    console.error('Upload error:', err);
    return error('Failed to upload photo', 500);
  }
};
