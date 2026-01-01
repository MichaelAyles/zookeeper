import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { generateId } from '../lib/db';
import { colors } from '../lib/colors';

export default function Welcome() {
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const setProfile = useStore((state) => state.setProfile);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setProfile({
      id: generateId(),
      displayName: name.trim(),
      createdAt: new Date(),
    });

    navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.cream,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '8px',
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          background: colors.forest,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
        }}>
          🦁
        </div>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: colors.text,
          margin: 0,
        }}>
          Z<span style={{ color: colors.terracotta }}>oo</span>keeper
        </h1>
      </div>

      <p style={{
        fontSize: '14px',
        color: colors.textMuted,
        margin: '0 0 32px',
      }}>
        Track your wildlife adventures
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '320px' }}>
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            style={{
              width: '100%',
              padding: '14px 18px',
              fontSize: '16px',
              border: `2px solid ${colors.sand}`,
              borderRadius: '12px',
              outline: 'none',
              color: colors.text,
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={!name.trim()}
            style={{
              width: '100%',
              padding: '14px',
              marginTop: '16px',
              borderRadius: '12px',
              border: 'none',
              background: name.trim() ? colors.forest : colors.sand,
              color: name.trim() ? '#fff' : colors.textMuted,
              fontSize: '16px',
              fontWeight: '700',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Start Exploring
          </button>
        </div>
      </form>
    </div>
  );
}
