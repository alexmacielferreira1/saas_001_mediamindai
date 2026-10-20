import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { THEME_OPTIONS } from '../lib/theme';

const ICONS = { light: Sun, dark: Moon, system: Monitor };

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = theme || 'dark';

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="flex items-center rounded-xl border border-slate-700 bg-slate-900/60 p-1"
    >
      {THEME_OPTIONS.map(({ value, label }) => {
        const Icon = ICONS[value];
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Tema ${label}`}
            title={`Tema ${label}`}
            onClick={() => setTheme(value)}
            className={`rounded-lg p-1.5 transition ${
              active ? 'bg-slate-800 text-sky-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
