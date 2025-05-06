type ThemeColors = {
  '--color-bg-primary': string;
  '--color-bg-secondary': string;
  '--color-bg-tertiary': string;
  '--color-shadow': string;
  '--color-text-primary': string;
  '--color-text-secondary': string;
  '--color-accent': string;
  '--color-accent-hover': string;
  '--color-border': string;
  '--color-divide': string; // Nova propriedade
  '--color-success'?: string;
  '--color-success-hover'?: string;
  '--color-danger'?: string;
  '--color-danger-hover'?: string;
};
 
export type Theme = {
  name: string;
  colors: ThemeColors;
};
 
export const themes = {
 
 
  default: {
    name: 'Tema Escuro',
    colors: {
      '--color-bg-primary': '#19181D',
      '--color-bg-secondary': '#1F1E22',
      '--color-bg-tertiary': '#28272b',
      '--color-shadow': '#404040',
      '--color-text-primary': '#ffffff',
      '--color-text-secondary': '#a0aec0',
      '--color-accent': '#0f0f0f',
      '--color-accent-hover': '#0f0f0f',
      '--color-border': '#303030',
      '--color-divide': '#303030', // Adicionado
    },
  },
  Bluetheme: {
    name: 'Tema Azul',
    colors: {
      '--color-bg-primary': 'rgb(17, 40, 54)',
      '--color-bg-secondary': 'rgb(24, 50, 66)',
      '--color-bg-tertiary': 'rgb(17, 40, 54)',
      '--color-shadow': 'rgb(112,255,189)',
      '--color-text-primary': '#e0f2fe',
      '--color-text-secondary': '#94a3b8',
      '--color-accent': '#38bdf8',
      '--color-accent-hover': '#0ea5e9',
      '--color-border': 'rgb(84, 87, 86)',
      '--color-divide': '#244770', // Adicionado
    },
  },
  Greentheme: {
    name: 'Tema Verde',
    colors: {
      '--color-bg-primary': '#1F3E2F',
      '--color-bg-secondary': '#2A523A',
      '--color-bg-tertiary': '#356348',
      '--color-shadow': '#28a87a',
      '--color-text-primary': '#ffffff',
      '--color-text-secondary': '#9ca3af',
      '--color-accent': '#34d399',
      '--color-accent-hover': '#10b981',
      '--color-border': '#3c7553',
      '--color-divide': '#3c7553', // Adicionado
    },
  },
  Redtheme: {
    name: 'Tema Vermelho',
    colors: {
      '--color-bg-primary': '#371418',
      '--color-bg-secondary': '#62272D',
      '--color-bg-tertiary': '#502127',
      '--color-shadow': '#9e2f3e',
      '--color-text-primary': '#ffffff',
      '--color-text-secondary': '#d1d5db',
      '--color-accent': '#a14f59',
      '--color-accent-hover': '#f97316',
      '--color-border': '#853941',
      '--color-divide': '#853941', // Adicionado
    },
  },
} as const;
 
export type ThemeKey = keyof typeof themes;