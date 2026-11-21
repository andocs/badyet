import { useColorScheme } from 'react-native';

// Night Emerald tokens, copied from app/globals.css (dark default, light override). See DESIGN.md.
const dark = {
  bg: '#0a1320',
  surface: '#101c2e',
  soft: '#17263b',
  ink: '#e8eef7',
  muted: '#93a5bd',
  line: '#223349',
  accent: '#34d399',
  onAccent: '#04281c',
  accentText: '#5ee6b4',
  err: '#ff8a8a',
  errTint: '#3b1f26',
  tint: '#0f3a33',
  blue: '#7fa8ff',
  gold: '#f6c453',
  violet: '#c4a0ff',
  teal: '#5cd0e6',
  pink: '#f28bc8',
  heroA: '#10294a',
  heroB: '#0b5a4e',
};

const light: typeof dark = {
  bg: '#f2f5f9',
  surface: '#ffffff',
  soft: '#e8eef5',
  ink: '#0e1b2e',
  muted: '#556579',
  line: '#e1e8f0',
  accent: '#087a5a',
  onAccent: '#ffffff',
  accentText: '#087a5a',
  err: '#c23a3a',
  errTint: '#fbe6e6',
  tint: '#ddf5ec',
  blue: '#2f5bd7',
  gold: '#9a6b00',
  violet: '#7a3fb8',
  teal: '#0f7a95',
  pink: '#b83a86',
  heroA: '#10294a',
  heroB: '#0b5a4e',
};

export type Palette = typeof dark;

export const fonts = {
  display: 'Gabarito_800ExtraBold',
  displayBold: 'Gabarito_700Bold',
  body: 'AtkinsonHyperlegibleNext_500Medium',
  bodyBold: 'AtkinsonHyperlegibleNext_700Bold',
};

/** Dark by default, like the web app; follows the phone's light setting. */
export function useTheme(): Palette {
  return useColorScheme() === 'light' ? light : dark;
}
