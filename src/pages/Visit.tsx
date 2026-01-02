import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { getVisitById, endVisit } from '../services/visits';
import { getZooById } from '../services/zoos';
import { getAnimalsByZoo } from '../services/animals';
import { getSightingsByVisit, toggleSighting } from '../services/sightings';
import { categoryIcons } from '../lib/utils';
import { colors } from '../lib/colors';
import type { Zoo, ZooAnimal, Sighting, AnimalCategory } from '../types';
import BottomNav from '../components/BottomNav';

interface ChecklistItem {
  animal: ZooAnimal;
  sighting: Sighting | null;
}

export default function Visit() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const setActiveVisit = useStore((state) => state.setActiveVisit);

  const [zoo, setZoo] = useState<Zoo | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [filter, setFilter] = useState<AnimalCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!visitId) return;

      const visitData = await getVisitById(visitId);
      if (!visitData) {
        navigate('/');
        return;
      }

      const zooData = await getZooById(visitData.zooId);
      const animals = await getAnimalsByZoo(visitData.zooId);
      const sightings = await getSightingsByVisit(visitId);

      const sightingMap = new Map(sightings.map(s => [s.animalId, s]));
      const checklistItems: ChecklistItem[] = animals.map(animal => ({
        animal,
        sighting: sightingMap.get(animal.id) || null,
      }));

      setZoo(zooData || null);
      setChecklist(checklistItems);
      setActiveVisit(visitData, zooData || null);
      setLoading(false);
    }
    loadData();
  }, [visitId, navigate, setActiveVisit]);

  const handleToggle = async (animal: ZooAnimal) => {
    if (!visitId) return;
    await toggleSighting(visitId, animal.id);

    // Reload sightings
    const sightings = await getSightingsByVisit(visitId);
    const sightingMap = new Map(sightings.map(s => [s.animalId, s]));
    setChecklist(prev =>
      prev.map(item => ({
        ...item,
        sighting: sightingMap.get(item.animal.id) || null,
      }))
    );
  };

  const handleEndVisit = async () => {
    if (!visitId) return;
    await endVisit(visitId);
    setActiveVisit(null, null);
    navigate('/');
  };

  const categories: AnimalCategory[] = ['Mammals', 'Birds', 'Reptiles', 'Amphibians', 'Fish', 'Invertebrates'];
  const filterOptions: Array<{ label: string; value: AnimalCategory | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: '🦁 Mammals', value: 'Mammals' },
    { label: '🦅 Birds', value: 'Birds' },
    { label: '🐊 Reptiles', value: 'Reptiles' },
  ];

  const filteredChecklist = filter === 'all'
    ? checklist
    : checklist.filter(item => item.animal.category === filter);

  const groupedByCategory = categories.reduce((acc, category) => {
    const items = filteredChecklist.filter(item => item.animal.category === category);
    if (items.length > 0) {
      acc[category] = items;
    }
    return acc;
  }, {} as Record<AnimalCategory, ChecklistItem[]>);

  const spottedCount = checklist.filter(item => item.sighting).length;

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        background: colors.cream,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: colors.textMuted }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      background: colors.cream,
      overflowX: 'hidden',
      overflowY: 'auto',
      position: 'relative',
      paddingBottom: '100px',
    }}>
      {/* Status bar spacer */}
      <div style={{ height: '24px' }} />

      {/* Header */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: '700', color: colors.text }}>
              {zoo?.name || 'Collection'}
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: colors.textMuted }}>
              {spottedCount} of {checklist.length} species spotted
            </p>
          </div>
          <button
            onClick={handleEndVisit}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: `2px solid ${colors.terracotta}`,
              background: 'transparent',
              color: colors.terracotta,
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            End Visit
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}>
          {filterOptions.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                background: filter === tab.value ? colors.forest : '#fff',
                color: filter === tab.value ? '#fff' : colors.text,
                fontSize: '14px',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                boxShadow: filter === tab.value ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of animals */}
      <div style={{ padding: '0 20px' }}>
        {Object.entries(groupedByCategory).map(([category, items]) => {
          const categorySpotted = items.filter(item => item.sighting).length;
          return (
            <div key={category}>
              {/* Category header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '12px',
              }}>
                <span style={{ fontSize: '20px' }}>{categoryIcons[category as AnimalCategory]}</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: colors.text }}>
                  {category}
                </h3>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '13px',
                  color: colors.textMuted,
                }}>
                  {categorySpotted} spotted
                </span>
              </div>

              {/* Animal grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: '10px',
                marginBottom: '28px',
              }}>
                {items.map((item) => {
                  const spotted = !!item.sighting;
                  const isRecent = item.sighting &&
                    new Date(item.sighting.seenAt) > new Date(Date.now() - 60 * 60 * 1000);

                  return (
                    <button
                      key={item.animal.id}
                      onClick={() => handleToggle(item.animal)}
                      style={{
                        aspectRatio: '1',
                        background: spotted ? '#fff' : colors.warmGray,
                        borderRadius: '16px',
                        border: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        opacity: spotted ? 1 : 0.5,
                        boxShadow: spotted ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer',
                        padding: '8px',
                      }}
                    >
                      {isRecent && (
                        <div style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: colors.gold,
                        }} />
                      )}
                      <span style={{ fontSize: '32px', marginBottom: '4px' }}>
                        {categoryIcons[item.animal.category]}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: spotted ? colors.text : colors.textMuted,
                        textAlign: 'center',
                        lineHeight: '1.2',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.animal.commonName}
                      </span>
                      {!spotted && (
                        <span style={{ fontSize: '10px', color: colors.textLight, marginTop: '2px' }}>
                          Not seen
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav active="visit" />
    </div>
  );
}
