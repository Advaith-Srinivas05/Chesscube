// Glicko-2 rating system (Glickman, "Example of the Glicko-2 system", 2013).
// Ratings are stored on the Glicko scale; CENTER is only the conversion point, not a starting rating.

export const SCALE = 173.7178;
export const CENTER = 1500;
export const TAU = 0.75;
export const EPSILON = 1e-6;
export const RD_MIN = 45;
export const RD_MAX = 350;
export const RATING_MIN = 100;
export const PROVISIONAL_RD = 110;

const g = (phi) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expected = (mu, muJ, gJ) => 1 / (1 + Math.exp(-gJ * (mu - muJ)));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// New volatility using the Illinois algorithm (step 5).
function newVolatility({ phi, vol, v, delta, tau }) {
  const a = Math.log(vol * vol);
  const phi2 = phi * phi;
  const f = (x) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi2 - v - ex)) / (2 * (phi2 + v + ex) ** 2) - (x - a) / (tau * tau);
  };

  let A = a;
  let B;
  if (delta * delta > phi2 + v) {
    B = Math.log(delta * delta - phi2 - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

/**
 * player: { r, rd, vol }; results: [{ r, rd, score }] with score 1 / 0.5 / 0.
 * Returns the new { r, rd, vol }. With no results the player is returned unchanged.
 */
export function rate(player, results, tau = TAU) {
  if (!results?.length) return { r: player.r, rd: player.rd, vol: player.vol };

  const mu = (player.r - CENTER) / SCALE;
  const phi = player.rd / SCALE;

  let vInverse = 0;
  let sum = 0;
  for (const { r, rd, score } of results) {
    const gJ = g(rd / SCALE);
    const E = expected(mu, (r - CENTER) / SCALE, gJ);
    vInverse += gJ * gJ * E * (1 - E);
    sum += gJ * (score - E);
  }
  const v = 1 / vInverse;
  const delta = v * sum;

  const vol = newVolatility({ phi, vol: player.vol, v, delta, tau });
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * sum;

  return {
    r: Math.max(RATING_MIN, SCALE * muNew + CENTER),
    rd: clamp(SCALE * phiNew, RD_MIN, RD_MAX),
    vol,
  };
}

// One game between two players, each rated against the other's pre-game values. scoreA is 1, 0.5 or 0.
export function rateGame(a, b, scoreA) {
  return [rate(a, [{ r: b.r, rd: b.rd, score: scoreA }]), rate(b, [{ r: a.r, rd: a.rd, score: 1 - scoreA }])];
}

export function isProvisional(rd) {
  return rd > PROVISIONAL_RD;
}
