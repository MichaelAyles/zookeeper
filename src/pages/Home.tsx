import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { getActiveVisit } from '../services/visits';
import { getZooById } from '../services/zoos';
import { getSightingsByVisit } from '../services/sightings';
import { getAnimalsByZoo } from '../services/animals';
import { getUserStats, getRecentSightings } from '../services/stats';
import { getGreeting, percentage, formatRelativeTime, categoryIcons } from '../lib/utils';
import type { UserStats, Visit, Zoo, AnimalCategory } from '../types';
import BottomNav from '../components/BottomNav';

export default function Home() {
  const profile = useStore((state) => state.profile);
  const setProfile = useStore((state) => state.setProfile);
  const setActiveVisit = useStore((state) => state.setActiveVisit);
  const navigate = useNavigate();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [activeVisit, setActiveVisitState] = useState<Visit | null>(null);
  const [activeZoo, setActiveZoo] = useState<Zoo | null>(null);
  const [progress, setProgress] = useState({ seen: 0, total: 0 });
  const [showMenu, setShowMenu] = useState(false);
  const [recentSightings, setRecentSightings] = useState<Array<{
    sighting: { id: string; seenAt: Date };
    animal: { commonName: string; category: AnimalCategory };
    zooName: string;
  }>>([]);

  useEffect(() => {
    async function loadData() {
      const userStats = await getUserStats();
      setStats(userStats);

      const visit = await getActiveVisit();
      if (visit) {
        const zoo = await getZooById(visit.zooId);
        setActiveVisitState(visit);
        setActiveZoo(zoo || null);
        setActiveVisit(visit, zoo || null);

        const sightings = await getSightingsByVisit(visit.id);
        const animals = await getAnimalsByZoo(visit.zooId);
        setProgress({ seen: sightings.length, total: animals.length });
      }

      const recent = await getRecentSightings(5);
      setRecentSightings(recent);
    }
    loadData();
  }, [setActiveVisit]);

  const handleLogout = () => {
    setProfile(null);
    setActiveVisit(null, null);
    navigate('/');
  };

  const handleContinueVisit = () => {
    if (activeVisit) {
      navigate(`/visit/${activeVisit.id}`);
    }
  };

  const isFirstTime = !stats || stats.totalZoosVisited === 0;

  return (
    <div className="min-h-screen bg-cream pb-24">
      {/* Header */}
      <header className="px-5 pt-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-forest rounded-xl flex items-center justify-center">
            <span className="text-xl">🔍</span>
          </div>
          <span className="font-display text-2xl font-bold text-forest">
            Z<span className="text-terracotta">oo</span>keeper
          </span>
        </div>

        {/* Avatar with menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-11 h-11 rounded-full bg-gradient-to-br from-canopy to-forest-light
                       flex items-center justify-center text-white font-semibold text-lg
                       shadow-md border-2 border-cream active:scale-95 transition-transform"
          >
            {profile?.displayName?.[0]?.toUpperCase() || '?'}
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-14 bg-white rounded-2xl shadow-lg z-50 py-2 min-w-[160px] border border-sand">
                <div className="px-4 py-2 border-b border-sand">
                  <div className="font-semibold text-forest">{profile?.displayName}</div>
                  <div className="text-xs text-bark">Explorer</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-error hover:bg-red-50 flex items-center gap-2"
                >
                  <span>🚪</span>
                  <span>Log out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="px-5">
        {/* Welcome */}
        <section className="mb-6">
          <p className="text-sm text-bark mb-1">{getGreeting()} 👋</p>
          <h1 className="font-display text-3xl font-bold text-forest leading-tight">
            Welcome back,<br/>
            <span className="text-terracotta">{profile?.displayName || 'Explorer'}</span>
          </h1>
        </section>

        {/* Active Visit Card */}
        {activeVisit && activeZoo ? (
          <article className="bg-gradient-to-br from-forest to-forest-light rounded-3xl p-6 text-white relative overflow-hidden shadow-lg mb-6">
            <div className="absolute -top-12 -right-8 w-48 h-48 bg-white/10 rounded-full" />
            <div className="absolute bottom-4 right-6 text-5xl opacity-20">🦁</div>

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide mb-4">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Active Visit
              </div>

              <h2 className="font-display text-2xl font-bold mb-1">{activeZoo.name}</h2>
              <p className="text-sm opacity-80 mb-5">
                Started {formatRelativeTime(activeVisit.startedAt)}
              </p>

              <div className="mb-5">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm font-semibold">
                    <span className="text-2xl">{progress.seen}</span> of {progress.total} animals
                  </span>
                  <span className="text-sm opacity-80">
                    {percentage(progress.seen, progress.total)}%
                  </span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-savanna to-terracotta rounded-full transition-all duration-1000"
                    style={{ width: `${percentage(progress.seen, progress.total)}%` }}
                  />
                </div>
              </div>

              <button
                onClick={handleContinueVisit}
                className="w-full py-4 bg-white text-forest rounded-2xl font-display font-semibold
                           flex items-center justify-center gap-2 shadow-md
                           hover:shadow-lg active:scale-[0.98] transition-all"
              >
                Continue Safari
                <span className="text-lg">→</span>
              </button>
            </div>
          </article>
        ) : isFirstTime ? (
          /* First-time empty state */
          <article className="bg-white rounded-3xl p-8 text-center shadow-md mb-6">
            <div className="text-6xl mb-4">🦒</div>
            <h2 className="font-display text-xl font-bold text-forest mb-2">
              Ready for your first adventure?
            </h2>
            <p className="text-bark text-sm mb-6">
              Visit a zoo and start collecting animals.<br/>
              It's like a real-life Pokedex!
            </p>
            <Link
              to="/zoo-select"
              className="inline-flex items-center justify-center gap-2 w-full py-4
                         bg-forest text-white rounded-2xl font-display font-semibold
                         shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
            >
              <span className="text-xl">🏛️</span>
              Find a Zoo
            </Link>
          </article>
        ) : null}

        {/* New Visit Button (when not first time and no active visit) */}
        {!isFirstTime && !activeVisit && (
          <>
            <div className="flex items-center gap-4 mb-6 text-bark text-sm">
              <div className="flex-1 h-px bg-sand" />
              <span>start a new visit</span>
              <div className="flex-1 h-px bg-sand" />
            </div>

            <Link
              to="/zoo-select"
              className="flex items-center justify-center gap-3 w-full py-5
                         border-2 border-dashed border-canopy rounded-3xl
                         bg-canopy/5 font-display font-semibold text-lg text-forest-light
                         hover:bg-canopy/10 active:scale-[0.98] transition-all mb-6"
            >
              <span className="w-8 h-8 bg-canopy rounded-full flex items-center justify-center text-white text-xl font-bold">
                +
              </span>
              Start New Zoo Visit
            </Link>
          </>
        )}

        {/* Or divider for active visit */}
        {activeVisit && (
          <>
            <div className="flex items-center gap-4 mb-6 text-bark text-sm">
              <div className="flex-1 h-px bg-sand" />
              <span>or start fresh</span>
              <div className="flex-1 h-px bg-sand" />
            </div>

            <Link
              to="/zoo-select"
              className="flex items-center justify-center gap-3 w-full py-4
                         border-2 border-dashed border-canopy/50 rounded-2xl
                         font-semibold text-forest-light
                         hover:bg-canopy/5 transition-colors mb-6"
            >
              <span>+</span>
              Start New Zoo Visit
            </Link>
          </>
        )}

        {/* Stats Section */}
        {stats && stats.totalZoosVisited > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold text-forest">Your Journey</h2>
              <Link to="/stats" className="text-sm text-canopy font-semibold">
                See all →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🏛️', value: stats.totalZoosVisited, label: 'Zoos' },
                { icon: '🦒', value: stats.totalAnimalsSpotted, label: 'Animals' },
                { icon: '📸', value: stats.totalPhotos, label: 'Photos' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-2xl p-4 text-center shadow-sm">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="font-display text-2xl font-bold text-forest">{stat.value}</div>
                  <div className="text-xs text-bark font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Sightings */}
        {recentSightings.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-semibold text-forest mb-4">
              Recent Sightings
            </h2>
            <div className="flex flex-col gap-3">
              {recentSightings.map((item) => (
                <article
                  key={item.sighting.id}
                  className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sand to-savanna/50 flex items-center justify-center text-2xl">
                    {categoryIcons[item.animal.category]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-forest">{item.animal.commonName}</div>
                    <div className="text-sm text-bark">{item.zooName}</div>
                  </div>
                  <div className="text-xs text-canopy whitespace-nowrap">
                    {formatRelativeTime(item.sighting.seenAt)}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <BottomNav active="home" />
    </div>
  );
}
