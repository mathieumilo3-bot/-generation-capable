import { F } from '../fonts';
import { Edit, Theme } from './edit';

export const themeFor = (edit: Edit): Theme => {
  const v = edit.height > edit.width;
  return {
    accent: '#F5C451',
    accent2: '#FF6B3D',
    text: '#FFFFFF',
    shadow: '0 4px 20px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.55)',
    captionFont: F.heavy,
    captionWeight: 900,
    captionSize: v ? 86 : 62,
    captionY: v ? 0.68 : 0.85,
    upper: true,
    ...edit.theme,
  };
};
