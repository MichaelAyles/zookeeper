import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { searchZoos, getZoos } from '../services/zoos';
import { startVisit } from '../services/visits';
import { colors } from '../lib/colors';
import type { Zoo } from '../types';

export default function ZooSelect() {
  const navigate = useNavigate();
  const setActiveVisit = useStore((state) => state.setActiveVisit);

  const [search, setSearch] = useState('');
  const [zoos, setZoos] = useState<Zoo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadZoos();
  }, []);

  async function loadZoos() {
    setLoading(true);
    const allZoos = await getZoos();
    setZoos(allZoos);
    setLoading(false);
  }

  async function handleSearch() {
    if (!search.trim()) {
      loadZoos();
      return;
    }

    setSearching(true);
    const results = await searchZoos(search.trim());
    setZoos(results);
    setSearching(false);
  }

  async function handleSelectZoo(zoo: Zoo) {
    // Start a visit
    const visit = await startVisit(zoo.id);
    setActiveVisit(visit, zoo);
    navigate(`/visit/${visit.id}`);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.cream,
      padding: '24px 20px',
    }}>
      {/* Status bar spacer */}
      <div style={{ height: '24px' }} />

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 0',
            background: 'transparent',
            border: 'none',
            color: colors.forest,
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '16px',
          }}
        >
          ← Back
        </button>
        <h1 style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: '700', color: colors.text }}>
          Find a Zoo
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: colors.textMuted }}>
          Search for a zoo to start your visit
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          gap: '10px',
        }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search zoos..."
            style={{
              flex: 1,
              padding: '14px 18px',
              fontSize: '16px',
              border: `2px solid ${colors.sand}`,
              borderRadius: '14px',
              outline: 'none',
              color: colors.text,
              background: '#fff',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            style={{
              padding: '14px 20px',
              borderRadius: '14px',
              border: 'none',
              background: colors.forest,
              color: '#fff',
              fontSize: '15px',
              fontWeight: '700',
              cursor: searching ? 'wait' : 'pointer',
            }}
          >
            {searching ? '...' : '🔍'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div>
        {loading ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: colors.textMuted,
          }}>
            Loading...
          </div>
        ) : zoos.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🔍</span>
            <p style={{ margin: 0, color: colors.textMuted }}>
              No zoos found. Try searching for a zoo name or city.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {zoos.map((zoo) => (
              <button
                key={zoo.id}
                onClick={() => handleSelectZoo(zoo)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '18px 20px',
                  background: '#fff',
                  borderRadius: '16px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: '52px',
                  height: '52px',
                  background: `linear-gradient(135deg, ${colors.gold}30 0%, ${colors.forest}20 100%)`,
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '26px',
                }}>
                  🏛️
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600',
                    color: colors.text,
                  }}>{zoo.name}</p>
                  <p style={{
                    margin: '4px 0 0',
                    fontSize: '13px',
                    color: colors.textMuted,
                  }}>
                    {zoo.city}, {zoo.country}
                  </p>
                </div>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: colors.warmGray,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.forest,
                  fontSize: '18px',
                }}>
                  →
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
