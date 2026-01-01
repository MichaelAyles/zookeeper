// GET /api/zoos/:id - Get a single zoo

import { json, error, Zoo } from '../../../lib/db';

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const zooId = params.id as string;

  const zoo = await env.DB.prepare('SELECT * FROM zoos WHERE id = ?').bind(zooId).first<Zoo>();

  if (!zoo) {
    return error('Zoo not found', 404);
  }

  return json({
    id: zoo.id,
    name: zoo.name,
    city: zoo.city,
    country: zoo.country,
    latitude: zoo.latitude,
    longitude: zoo.longitude,
    websiteUrl: zoo.website_url,
    animalsGeneratedAt: zoo.animals_generated_at,
    createdAt: zoo.created_at,
  });
};
