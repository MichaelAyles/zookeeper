// GET /api/photos/:userId/:filename - Serve photo from R2

interface Env {
  PHOTOS: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env } = context;

  // Get the full path from params
  const pathParts = params.path as string[];
  const path = pathParts.join('/');

  if (!path) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const object = await env.PHOTOS.get(path);

    if (!object) {
      return new Response('Photo not found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    headers.set('ETag', object.etag);

    return new Response(object.body, { headers });
  } catch (err) {
    console.error('Photo fetch error:', err);
    return new Response('Failed to fetch photo', { status: 500 });
  }
};
