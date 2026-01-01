import { Link } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { colors } from '../lib/colors';

interface BottomNavProps {
  active: 'home' | 'spot' | 'collection' | 'profile';
}

export default function BottomNav({ active }: BottomNavProps) {
  const activeVisit = useStore((state) => state.activeVisit);

  const items = [
    { id: 'home' as const, icon: '🏠', label: 'Home', path: '/' },
    { id: 'spot' as const, icon: '📷', label: 'Spot', path: '/camera' },
    { id: 'collection' as const, icon: '📖', label: 'Collection', path: activeVisit ? `/visit/${activeVisit.id}` : '/' },
    { id: 'profile' as const, icon: '👤', label: 'Profile', path: '/settings' },
  ];

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '12px 24px 28px',
      background: 'linear-gradient(0deg, #fff 60%, transparent 100%)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        background: '#fff',
        borderRadius: '20px',
        padding: '12px 8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}>
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.path}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 16px',
              borderRadius: '12px',
              background: active === item.id ? `${colors.forest}15` : 'transparent',
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              color: active === item.id ? colors.forest : colors.textMuted,
            }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
