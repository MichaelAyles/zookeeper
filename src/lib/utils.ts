import { clsx, type ClassValue } from 'clsx';
import type { AnimalCategory } from '../types';

// Combine class names
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Category icons
export const categoryIcons: Record<AnimalCategory, string> = {
  Mammals: '🦁',
  Birds: '🦅',
  Reptiles: '🐊',
  Amphibians: '🐸',
  Fish: '🐠',
  Invertebrates: '🦋',
};

// Category colors (Tailwind classes)
export const categoryColors: Record<AnimalCategory, string> = {
  Mammals: 'bg-mammals/15 text-mammals',
  Birds: 'bg-birds/15 text-birds',
  Reptiles: 'bg-reptiles/15 text-reptiles',
  Amphibians: 'bg-amphibians/15 text-amphibians',
  Fish: 'bg-fish/15 text-fish',
  Invertebrates: 'bg-invertebrates/15 text-invertebrates',
};

// Format date relative to now
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

// Format time of day greeting
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Calculate percentage
export function percentage(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

// Group items by a key
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// Parse JSON safely
export function parseJSON<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Extract JSON from potentially wrapped response
export function extractJSON<T>(str: string, fallback: T): T {
  // Try to find JSON array or object in the string
  const jsonMatch = str.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (jsonMatch) {
    return parseJSON(jsonMatch[0], fallback);
  }
  return fallback;
}
