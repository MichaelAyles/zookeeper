import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { getVisitById } from '../services/visits';
import { getZooById } from '../services/zoos';
import { getAnimalsByZoo } from '../services/animals';
import { buildChecklist, toggleSighting } from '../services/sightings';
import { groupBy, percentage, categoryIcons, categoryColors, cn } from '../lib/utils';
import type { ChecklistItem, AnimalCategory } from '../types';
import BottomNav from '../components/BottomNav';

export default function Visit() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const { activeVisit, activeZoo, checklist, setActiveVisit, setChecklist, updateChecklistItem } = useStore();

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'seen' | 'remaining'>('all');

  useEffect(() => {
    async function loadVisit() {
      if (!visitId) return;

      try {
        const visit = await getVisitById(visitId);
        if (!visit) {
          navigate('/');
          return;
        }

        const zoo = await getZooById(visit.zooId);
        if (!zoo) {
          navigate('/');
          return;
        }

        setActiveVisit(visit, zoo);

        const animals = await getAnimalsByZoo(visit.zooId);
        const checklistItems = await buildChecklist(animals, visit.id);
        setChecklist(checklistItems);
      } catch (error) {
        console.error('Failed to load visit:', error);
      } finally {
        setLoading(false);
      }
    }
    loadVisit();
  }, [visitId, navigate, setActiveVisit, setChecklist]);

  async function handleToggle(animalId: string) {
    if (!activeVisit) return;

    const result = await toggleSighting(activeVisit.id, animalId);
    updateChecklistItem(animalId, {
      seen: result.added,
      sighting: result.sighting,
    });
  }

  const filteredChecklist = checklist.filter((item) => {
    if (filter === 'seen') return item.seen;
    if (filter === 'remaining') return !item.seen;
    return true;
  });

  const grouped = groupBy(filteredChecklist, (item) => item.category);
  const seenCount = checklist.filter((i) => i.seen).length;
  const totalCount = checklist.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-spin text-5xl">🦁</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-36">
      {/* Header */}
      <header className="sticky top-0 bg-cream z-20 px-5 pt-4 pb-3 border-b border-forest/5">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-forest font-semibold
                       hover:bg-forest/5 -ml-2 px-2 py-1 rounded-[12px] transition-colors"
          >
            <span className="text-xl">←</span>
            <span>Back</span>
          </button>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full bg-white shadow-[var(--shadow-soft)]
                               flex items-center justify-center text-lg">
              🔍
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-forest">{activeZoo?.name}</h1>
          <div className="flex items-center gap-2 bg-forest text-white px-3.5 py-2 rounded-full text-sm font-semibold">
            <span>{seenCount}/{totalCount}</span>
            <div className="w-10 h-1.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-savanna rounded-full"
                style={{ width: `${percentage(seenCount, totalCount)}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-5 py-3 overflow-x-auto hide-scrollbar">
        {(['all', 'seen', 'remaining'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all',
              'border-2 shadow-[var(--shadow-soft)]',
              filter === f
                ? 'bg-forest text-white border-forest'
                : 'bg-white text-bark border-transparent hover:border-canopy'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-2 px-2 py-0.5 rounded-full bg-black/10 text-xs">
              {f === 'all' ? totalCount : f === 'seen' ? seenCount : totalCount - seenCount}
            </span>
          </button>
        ))}
      </div>

      {/* Checklist */}
      <main className="px-5 pt-2">
        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="mb-6 animate-fade-in">
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <div className={cn('w-8 h-8 rounded-[10px] flex items-center justify-center text-lg',
                categoryColors[category as AnimalCategory]?.split(' ')[0] || 'bg-sand')}>
                {categoryIcons[category as AnimalCategory]}
              </div>
              <h2 className="font-display text-lg font-semibold text-forest">{category}</h2>
              <span className="ml-auto text-sm text-bark font-semibold">
                <span className="text-canopy">{items.filter(i => i.seen).length}</span>
                {' / '}
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {items.map((item) => (
                <AnimalCard
                  key={item.id}
                  item={item}
                  onToggle={() => handleToggle(item.id)}
                  onCamera={() => navigate('/camera', { state: { animalId: item.id } })}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* FAB - Identify Animal */}
      <div className="fixed bottom-24 left-5 right-5 z-30">
        <button
          onClick={() => navigate('/camera')}
          className="w-full py-4.5 bg-gradient-to-r from-terracotta to-[#d4714f] text-white
                     rounded-[24px] font-display text-lg font-semibold
                     flex items-center justify-center gap-3
                     shadow-[0_8px_32px_rgba(196,93,58,0.4)]
                     hover:translate-y-[-2px] transition-transform"
        >
          <span className="text-2xl animate-pulse-soft">📸</span>
          Identify Animal
        </button>
      </div>

      <BottomNav active="visits" />
    </div>
  );
}

function AnimalCard({
  item,
  onToggle,
  onCamera,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onCamera: () => void;
}) {
  return (
    <article
      className={cn(
        'flex items-center gap-3.5 bg-white rounded-[16px] p-3.5 transition-all cursor-pointer',
        'shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] hover:translate-x-1',
        item.seen && 'bg-gradient-to-r from-canopy/5 to-savanna/5 border-l-4 border-canopy'
      )}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div
        className={cn(
          'w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all',
          item.seen
            ? 'bg-canopy border-canopy text-white'
            : 'bg-white border-sand'
        )}
      >
        {item.seen && <span className="text-sm">✓</span>}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-forest flex items-center gap-2">
          {item.commonName}
          {item.sighting?.photoBase64 && <span className="text-xs">📷</span>}
        </div>
        <div className="text-sm text-bark italic truncate">{item.scientificName}</div>
      </div>

      {/* Camera Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCamera();
        }}
        className={cn(
          'w-11 h-11 rounded-[12px] flex items-center justify-center text-xl transition-all',
          item.seen ? 'bg-canopy/15' : 'bg-sand hover:bg-savanna'
        )}
      >
        📷
      </button>
    </article>
  );
}
