import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      // State
      theme: 'dark', // 'light' | 'dark' | 'system'
      resolvedTheme: 'dark', // actual applied theme

      // Actions
      setTheme: (theme) => {
        set({ theme });
        get().applyTheme(theme);
      },

      toggleTheme: () => {
        const newTheme = get().resolvedTheme === 'dark' ? 'light' : 'dark';
        set({ theme: newTheme });
        get().applyTheme(newTheme);
      },

      applyTheme: (theme) => {
        const root = window.document.documentElement;
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const resolvedTheme = theme === 'system' ? systemTheme : theme;

        set({ resolvedTheme });

        if (resolvedTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      },

      // Initialize theme on app load
      initTheme: () => {
        const { theme } = get();
        get().applyTheme(theme);

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
          if (get().theme === 'system') {
            get().applyTheme('system');
          }
        });
      },
    }),
    {
      name: 'syncra-theme',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
