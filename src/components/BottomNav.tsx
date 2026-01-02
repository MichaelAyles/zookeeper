import { Link } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { colors } from '../lib/colors';

interface BottomNavProps {
  active: 'home' | 'visit' | 'camera' | 'journal' | 'profile';
}

// SVG Icons
const HomeIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M12 3L4 9v12h5v-7h6v7h5V9l-8-6z" />
  </svg>
);

const VisitIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </svg>
);

const CameraIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" />
    <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
  </svg>
);

const JournalIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
  </svg>
);

const UserIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

export default function BottomNav({ active }: BottomNavProps) {
  const activeVisit = useStore((state) => state.activeVisit);

  const items = [
    { id: 'home' as const, Icon: HomeIcon, label: 'Home', path: '/' },
    { id: 'visit' as const, Icon: VisitIcon, label: 'Visit', path: activeVisit ? `/visit/${activeVisit.id}` : '/' },
    { id: 'camera' as const, Icon: CameraIcon, label: '', path: '/camera' },
    { id: 'journal' as const, Icon: JournalIcon, label: 'Journal', path: '/stats' },
    { id: 'profile' as const, Icon: UserIcon, label: 'User', path: '/settings' },
  ];

  return (
    <div
      className="bottom-nav-container"
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        padding: '12px 20px 28px',
        background: 'linear-gradient(0deg, rgba(247,244,240,1) 60%, transparent 100%)',
        zIndex: 100,
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '24px',
        padding: '8px 12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}>
        {items.map((item) => {
          const isCamera = item.id === 'camera';
          const isActive = active === item.id;

          if (isCamera) {
            return (
              <Link
                key={item.id}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: colors.terracotta,
                  boxShadow: '0 4px 12px rgba(183, 101, 77, 0.4)',
                  marginTop: '-24px',
                  textDecoration: 'none',
                }}
              >
                <item.Icon color="#fff" />
              </Link>
            );
          }

          return (
            <Link
              key={item.id}
              to={item.path}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                padding: '8px 12px',
                textDecoration: 'none',
              }}
            >
              <item.Icon color={isActive ? colors.forest : colors.forest} />
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                color: isActive ? colors.forest : colors.forest,
              }}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
