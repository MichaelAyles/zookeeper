import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { api } from '../lib/api';
import { colors } from '../lib/colors';
import BottomNav from '../components/BottomNav';

export default function Settings() {
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const navigate = useNavigate();

  const [testCameraEnabled, setTestCameraEnabled] = useState(() =>
    localStorage.getItem('testCameraEnabled') === 'true'
  );

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Continue with logout even if API fails
    }
    logout();
    navigate('/');
  };

  const toggleTestCamera = () => {
    const newValue = !testCameraEnabled;
    setTestCameraEnabled(newValue);
    localStorage.setItem('testCameraEnabled', String(newValue));
  };

  const firstInitial = user?.displayName?.charAt(0).toUpperCase() || 'U';

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
      <div style={{ padding: '0 20px 24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: '700', color: colors.text }}>
          Settings
        </h1>
      </div>

      {/* Profile Card */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.terracotta} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: '700',
              color: '#fff',
            }}>
              {firstInitial}
            </div>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <p style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '700',
                color: colors.text,
              }}>{user?.displayName}</p>
              {user?.isAdmin && (
                <span style={{
                  padding: '2px 8px',
                  background: colors.forest,
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: '700',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                }}>Admin</span>
              )}
            </div>
            <p style={{
              margin: '4px 0 0',
              fontSize: '14px',
              color: colors.textMuted,
            }}>{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Admin Panel - Only show for admins */}
      {user?.isAdmin && (
        <div style={{ padding: '0 20px 24px' }}>
          <h3 style={{
            margin: '0 0 12px',
            fontSize: '14px',
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Admin Tools
          </h3>
          <div style={{
            background: '#fff',
            borderRadius: '18px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            border: `2px solid ${colors.forest}20`,
          }}>
            <button
              onClick={() => navigate('/admin')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${colors.sand}`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '22px' }}>🏛️</span>
              <span style={{
                flex: 1,
                fontSize: '15px',
                fontWeight: '600',
                color: colors.text,
              }}>Zoo Manager</span>
              <span style={{ color: colors.textMuted }}>→</span>
            </button>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 20px',
              }}
            >
              <span style={{ fontSize: '22px' }}>📷</span>
              <span style={{
                flex: 1,
                fontSize: '15px',
                fontWeight: '600',
                color: colors.text,
              }}>Test Camera Mode</span>
              <button
                onClick={toggleTestCamera}
                style={{
                  width: '50px',
                  height: '28px',
                  borderRadius: '14px',
                  border: 'none',
                  background: testCameraEnabled ? colors.forest : colors.sand,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '3px',
                  left: testCameraEnabled ? '25px' : '3px',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{
          background: '#fff',
          borderRadius: '18px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          {[
            { icon: '📊', label: 'View Stats', action: () => navigate('/stats') },
            { icon: '🏛️', label: 'Past Visits', action: () => navigate('/') },
            { icon: '📸', label: 'Photo Gallery', action: () => {} },
            { icon: '⚙️', label: 'Preferences', action: () => {} },
          ].map((item, i, arr) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: i < arr.length - 1 ? `1px solid ${colors.sand}` : 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '22px' }}>{item.icon}</span>
              <span style={{
                flex: 1,
                fontSize: '15px',
                fontWeight: '600',
                color: colors.text,
              }}>{item.label}</span>
              <span style={{ color: colors.textMuted }}>→</span>
            </button>
          ))}
        </div>
      </div>

      {/* About Section */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{
          background: '#fff',
          borderRadius: '18px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
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
            <div>
              <p style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '700',
                color: colors.text,
              }}>
                Z<span style={{ color: colors.terracotta }}>oo</span>keeper
              </p>
              <p style={{
                margin: '2px 0 0',
                fontSize: '12px',
                color: colors.textMuted,
              }}>Version 2.0.0</p>
            </div>
          </div>
          <p style={{
            margin: 0,
            fontSize: '13px',
            color: colors.textMuted,
            lineHeight: '1.5',
          }}>
            Track your wildlife adventures and collect sightings at zoos around the world. Your data syncs across all your devices.
          </p>
        </div>
      </div>

      {/* Logout */}
      <div style={{ padding: '0 20px 100px' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '14px',
            border: `2px solid ${colors.terracotta}`,
            background: 'transparent',
            color: colors.terracotta,
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          🚪 Sign Out
        </button>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
