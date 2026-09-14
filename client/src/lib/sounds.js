// Game sounds synthesised with the Web Audio API, so there are no audio files to ship or license.
// Each theme defines the same events; the player picks one in Settings (stored with the other settings).

let context = null;
let noiseBuffer = null;

function audio() {
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) return null;
  context ??= new AudioContext();
  // Browsers start the context suspended until the page has had a user gesture.
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

function noise(ctx) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// A short filtered noise burst: the "knock" of a piece landing. `at` is seconds from now.
function knock(ctx, { at = 0, frequency, q = 1.2, gain, decay }) {
  const start = ctx.currentTime + at;
  const source = ctx.createBufferSource();
  source.buffer = noise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(gain, start);
  envelope.gain.exponentialRampToValueAtTime(0.001, start + decay);
  source.connect(filter).connect(envelope).connect(ctx.destination);
  source.start(start);
  source.stop(start + decay + 0.02);
}

// A pitched note; `slideTo` glides the pitch over the note's duration.
function tone(ctx, { at = 0, frequency, slideTo, type = 'sine', gain, duration }) {
  const start = ctx.currentTime + at;
  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

// Every sound takes (ctx, at) so a preview can schedule several in a row.
const THEMES = {
  wood: {
    move: (ctx, at) => {
      knock(ctx, { at, frequency: 1400, gain: 0.5, decay: 0.07 });
      tone(ctx, { at, frequency: 190, gain: 0.25, duration: 0.06 });
    },
    capture: (ctx, at) => {
      knock(ctx, { at, frequency: 900, gain: 0.7, decay: 0.1 });
      knock(ctx, { at: at + 0.045, frequency: 1600, gain: 0.45, decay: 0.08 });
      tone(ctx, { at, frequency: 150, gain: 0.3, duration: 0.09 });
    },
    check: (ctx, at) => {
      knock(ctx, { at, frequency: 1400, gain: 0.45, decay: 0.07 });
      tone(ctx, { at: at + 0.02, frequency: 660, type: 'triangle', gain: 0.18, duration: 0.12 });
      tone(ctx, { at: at + 0.12, frequency: 990, type: 'triangle', gain: 0.18, duration: 0.18 });
    },
    lowTime: (ctx, at) => {
      tone(ctx, { at, frequency: 880, type: 'triangle', gain: 0.2, duration: 0.1 });
      tone(ctx, { at: at + 0.16, frequency: 880, type: 'triangle', gain: 0.2, duration: 0.1 });
    },
  },

  soft: {
    move: (ctx, at) => {
      knock(ctx, { at, frequency: 650, q: 0.8, gain: 0.32, decay: 0.09 });
      tone(ctx, { at, frequency: 130, gain: 0.16, duration: 0.08 });
    },
    capture: (ctx, at) => {
      knock(ctx, { at, frequency: 480, q: 0.8, gain: 0.48, decay: 0.13 });
      knock(ctx, { at: at + 0.05, frequency: 850, q: 0.8, gain: 0.26, decay: 0.1 });
      tone(ctx, { at, frequency: 105, gain: 0.2, duration: 0.12 });
    },
    check: (ctx, at) => {
      knock(ctx, { at, frequency: 650, q: 0.8, gain: 0.3, decay: 0.09 });
      tone(ctx, { at: at + 0.03, frequency: 523, gain: 0.13, duration: 0.22 });
      tone(ctx, { at: at + 0.14, frequency: 659, gain: 0.13, duration: 0.3 });
    },
    lowTime: (ctx, at) => {
      tone(ctx, { at, frequency: 587, gain: 0.14, duration: 0.18 });
      tone(ctx, { at: at + 0.22, frequency: 587, gain: 0.14, duration: 0.18 });
    },
  },

  crisp: {
    move: (ctx, at) => {
      knock(ctx, { at, frequency: 3200, q: 2, gain: 0.65, decay: 0.035 });
      tone(ctx, { at, frequency: 1250, type: 'triangle', gain: 0.1, duration: 0.03 });
    },
    capture: (ctx, at) => {
      knock(ctx, { at, frequency: 2300, q: 2, gain: 0.65, decay: 0.05 });
      knock(ctx, { at: at + 0.03, frequency: 3900, q: 2, gain: 0.42, decay: 0.04 });
    },
    check: (ctx, at) => {
      knock(ctx, { at, frequency: 3200, q: 2, gain: 0.45, decay: 0.035 });
      tone(ctx, { at: at + 0.02, frequency: 1320, type: 'triangle', gain: 0.12, duration: 0.08 });
      tone(ctx, { at: at + 0.1, frequency: 1760, type: 'triangle', gain: 0.12, duration: 0.14 });
    },
    lowTime: (ctx, at) => {
      for (const offset of [0, 0.1, 0.2]) {
        tone(ctx, { at: at + offset, frequency: 1500, type: 'triangle', gain: 0.16, duration: 0.05 });
      }
    },
  },

  retro: {
    move: (ctx, at) => {
      tone(ctx, { at, frequency: 440, slideTo: 220, type: 'square', gain: 0.12, duration: 0.06 });
    },
    capture: (ctx, at) => {
      tone(ctx, { at, frequency: 330, slideTo: 90, type: 'square', gain: 0.15, duration: 0.13 });
      knock(ctx, { at, frequency: 2000, q: 0.7, gain: 0.3, decay: 0.06 });
    },
    check: (ctx, at) => {
      tone(ctx, { at, frequency: 660, type: 'square', gain: 0.12, duration: 0.07 });
      tone(ctx, { at: at + 0.09, frequency: 990, type: 'square', gain: 0.12, duration: 0.11 });
    },
    lowTime: (ctx, at) => {
      tone(ctx, { at, frequency: 880, type: 'square', gain: 0.1, duration: 0.05 });
      tone(ctx, { at: at + 0.12, frequency: 880, type: 'square', gain: 0.1, duration: 0.05 });
    },
  },
};

export const SOUND_THEMES = [
  { id: 'wood', name: 'Wood', description: 'Warm knocks, like pieces on a wooden board.' },
  { id: 'soft', name: 'Soft', description: 'Muted and gentle, easy to leave on for long games.' },
  { id: 'crisp', name: 'Crisp', description: 'Short, bright clicks for fast games.' },
  { id: 'retro', name: 'Retro', description: '8-bit blips.' },
];

export const DEFAULT_SOUND_THEME = SOUND_THEMES[0].id;

function run(play) {
  try {
    const ctx = audio();
    if (ctx) play(ctx);
  } catch {
    // Audio is a nicety; never let it break the game.
  }
}

const themeFor = (themeId) => THEMES[themeId] ?? THEMES[DEFAULT_SOUND_THEME];

// type: 'move' | 'capture' | 'check' | 'lowTime'
export function playSound(type, themeId) {
  run((ctx) => themeFor(themeId)[type]?.(ctx, 0));
}

// A short run of every sound: move, move, capture, check, low time.
export function previewSoundTheme(themeId) {
  const theme = themeFor(themeId);
  run((ctx) => {
    theme.move(ctx, 0);
    theme.move(ctx, 0.45);
    theme.capture(ctx, 0.9);
    theme.check(ctx, 1.45);
    theme.lowTime(ctx, 2.15);
  });
}

// Sound for a played move from its SAN.
export function moveSound(san) {
  if (/[+#]$/.test(san)) return 'check';
  return san.includes('x') ? 'capture' : 'move';
}
