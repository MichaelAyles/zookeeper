import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchZoos, seedZoos, getZoos } from '../services/zoos';
import { startVisit } from '../services/visits';
import { getOrGenerateAnimals } from '../services/animals';
import { useStore } from '../stores/useStore';
import type { Zoo } from '../types';

export default function ZooSelect() {
  const [query, setQuery] = useState('');
  const [zoos, setZoos] = useState<Zoo[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const navigate = useNavigate();
  const setActiveVisit = useStore((state) => state.setActiveVisit);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (query) {
      searchZoos(query).then(setZoos);
    } else {
      getZoos().then(setZoos);
    }
  }, [query]);

  async function init() {
    await seedZoos();
    const allZoos = await getZoos();
    setZoos(allZoos);
    setLoading(false);
  }

  async function handleSelectZoo(zoo: Zoo) {
    setGenerating(zoo.id);
    try {
      // Generate animals if needed
      await getOrGenerateAnimals(zoo);

      // Start visit
      const visit = await startVisit(zoo.id);
      setActiveVisit(visit, zoo);

      navigate(`/visit/${visit.id}`);
    } catch (error) {
      console.error('Failed to start visit:', error);
      alert('Failed to load zoo animals. Please check your API key and try again.');
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 bg-cream z-10 px-5 pt-4 pb-3 border-b border-forest/5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-forest font-semibold mb-3
                     hover:bg-forest/5 -ml-2 px-2 py-1 rounded-[12px] transition-colors"
        >
          <span className="text-xl">←</span>
          <span>Back</span>
        </button>
        <h1 className="font-display text-2xl font-bold text-forest">Select a Zoo</h1>
      </header>

      {/* Search */}
      <div className="px-5 py-4">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search zoos..."
            className="w-full pl-12 pr-4 py-3.5 rounded-[16px] bg-white border-2 border-sand
                       font-body text-forest placeholder:text-bark/50
                       focus:border-canopy focus:outline-none transition-colors
                       shadow-[var(--shadow-soft)]"
          />
        </div>
      </div>

      {/* Zoo List */}
      <div className="px-5 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin text-4xl">🦁</div>
          </div>
        ) : zoos.length === 0 ? (
          <div className="text-center py-12 text-bark">
            <div className="text-4xl mb-4">🏛️</div>
            <p>No zoos found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {zoos.map((zoo) => (
              <button
                key={zoo.id}
                onClick={() => handleSelectZoo(zoo)}
                disabled={generating !== null}
                className="w-full text-left bg-white rounded-[16px] p-4 shadow-[var(--shadow-soft)]
                           hover:shadow-[var(--shadow-card)] hover:translate-x-1 transition-all
                           disabled:opacity-50 disabled:cursor-wait"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-sand to-savanna
                                  flex items-center justify-center text-2xl">
                    🏛️
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-forest">{zoo.name}</div>
                    <div className="text-sm text-bark">
                      {zoo.city && `${zoo.city}, `}{zoo.country}
                    </div>
                  </div>
                  {generating === zoo.id ? (
                    <div className="animate-spin text-xl">⏳</div>
                  ) : (
                    <span className="text-canopy text-xl">→</span>
                  )}
                </div>
                {generating === zoo.id && (
                  <div className="mt-3 text-sm text-canopy animate-pulse">
                    Generating animal list with AI...
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
