import { ThemeProvider } from 'next-themes';

// Mantido igual ao script de index.html, que aplica o tema antes da renderização.
export const THEME_STORAGE_KEY = 'mediamind-theme';

export const THEME_OPTIONS = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
];

export function MediaMindThemeProvider({ children }) {
  return (
    <ThemeProvider
      attribute="class"
      themes={['light', 'dark']}
      defaultTheme="dark"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      // Sem color-scheme: controles nativos (sliders, selects) mantêm a aparência original.
      enableColorScheme={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
