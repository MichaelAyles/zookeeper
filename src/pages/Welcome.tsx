import { useState } from 'react';
import { colors } from '../lib/colors';

export default function Welcome() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDemoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
        credentials: 'include',
      });

      if (res.ok) {
        window.location.href = '/';
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
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

      {/* Sign in card */}
      <div style={{
        width: '100%',
        maxWidth: '320px',
        background: '#fff',
        borderRadius: '20px',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}>
        <form onSubmit={handleDemoLogin}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '12px',
              border: `2px solid ${colors.sand}`,
              fontSize: '16px',
              marginBottom: '12px',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: name.trim() ? colors.forest : colors.sand,
              color: name.trim() ? '#fff' : colors.textMuted,
              fontSize: '16px',
              fontWeight: '600',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Signing in...' : 'Start Exploring'}
          </button>
        </form>

        {error && (
          <p style={{
            fontSize: '14px',
            color: colors.terracotta,
            textAlign: 'center',
            marginTop: '12px',
            marginBottom: 0,
          }}>
            {error}
          </p>
        )}

        <p style={{
          fontSize: '12px',
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: '16px',
          marginBottom: 0,
        }}>
          Your data syncs across all your devices
        </p>
      </div>
    </div>
  );
}
