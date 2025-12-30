import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

interface BottomNavProps {
  active: 'home' | 'visits' | 'stats' | 'settings';
}

const navItems = [
  { id: 'home', label: 'Home', icon: '🏠', href: '/' },
  { id: 'visits', label: 'Visits', icon: '📋', href: '/' },
  { id: 'stats', label: 'Stats', icon: '📊', href: '/stats' },
  { id: 'settings', label: 'Settings', icon: '⚙️', href: '/' },
] as const;

export default function BottomNav({ active }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white px-5 pt-3 pb-7
                    flex justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.08)]
                    rounded-t-[24px] z-50">
      {navItems.map((item) => (
        <Link
          key={item.id}
          to={item.href}
          className={cn(
            'flex flex-col items-center gap-1 px-4 py-1 transition-colors',
            active === item.id ? 'text-forest' : 'text-bark'
          )}
        >
          <span className={cn('text-2xl', active === item.id && 'animate-bounce-soft')}>
            {item.icon}
          </span>
          <span className="text-xs font-semibold">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
