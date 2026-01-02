import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { api } from '../lib/api';
import { colors } from '../lib/colors';
import type { Zoo, ZooAnimal } from '../types';

export default function Admin() {
  const user = useStore((state) => state.user);
  const navigate = useNavigate();

  const [zoos, setZoos] = useState<Zoo[]>([]);
  const [selectedZoo, setSelectedZoo] = useState<Zoo | null>(null);
  const [animals, setAnimals] = useState<ZooAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [message, setMessage] = useState('');

  // Add zoo form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newZoo, setNewZoo] = useState({ name: '', city: '', country: '' });
  const [addingZoo, setAddingZoo] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate('/settings');
    }
  }, [user, navigate]);

  // Load zoos
  useEffect(() => {
    async function loadZoos() {
      try {
        const data = await api.get<Zoo[]>('/api/zoos');
        setZoos(data);
      } catch (err) {
        console.error('Failed to load zoos:', err);
      } finally {
        setLoading(false);
      }
    }
    loadZoos();
  }, []);

  // Load animals when zoo selected
  useEffect(() => {
    if (!selectedZoo) {
      setAnimals([]);
      return;
    }

    const zooId = selectedZoo.id;
    async function loadAnimals() {
      try {
        const data = await api.get<ZooAnimal[]>(`/api/zoos/${zooId}/animals`);
        setAnimals(data);
      } catch (err) {
        console.error('Failed to load animals:', err);
      }
    }
    loadAnimals();
  }, [selectedZoo]);

  const handleScrapeZoo = async () => {
    if (!selectedZoo) return;

    setScraping(true);
    setMessage('');

    try {
      const result = await api.post<{ animals: ZooAnimal[]; message: string }>(
        `/api/zoos/${selectedZoo.id}/animals/generate`
      );
      setAnimals(result.animals || []);
      setMessage(`Generated ${result.animals?.length || 0} animals`);
    } catch (err) {
      setMessage('Failed to generate animals');
      console.error(err);
    } finally {
      setScraping(false);
    }
  };

  const handleAddZoo = async () => {
    if (!newZoo.name || !newZoo.country) {
      setMessage('Name and country are required');
      return;
    }

    setAddingZoo(true);
    setMessage('');

    try {
      const created = await api.post<Zoo>('/api/zoos', newZoo);
      setZoos(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedZoo(created);
      setNewZoo({ name: '', city: '', country: '' });
      setShowAddForm(false);
      setMessage(`Added ${created.name}`);
    } catch (err) {
      setMessage('Failed to add zoo');
      console.error(err);
    } finally {
      setAddingZoo(false);
    }
  };

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div style={{
      height: '100%',
      minHeight: '100vh',
      background: colors.cream,
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        background: colors.forest,
        padding: '24px 20px 20px',
        color: '#fff',
      }}>
        <button
          onClick={() => navigate('/settings')}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
            marginBottom: '12px',
          }}
        >
          ← Back to Settings
        </button>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
          Zoo Manager
        </h1>
        <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '14px' }}>
          Manage zoos and generate animal lists
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {/* Zoo Selector */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{
            margin: '0 0 12px',
            fontSize: '16px',
            fontWeight: '700',
            color: colors.text,
          }}>
            Select Zoo
          </h3>
          {loading ? (
            <p style={{ color: colors.textMuted }}>Loading zoos...</p>
          ) : (
            <>
              <select
                value={selectedZoo?.id || ''}
                onChange={(e) => {
                  const zoo = zoos.find(z => z.id === e.target.value);
                  setSelectedZoo(zoo || null);
                  setMessage('');
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: `2px solid ${colors.sand}`,
                  fontSize: '16px',
                  background: '#fff',
                  marginBottom: '12px',
                }}
              >
                <option value="">-- Select a zoo --</option>
                {zoos.map(zoo => (
                  <option key={zoo.id} value={zoo.id}>
                    {zoo.name} ({zoo.country})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: `2px dashed ${colors.forest}`,
                  background: 'transparent',
                  color: colors.forest,
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {showAddForm ? '− Cancel' : '+ Add New Zoo'}
              </button>

              {showAddForm && (
                <div style={{ marginTop: '16px' }}>
                  <input
                    type="text"
                    placeholder="Zoo name *"
                    value={newZoo.name}
                    onChange={(e) => setNewZoo(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: `2px solid ${colors.sand}`,
                      fontSize: '16px',
                      marginBottom: '8px',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="City (optional)"
                    value={newZoo.city}
                    onChange={(e) => setNewZoo(prev => ({ ...prev, city: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: `2px solid ${colors.sand}`,
                      fontSize: '16px',
                      marginBottom: '8px',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Country *"
                    value={newZoo.country}
                    onChange={(e) => setNewZoo(prev => ({ ...prev, country: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: `2px solid ${colors.sand}`,
                      fontSize: '16px',
                      marginBottom: '12px',
                    }}
                  />
                  <button
                    onClick={handleAddZoo}
                    disabled={addingZoo}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      border: 'none',
                      background: addingZoo ? colors.sand : colors.forest,
                      color: '#fff',
                      fontSize: '15px',
                      fontWeight: '700',
                      cursor: addingZoo ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {addingZoo ? 'Adding...' : 'Add Zoo'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Zoo Details & Actions */}
        {selectedZoo && (
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '16px',
            }}>
              <div>
                <h3 style={{
                  margin: '0 0 4px',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: colors.text,
                }}>
                  {selectedZoo.name}
                </h3>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: colors.textMuted,
                }}>
                  {selectedZoo.city ? `${selectedZoo.city}, ` : ''}{selectedZoo.country}
                </p>
              </div>
              <span style={{
                background: animals.length > 0 ? colors.forest : colors.sand,
                color: animals.length > 0 ? '#fff' : colors.textMuted,
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '700',
              }}>
                {animals.length} animals
              </span>
            </div>

            <button
              onClick={handleScrapeZoo}
              disabled={scraping}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: scraping ? colors.sand : colors.terracotta,
                color: '#fff',
                fontSize: '15px',
                fontWeight: '700',
                cursor: scraping ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {scraping ? (
                <>Generating...</>
              ) : (
                <>🔄 Generate Animal List (AI)</>
              )}
            </button>

            {message && (
              <p style={{
                margin: '12px 0 0',
                padding: '10px',
                background: message.includes('Failed') ? `${colors.terracotta}20` : `${colors.forest}20`,
                borderRadius: '8px',
                fontSize: '14px',
                color: message.includes('Failed') ? colors.terracotta : colors.forest,
                textAlign: 'center',
              }}>
                {message}
              </p>
            )}
          </div>
        )}

        {/* Animal List */}
        {selectedZoo && animals.length > 0 && (
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <h3 style={{
              margin: '0 0 16px',
              fontSize: '16px',
              fontWeight: '700',
              color: colors.text,
            }}>
              Animals ({animals.length})
            </h3>
            <div style={{
              maxHeight: '400px',
              overflow: 'auto',
            }}>
              {animals.map(animal => (
                <div
                  key={animal.id}
                  style={{
                    padding: '12px 0',
                    borderBottom: `1px solid ${colors.sand}`,
                  }}
                >
                  <p style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: '600',
                    color: colors.text,
                  }}>
                    {animal.commonName}
                  </p>
                  <p style={{
                    margin: '2px 0 0',
                    fontSize: '12px',
                    color: colors.textMuted,
                  }}>
                    {animal.scientificName} • {animal.category}
                    {animal.exhibitArea && ` • ${animal.exhibitArea}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
