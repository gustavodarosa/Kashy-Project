import { useState } from 'react';

const themes = {
  default: {
    name: 'Padrão (Escuro)',
    colors: {
      '--color-bg-primary': '#19181D',       
      '--color-bg-secondary': '#1F1E22',    
      '--color-bg-tertiary': '#28272b',      
      '--color-text-primary': '#ffffff',    
      '--color-text-secondary': '#a0aec0',   
      '--color-accent': '#0f0f0f',           
      '--color-accent-hover': '#0f0f0f',     
      '--color-border': '#4a5568',           
      '--color-success': '#10b981', 
      '--color-success-hover': '#059669',         
      '--color-danger': '#ef4444',    
      '--color-danger-hover': '#dc2626',       
      '--color-chart-primary': 'rgb(206, 55, 45)', 
    },
  },
  oceanBlue: {
    name: 'Azul Oceano',
    colors: {
      '--color-bg-primary': '#0f2540',
      '--color-bg-secondary': '#1a3a5f',
      '--color-bg-tertiary': '#1f3c63',
      '--color-text-primary': '#e0f2fe',
      '--color-text-secondary': '#94a3b8',
      '--color-accent': '#38bdf8',
      '--color-accent-hover': '#0ea5e9',
      '--color-border': '#334155',
      '--color-success': '#22c55e',
      '--color-success-hover': '#16a34a',
      '--color-danger': '#f43f5e',
      '--color-danger-hover': '#e11d48',
      '--color-chart-primary': 'rgb(56, 189, 248)',
    },
  },
  forestGreen: {
    name: 'Verde Floresta',
    colors: {
      '--color-bg-primary': '#1F3E2F',
      '--color-bg-secondary': '#2A523A',
      '--color-bg-tertiary': '#356348',
      '--color-text-primary': '#ffffff',
      '--color-text-secondary': '#9ca3af',
      '--color-accent': '#34d399',
      '--color-accent-hover': '#10b981',
      '--color-border': '#4b5563',
      '--color-success': '#84cc16',
      '--color-danger': '#f43f5e',
      '--color-chart-primary': 'rgb(52, 211, 153)',
    },
  },
  sunsetOrange: {
    name: 'Laranja Pôr do Sol',
    colors: {
      '--color-bg-primary': '#371418',
      '--color-bg-secondary': '#62272D',
      '--color-bg-tertiary': '#502127',
      '--color-text-primary': '#ffffff',
      '--color-text-secondary': '#d1d5db',
      '--color-accent': '#692f36',
      '--color-accent-hover': '#f97316',
      '--color-border': '#6b7280',
      '--color-success': '#22c55e',
      '--color-danger': '#e11d48',
      '--color-chart-primary': 'rgb(251, 146, 60)',
    },
  },
  
};

type ThemeKey = keyof typeof themes;


const applyTheme = (themeKey: ThemeKey) => {
  const theme = themes[themeKey];
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  localStorage.setItem('dashboardTheme', themeKey);
};


const loadTheme = (): ThemeKey => {
  const savedTheme = localStorage.getItem('dashboardTheme') as ThemeKey | null;
  const defaultThemeKey: ThemeKey = 'default'; 
  const themeKey = savedTheme && themes[savedTheme] ? savedTheme : defaultThemeKey;
  applyTheme(themeKey); 
  return themeKey;
};


export function SettingsTab() {
    const [activeTheme, setActiveTheme] = useState<ThemeKey>(loadTheme); 

    const handleThemeChange = (themeKey: ThemeKey) => {
        applyTheme(themeKey);
        setActiveTheme(themeKey);
    };

    return (
        <div className="space-y-8">
            <h2 className="text-2xl text-[var(--color-text-primary)] font-bold">Configurações</h2>

            <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-4 text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2">Tema de Cores</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6">Escolha uma paleta de cores para personalizar a aparência do dashboard.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {(Object.keys(themes) as ThemeKey[]).map((key) => {
                        const theme = themes[key];
                        const isActive = activeTheme === key;
                        return (
                            <div
                                key={key}
                                onClick={() => handleThemeChange(key)}
                                className={`p-4 rounded-lg cursor-pointer border-2 transition-all duration-200 ${
                                    isActive
                                        ? 'border-[var(--color-accent)] scale-105 shadow-lg'
                                        : 'border-transparent hover:border-[var(--color-accent)] hover:scale-105'
                                }`}
                                style={{ backgroundColor: theme.colors['--color-bg-tertiary'] }} 
                            >
                                <p className="font-medium mb-3 text-center text-[var(--color-text-primary)]" style={{ color: theme.colors['--color-text-primary'] }}>{theme.name}</p>
                                <div className="flex justify-center space-x-2">
                                    <div className="w-6 h-6 rounded-full border border-gray-500" style={{ backgroundColor: theme.colors['--color-bg-primary'] }}></div>
                                    <div className="w-6 h-6 rounded-full border border-gray-500" style={{ backgroundColor: theme.colors['--color-bg-secondary'] }}></div>
                                    <div className="w-6 h-6 rounded-full border border-gray-500" style={{ backgroundColor: theme.colors['--color-accent'] }}></div>
                                    <div className="w-6 h-6 rounded-full border border-gray-500" style={{ backgroundColor: theme.colors['--color-text-primary'] }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
}
