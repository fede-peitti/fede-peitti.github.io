import { startZeroGravity, stopZeroGravity } from './domPhysics';

const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

const KEYWORD_MAP: Record<string, () => void> = {
  gravity: startZeroGravity,
  zerog: startZeroGravity,
  physics: startZeroGravity,
  antigravity: startZeroGravity,
};

let charBuffer: string[] = [];
let konamiSequence: string[] = [];

function onGlobalKeyDown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement | null)?.tagName;
  const isInput =
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    (e.target as HTMLElement | null)?.isContentEditable;

  if (isInput) return;

  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    charBuffer.push(e.key.toLowerCase());
    if (charBuffer.length > 25) charBuffer.shift();

    const typed = charBuffer.join('');

    for (const [kw, action] of Object.entries(KEYWORD_MAP)) {
      if (typed.endsWith(kw)) {
        charBuffer = [];
        konamiSequence = [];
        action();
        return;
      }
    }
  }

  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const expectedKey = KONAMI_CODE[konamiSequence.length];

  if (
    key === expectedKey ||
    (expectedKey && expectedKey.length === 1 && key === expectedKey.toLowerCase())
  ) {
    konamiSequence.push(expectedKey);

    if (konamiSequence.length === KONAMI_CODE.length) {
      konamiSequence = [];
      charBuffer = [];
    }
  } else {
    konamiSequence = key === KONAMI_CODE[0] ? [KONAMI_CODE[0]] : [];
  }
}

export function initEasterEggs(): () => void {
  window.addEventListener('keydown', onGlobalKeyDown);

  return () => {
    window.removeEventListener('keydown', onGlobalKeyDown);
    stopZeroGravity();
  };
}