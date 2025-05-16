import { Script } from "vm";

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
  Orangetheme: {
    name: 'Tema Laranja',
    colors: {
      '--color-bg-primary': '#a1440b',
      '--color-bg-secondary': '#cb5703',
      '--color-bg-tertiary': '#81390d',
      '--color-shadow': '#ff900b',
      '--color-text-primary': 'rgb(255, 255, 255)',
      '--color-text-secondary': 'rgb(209, 213, 219)',
      '--color-accent': '#ff900b',
      '--color-accent-hover': 'rgb(234, 88, 12)',
      '--color-border': '#81390d',
      '--color-divide': 'rgb(248, 97, 41)',
    },
  },
  Purpletheme: {
    name: 'Tema Roxo',
    colors: {
      '--color-bg-primary': '#4e3778',
      '--color-bg-secondary': '#603c97',
      '--color-bg-tertiary': '#3d2a5b',
      '--color-shadow': '#e5e3fc',
      '--color-text-primary': 'rgb(252, 252, 252)',
      '--color-text-secondary': '#rgb(255, 255, 255)',
      '--color-accent': '#a855f7',
      '--color-accent-hover': '#9333ea',
      '--color-border': '#6b4c8a',
      '--color-divide': '#6b4c8a', // Adicionado
    },
  },
  Pinktheme: {
    name: 'Tema Rosa',
    colors: {
      '--color-bg-primary': 'rgb(153, 18, 97)',
      '--color-bg-secondary': 'rgb(202, 67, 130)',
      '--color-bg-tertiary': 'rgb(243, 84, 150)',
      '--color-shadow': '#e680b7',
      '--color-text-primary': 'rgb(255, 255, 255)',
      '--color-text-secondary': 'rgb(209, 213, 219)',
      '--color-accent': 'rgb(236, 72, 153)',
      '--color-accent-hover': 'rgb(219, 39, 119)',
      '--color-border': '#e680b7',
      '--color-divide': '#8f2552',
    },
  },
  Yellowtheme: {
    name: 'Tema Amarelo',
    colors: {
      '--color-bg-primary': '#a66a02',
      '--color-bg-secondary': '#d19500',
      '--color-bg-tertiary': '#d19500',
      '--color-shadow': 'rgb(251, 191, 36)',
      '--color-text-primary': 'rgb(255, 255, 255)',
      '--color-text-secondary': 'rgb(209, 213, 219)',
      '--color-accent': 'rgb(251, 191, 36)',
      '--color-accent-hover': 'rgb(245, 158, 11)',
      '--color-border': 'rgb(189, 161, 39)',
      '--color-divide': 'rgb(156, 116, 4)', // Adicionado // Adicionado
    },
  },
  Graytheme: {
    name: 'Tema Cinza',
    colors: {
      '--color-bg-primary': 'rgb(71, 71, 71)',
      '--color-bg-secondary': 'rgb(96, 96, 97)',
      '--color-bg-tertiary': '#3C3C3F',
      '--color-shadow': '#6b7280',
      '--color-text-primary': '#ffffff',
      '--color-text-secondary': '#a0aec0',
      '--color-accent': '#6b7280',
      '--color-accent-hover': '#4b5563',
      '--color-border': '#4b5563',
      '--color-divide': '#4b5563', // Adicionado
    },
  },
  Whitetheme: {
    name: 'Tema Branco',
    colors: {
      '--color-bg-primary': 'rgba(247, 247, 247, 0.53)',
      '--color-bg-secondary': 'rgba(255, 255, 255, 0.53)',
      '--color-bg-tertiary': 'rgba(255, 255, 255, 0.53)',
      '--color-shadow': 'rgb(37, 99, 235)',
      '--color-text-primary': 'rgb(37, 99, 235)',
      '--color-text-secondary': 'rgb(37, 99, 235)',
      '--color-accent': 'rgb(37, 99, 235)',
      '--color-accent-hover': 'rgb(37, 99, 235)',
      '--color-border': 'rgb(37, 99, 235)',
      '--color-divide': 'black', // Adicionado
    },
  },
  

} as const;
 
export type ThemeKey = keyof typeof themes;