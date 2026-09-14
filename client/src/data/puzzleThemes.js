// Lichess puzzle theme ids → readable names. Most ids read fine once split at capitals.
const NAMES = {
  oneMove: 'One move',
  short: 'Short puzzle',
  long: 'Long puzzle',
  veryLong: 'Very long puzzle',
  xRayAttack: 'X-ray attack',
  superGM: 'Super GM game',
  master: 'Master game',
  masterVsMaster: 'Master vs master',
  mate: 'Checkmate',
};

export function themeName(id) {
  if (NAMES[id]) return NAMES[id];
  const mate = /^mateIn(\d+)$/.exec(id);
  if (mate) return `Mate in ${mate[1]}`;
  const words = id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
