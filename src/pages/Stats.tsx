import { useEffect, useState } from 'react';
import { useStore } from '../stores/useStore';
import { getUserStats, getCategoryStats, getZooStats, getRecentSightings } from '../services/stats';
import { formatRelativeTime, categoryIcons } from '../lib/utils';
import type { UserStats, CategoryStats, AnimalCategory } from '../types';
import BottomNav from '../components/BottomNav';

export default function Stats() {
  const profile = useStore((state) => state.profile);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [zooStats, setZooStats] = useState<Array<{
    zooId: string;
    zooName: string;
    visitCount: number;
    animalsSpotted: number;
    totalAnimals: number;
    completionPercent: number;
    lastVisit?: Date;
  }>>([]);
  const [recentPhotos, setRecentPhotos] = useState<Array<{
    sighting: { id: string; seenAt: Date; photoBase64?: string };
    animal: { commonName: string; category: AnimalCategory };
    zooName: string;
  }>>([]);

  useEffect(() => {
    async function loadStats() {
      const [userStats, catStats, zStats, photos] = await Promise.all([
        getUserStats(),
        getCategoryStats(),
        getZooStats(),
        getRecentSightings(8),
      ]);

      setStats(userStats);
      setCategoryStats(catStats);
      setZooStats(zStats);
      setRecentPhotos(photos);
    }
    loadStats();
  }, []);

  if (!stats) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-spin text-5xl">🦁</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-forest to-forest-light px-5 pt-5 pb-20 relative overflow-hidden">
        <div className="absolute -top-12 -right-8 w-72 h-72 bg-white/5 rounded-full" />

        <div className="flex items-center justify-between mb-6 relative z-10">
          <h1 className="font-display text-2xl font-bold text-white">Your Safari Stats</h1>
          <button className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-xl">
            📤
          </button>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-savanna to-terracotta
                          flex items-center justify-center text-white font-display text-2xl font-bold
                          border-3 border-white/30">
            {profile?.displayName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="text-white">
            <div className="font-display text-xl font-semibold">{profile?.displayName}</div>
            <div className="text-sm opacity-80">
              Wildlife explorer since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'today'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Stats Card */}
      <div className="bg-white mx-4 -mt-12 rounded-[28px] p-6 shadow-[var(--shadow-card)] relative z-10 grid grid-cols-2 gap-5">
        <div className="text-center animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="text-2xl mb-2">🏛️</div>
          <div className="font-display text-4xl font-bold text-forest">{stats.totalZoosVisited}</div>
          <div className="text-sm text-bark font-medium">Zoos Visited</div>
        </div>
        <div className="text-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="text-2xl mb-2">🦒</div>
          <div className="font-display text-4xl font-bold text-forest">{stats.totalAnimalsSpotted}</div>
          <div className="text-sm text-bark font-medium">Animals Spotted</div>
        </div>
        <div className="text-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="text-2xl mb-2">📸</div>
          <div className="font-display text-4xl font-bold text-forest">{stats.totalPhotos}</div>
          <div className="text-sm text-bark font-medium">Photos Taken</div>
        </div>
        <div className="text-center animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="text-2xl mb-2">⭐</div>
          <div className="font-display text-4xl font-bold text-forest">{stats.totalVisits}</div>
          <div className="text-sm text-bark font-medium">Total Visits</div>
        </div>
      </div>

      <main className="px-4 pt-6">
        {/* Category Stats */}
        <section className="mb-8">
          <h2 className="font-display text-xl font-semibold text-forest mb-4 px-1">By Category</h2>
          <div className="grid grid-cols-3 gap-3">
            {categoryStats.map((cat) => (
              <div
                key={cat.category}
                className="bg-white rounded-[16px] p-4 text-center shadow-[var(--shadow-soft)]"
              >
                <div className="text-2xl mb-2">{cat.icon}</div>
                <div className="font-display text-2xl font-bold text-forest">{cat.count}</div>
                <div className="text-xs text-bark font-semibold uppercase tracking-wide">
                  {cat.category.slice(0, 6)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Zoo Stats */}
        {zooStats.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-semibold text-forest mb-4 px-1">Your Zoos</h2>
            <div className="flex flex-col gap-3">
              {zooStats.map((zoo, i) => (
                <article
                  key={zoo.zooId}
                  className="flex items-center gap-3.5 bg-white rounded-[16px] p-4 shadow-[var(--shadow-soft)]"
                >
                  <div
                    className={`w-9 h-9 rounded-[10px] flex items-center justify-center
                                font-display font-bold text-sm
                                ${i === 0
                                  ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white'
                                  : 'bg-sand text-bark'
                                }`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-forest">{zoo.zooName}</div>
                    <div className="text-sm text-bark">
                      {zoo.visitCount} {zoo.visitCount === 1 ? 'visit' : 'visits'}
                      {zoo.lastVisit && ` · Last: ${formatRelativeTime(zoo.lastVisit)}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xl font-bold text-canopy">{zoo.completionPercent}%</div>
                    <div className="text-xs text-bark">{zoo.animalsSpotted}/{zoo.totalAnimals}</div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Recent Photos */}
        {recentPhotos.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-semibold text-forest mb-4 px-1">Recent Photos</h2>
            <div className="grid grid-cols-4 gap-2">
              {recentPhotos.slice(0, 8).map((item) => (
                <div
                  key={item.sighting.id}
                  className="aspect-square rounded-[12px] bg-sand overflow-hidden
                             flex items-center justify-center text-3xl"
                >
                  {item.sighting.photoBase64 ? (
                    <img
                      src={`data:image/jpeg;base64,${item.sighting.photoBase64}`}
                      alt={item.animal.commonName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    categoryIcons[item.animal.category]
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <BottomNav active="stats" />
    </div>
  );
}
