import { useEffect, useState } from 'react';
import { getUserStats, getRecentSightings, getCategoryStats } from '../services/stats';
import { categoryIcons, formatRelativeTime } from '../lib/utils';
import { colors } from '../lib/colors';
import type { UserStats, AnimalCategory, CategoryStats } from '../types';
import BottomNav from '../components/BottomNav';

export default function Stats() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [recentSightings, setRecentSightings] = useState<Array<{
    sighting: { id: string; seenAt: Date };
    animal: { commonName: string; category: AnimalCategory };
    zooName: string;
  }>>([]);

  useEffect(() => {
    async function loadData() {
      const userStats = await getUserStats();
      setStats(userStats);

      const catStats = await getCategoryStats();
      setCategoryStats(catStats);

      const recent = await getRecentSightings(10);
      setRecentSightings(recent);
    }
    loadData();
  }, []);

  const uniqueSpeciesCount = categoryStats.reduce((sum, cat) => sum + cat.count, 0);

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
        <h1 style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: '700', color: colors.text }}>
          Your Stats
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: colors.textMuted }}>
          Track your wildlife journey
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
          }}>
            {[
              { value: stats.totalAnimalsSpotted, label: 'Animals Spotted', emoji: '🦒', color: colors.gold },
              { value: stats.totalZoosVisited, label: 'Zoos Visited', emoji: '🏛️', color: colors.forest },
              { value: stats.totalPhotos, label: 'Photos Taken', emoji: '📸', color: colors.terracotta },
              { value: uniqueSpeciesCount, label: 'Unique Species', emoji: '⭐', color: colors.forestLight },
            ].map((stat, i) => (
              <div key={i} style={{
                background: '#fff',
                borderRadius: '18px',
                padding: '20px 16px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <span style={{ fontSize: '32px' }}>{stat.emoji}</span>
                <p style={{
                  margin: '12px 0 4px',
                  fontSize: '28px',
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

      {/* Category Breakdown */}
      {categoryStats.length > 0 && (
        <div style={{ padding: '0 20px 24px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '700', color: colors.text }}>
            By Category
          </h3>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            {categoryStats.filter(cat => cat.count > 0).map((catStat, i, arr) => (
              <div key={catStat.category} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 0',
                borderBottom: i < arr.length - 1 ? `1px solid ${colors.sand}` : 'none',
              }}>
                <span style={{ fontSize: '24px' }}>
                  {categoryIcons[catStat.category]}
                </span>
                <span style={{
                  flex: 1,
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                }}>
                  {catStat.category}
                </span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: colors.forest,
                }}>
                  {catStat.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentSightings.length > 0 && (
        <div style={{ padding: '0 20px 100px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '700', color: colors.text }}>
            Recent Activity
          </h3>
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
                background: colors.warmGray,
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
                  fontSize: '12px',
                  color: colors.textMuted,
                }}>{item.zooName}</p>
              </div>
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: colors.textLight,
              }}>
                {formatRelativeTime(item.sighting.seenAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      <BottomNav active="profile" />
    </div>
  );
}
