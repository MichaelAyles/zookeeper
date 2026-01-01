import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { api } from '../lib/api';
import { getActiveVisit } from '../services/visits';
import { getZooById } from '../services/zoos';
import { getSightingsByVisit } from '../services/sightings';
import { getAnimalsByZoo } from '../services/animals';
import { getUserStats, getRecentSightings } from '../services/stats';
import { getGreeting, percentage, formatRelativeTime, categoryIcons } from '../lib/utils';
import { colors } from '../lib/colors';
import type { UserStats, Visit, Zoo, AnimalCategory } from '../types';
import BottomNav from '../components/BottomNav';

export default function Home() {
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const setActiveVisit = useStore((state) => state.setActiveVisit);
  const navigate = useNavigate();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [activeVisit, setActiveVisitState] = useState<Visit | null>(null);
  const [activeZoo, setActiveZoo] = useState<Zoo | null>(null);
  const [progress, setProgress] = useState({ seen: 0, total: 0 });
  const [showMenu, setShowMenu] = useState(false);
  const [recentSightings, setRecentSightings] = useState<Array<{
    sighting: { id: string; seenAt: string };
    animal: { commonName: string; category: AnimalCategory };
    zooName: string;
  }>>([]);

  useEffect(() => {
    async function loadData() {
      try {
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
      } catch (err) {
        console.error('Failed to load home data:', err);
      }
    }
    loadData();
  }, [setActiveVisit]);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Continue with logout even if API fails
    }
    logout();
    navigate('/');
  };

  const isRecent = (dateStr: string) => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return new Date(dateStr) > hourAgo;
  };

  const firstInitial = user?.displayName?.charAt(0).toUpperCase() || 'U';
  const progressPercent = percentage(progress.seen, progress.total);
  const isFirstTime = !stats || stats.totalZoosVisited === 0;

  return (
    <div style={{
      height: '100%',
      minHeight: '100vh',
      background: colors.cream,
      overflow: 'auto',
      position: 'relative',
    }}>
      {/* Status bar spacer */}
      <div style={{ height: '24px' }} />

      {/* Header */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: '14px', color: colors.textMuted }}>{getGreeting()}</p>
            <h1 style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: '700', color: colors.text }}>
              {user?.displayName} 👋
            </h1>
          </div>
          <div style={{ position: 'relative' }}>
            {user?.avatarUrl ? (
              <button
                onClick={() => setShowMenu(!showMenu)}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  padding: 0,
                  border: 'none',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>
            ) : (
              <button
                onClick={() => setShowMenu(!showMenu)}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.terracotta} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {firstInitial}
              </button>
            )}
            {showMenu && (
              <>
                <div
                  onClick={() => setShowMenu(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                />
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '52px',
                  background: '#fff',
                  borderRadius: '14px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                  padding: '8px 0',
                  minWidth: '160px',
                  zIndex: 50,
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.sand}` }}>
                    <p style={{ margin: 0, fontWeight: '600', color: colors.text }}>{user?.displayName}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textMuted }}>{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                      color: colors.terracotta,
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    🚪 Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Active Visit Card or Empty State */}
      <div style={{ padding: '0 20px 20px' }}>
        {activeVisit && activeZoo ? (
          <div style={{
            background: colors.forest,
            borderRadius: '20px',
            padding: '22px',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Subtle pattern */}
            <div style={{
              position: 'absolute',
              right: '-30px',
              top: '-30px',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
            }} />
            <div style={{
              position: 'absolute',
              right: '30px',
              bottom: '-40px',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
            }} />

            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#6EE7B7',
                }} />
                <span style={{ fontSize: '12px', fontWeight: '600', opacity: 0.9 }}>Active visit</span>
              </div>

              <h2 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: '700' }}>
                {activeZoo.name}
              </h2>

              {/* Progress */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', opacity: 0.9 }}>{progress.seen} of {progress.total} animals</span>
                  <span style={{ fontSize: '14px', fontWeight: '700' }}>{Math.round(progressPercent)}%</span>
                </div>
                <div style={{
                  height: '6px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: colors.gold,
                    borderRadius: '3px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              <button
                onClick={() => navigate('/camera')}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#fff',
                  color: colors.forest,
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '18px' }}>📷</span>
                Spot an Animal
              </button>
            </div>
          </div>
        ) : isFirstTime ? (
          <div style={{
            background: '#fff',
            borderRadius: '20px',
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <span style={{ fontSize: '64px' }}>🦒</span>
            <h2 style={{ margin: '16px 0 8px', fontSize: '20px', fontWeight: '700', color: colors.text }}>
              Ready for your first adventure?
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: colors.textMuted }}>
              Visit a zoo and start collecting animals.
            </p>
            <Link
              to="/zoo-select"
              style={{
                display: 'block',
                padding: '14px',
                borderRadius: '12px',
                background: colors.terracotta,
                color: '#fff',
                fontSize: '15px',
                fontWeight: '700',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              🏛️ Find a Zoo
            </Link>
          </div>
        ) : (
          <Link
            to="/zoo-select"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '20px',
              borderRadius: '16px',
              border: `2px dashed ${colors.forest}`,
              background: `${colors.forest}08`,
              color: colors.forest,
              fontSize: '16px',
              fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            <span style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: colors.forest,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}>+</span>
            Start New Zoo Visit
          </Link>
        )}
      </div>

      {/* Stats Row */}
      {stats && stats.totalZoosVisited > 0 && (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {[
              { value: stats.totalAnimalsSpotted, label: 'Animals', emoji: '🦒' },
              { value: stats.totalZoosVisited, label: 'Zoos', emoji: '🏛️' },
              { value: stats.totalPhotos, label: 'Photos', emoji: '📸' },
            ].map((stat, i) => (
              <div key={i} style={{
                flex: 1,
                background: '#fff',
                borderRadius: '16px',
                padding: '16px 12px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <span style={{ fontSize: '24px' }}>{stat.emoji}</span>
                <p style={{
                  margin: '8px 0 2px',
                  fontSize: '22px',
                  fontWeight: '700',
                  color: colors.text,
                }}>{stat.value}</p>
                <p style={{
                  margin: 0,
                  fontSize: '12px',
                  color: colors.textMuted,
                  fontWeight: '500',
                }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sightings */}
      {recentSightings.length > 0 && (
        <div style={{ padding: '0 20px 100px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: colors.text }}>
              Recent sightings
            </h3>
            <Link to="/stats" style={{ fontSize: '14px', color: colors.forest, fontWeight: '600', textDecoration: 'none' }}>
              See all
            </Link>
          </div>

          {recentSightings.map((item) => (
            <div key={item.sighting.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 16px',
              background: '#fff',
              borderRadius: '14px',
              marginBottom: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: isRecent(item.sighting.seenAt) ? `${colors.gold}20` : colors.warmGray,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
              }}>
                {categoryIcons[item.animal.category]}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: '600',
                  color: colors.text,
                }}>{item.animal.commonName}</p>
                <p style={{
                  margin: '3px 0 0',
                  fontSize: '13px',
                  color: colors.textMuted,
                }}>{formatRelativeTime(new Date(item.sighting.seenAt))}</p>
              </div>
              {isRecent(item.sighting.seenAt) && (
                <div style={{
                  padding: '4px 10px',
                  background: colors.gold,
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '700',
                }}>
                  NEW
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <BottomNav active="home" />
    </div>
  );
}
