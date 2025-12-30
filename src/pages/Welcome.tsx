import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { generateId } from '../lib/db';

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
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 text-center animate-slide-up">
        <div className="text-6xl mb-4">🦁</div>
        <h1 className="font-display text-4xl font-bold text-forest">
          Z<span className="text-terracotta">oo</span>keeper
        </h1>
        <p className="text-bark mt-2">Track animals at every zoo you visit</p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm animate-slide-up"
        style={{ animationDelay: '0.1s' }}
      >
        <div className="bg-white rounded-[20px] p-6 shadow-[var(--shadow-card)]">
          <label className="block mb-2 font-semibold text-forest">
            What's your name?
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 rounded-[12px] border-2 border-sand bg-cream
                       font-body text-forest placeholder:text-bark/50
                       focus:border-canopy focus:outline-none transition-colors"
            autoFocus
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full mt-4 py-4 rounded-[16px] bg-forest text-white
                       font-display font-semibold text-lg
                       shadow-[var(--shadow-button)]
                       hover:bg-forest-light transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Exploring
          </button>
        </div>
      </form>

      {/* Footer */}
      <p className="mt-8 text-sm text-bark/60 animate-fade-in" style={{ animationDelay: '0.3s' }}>
        Your data stays on this device
      </p>
    </div>
  );
}
