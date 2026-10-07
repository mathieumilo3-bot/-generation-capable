import { continueRender, delayRender } from 'remotion';
import '@fontsource-variable/inter/standard.css';
import '@fontsource-variable/montserrat/wght.css';
import '@fontsource-variable/montserrat/wght-italic.css';
import '@fontsource-variable/archivo/standard.css';
import '@fontsource-variable/archivo/standard-italic.css';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource/anton/400.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';

export const F = {
  sans: "'Inter Variable', system-ui, sans-serif",
  heavy: "'Montserrat Variable', sans-serif",
  display: "'Archivo Variable', sans-serif",
  serif: "'Instrument Serif', serif",
  soft: "'Fraunces Variable', serif",
  mono: "'JetBrains Mono Variable', monospace",
  impact: "'Anton', sans-serif",
};

// Les polices doivent être prêtes avant la première image, sinon la première
// seconde est rendue avec une police de secours.
const handle = delayRender('Chargement des polices');
const sample = 'AÀÉÈÇaàéèçœ€0123456789';
Promise.all(
  [
    "800 100px 'Inter Variable'",
    "900 100px 'Montserrat Variable'",
    "italic 900 100px 'Montserrat Variable'",
    "900 100px 'Archivo Variable'",
    "italic 800 100px 'Archivo Variable'",
    "600 100px 'Fraunces Variable'",
    "italic 400 100px 'Fraunces Variable'",
    "500 100px 'JetBrains Mono Variable'",
    "400 100px 'Anton'",
    "400 100px 'Instrument Serif'",
    "italic 400 100px 'Instrument Serif'",
  ].map((f) => document.fonts.load(f, sample)),
).then(() => continueRender(handle));
