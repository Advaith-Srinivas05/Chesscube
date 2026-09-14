// Imports an evenly spread subset of the Lichess puzzle database (https://database.lichess.org/, CC0).
// Usage: npm run import:puzzles -- [--dry-run] [--reset] [--file path.csv(.zst)] [--per-bucket 3000]
//        [--min-plays 500] [--min-popularity 80] [--max-rd 90]
// Needs Node >= 22.15 for built-in zstd.
import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import { Readable, Transform } from 'node:stream';
import { parseArgs } from 'node:util';
import zlib from 'node:zlib';
import mongoose from 'mongoose';
import { Puzzle } from '../src/models/Puzzle.js';

const SOURCE_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const COLUMNS = ['PuzzleId', 'FEN', 'Moves', 'Rating', 'RatingDeviation', 'Popularity', 'NbPlays', 'Themes', 'GameUrl', 'OpeningTags'];
const RATING_LOW = 400;
const RATING_HIGH = 3000;
const BUCKET_SIZE = 50;
const BUCKETS = (RATING_HIGH - RATING_LOW) / BUCKET_SIZE;
const BATCH = 1000;
const BATCH_PAUSE_MS = 250;
const BYTES_PER_PUZZLE = 191;
const BYTES_PER_INDEX_ENTRY = 40;

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    reset: { type: 'boolean', default: false },
    file: { type: 'string' },
    'per-bucket': { type: 'string', default: '3000' },
    'min-plays': { type: 'string', default: '500' },
    'min-popularity': { type: 'string', default: '80' },
    'max-rd': { type: 'string', default: '90' },
  },
});

const perBucket = Number(args['per-bucket']);
const minPlays = Number(args['min-plays']);
const minPopularity = Number(args['min-popularity']);
const maxRd = Number(args['max-rd']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SKIPPABLE_MAGIC_MASK = 0xfffffff0;
const SKIPPABLE_MAGIC = 0x184d2a50;

// Lichess compresses with pzstd, which puts a skippable frame before every data frame. Node's zstd
// decoder rejects skippable frames, so they are removed here; data frames pass through unchanged.
function stripSkippableFrames() {
  let pending = Buffer.alloc(0);
  let passThrough = 0; // bytes of the current data frame still to forward
  let plain = false; // no skippable frame at the start: not pzstd output, forward everything

  return new Transform({
    transform(chunk, encoding, callback) {
      if (plain) return callback(null, chunk);
      pending = Buffer.concat([pending, chunk]);
      const out = [];
      while (pending.length) {
        if (passThrough > 0) {
          const take = Math.min(passThrough, pending.length);
          out.push(pending.subarray(0, take));
          pending = pending.subarray(take);
          passThrough -= take;
          continue;
        }
        if (pending.length < 8) break;
        if (((pending.readUInt32LE(0) & SKIPPABLE_MAGIC_MASK) >>> 0) !== SKIPPABLE_MAGIC) {
          plain = true;
          out.push(pending);
          pending = Buffer.alloc(0);
          break;
        }
        const size = pending.readUInt32LE(4);
        if (pending.length < 8 + size) break;
        // pzstd stores the next data frame's compressed size in its 4-byte skippable frame.
        passThrough = size === 4 ? pending.readUInt32LE(8) : 0;
        pending = pending.subarray(8 + size);
        if (size !== 4) {
          plain = true;
          out.push(pending);
          pending = Buffer.alloc(0);
        }
      }
      callback(null, out.length ? Buffer.concat(out) : undefined);
    },
    flush(callback) {
      callback(null, pending.length ? pending : undefined);
    },
  });
}

async function openLines() {
  let source;
  if (args.file) {
    source = createReadStream(args.file);
  } else {
    console.log(`Downloading ${SOURCE_URL}`);
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    source = Readable.fromWeb(res.body);
  }
  const compressed = !args.file || args.file.endsWith('.zst');
  const stages = compressed ? [source, stripSkippableFrames(), zlib.createZstdDecompress()] : [source];
  const input = stages.reduce((stream, next) => stream.pipe(next));
  // readline ends quietly on stream errors, so a corrupt download would look like an empty file.
  for (const stage of stages) {
    stage.on('error', (err) => {
      console.error(`Reading the puzzle file failed: ${err.message}`);
      process.exit(1);
    });
  }
  return readline.createInterface({ input, crlfDelay: Infinity });
}

// The CSV has no quoted fields (URLs and space-separated lists only), so a plain split is enough.
async function sample() {
  const buckets = Array.from({ length: BUCKETS }, () => ({ seen: 0, kept: [] }));
  let columns = COLUMNS;
  let first = true;
  let read = 0;
  let eligible = 0;

  for await (const line of await openLines()) {
    if (first) {
      first = false;
      if (line.startsWith('PuzzleId')) {
        columns = line.split(',');
        continue;
      }
    }
    if (!line) continue;
    read += 1;
    if (read % 500_000 === 0) console.log(`  read ${read.toLocaleString()} puzzles, ${eligible.toLocaleString()} eligible`);

    const fields = line.split(',');
    const row = Object.fromEntries(columns.map((name, index) => [name, fields[index]]));
    const rating = Number(row.Rating);
    const rd = Number(row.RatingDeviation);
    const plays = Number(row.NbPlays);
    if (!(rating >= RATING_LOW && rating <= RATING_HIGH)) continue;
    if (!(plays >= minPlays) || !(Number(row.Popularity) >= minPopularity) || !(rd <= maxRd)) continue;
    eligible += 1;

    const bucket = buckets[Math.min(BUCKETS - 1, Math.floor((rating - RATING_LOW) / BUCKET_SIZE))];
    bucket.seen += 1;
    const puzzle = { _id: row.PuzzleId, fen: row.FEN, moves: row.Moves, rating, rd, plays, themes: row.Themes ?? '' };
    // Reservoir sampling keeps a uniform sample of each bucket in one pass.
    if (bucket.kept.length < perBucket) {
      bucket.kept.push(puzzle);
    } else {
      const slot = Math.floor(Math.random() * bucket.seen);
      if (slot < perBucket) bucket.kept[slot] = puzzle;
    }
  }

  console.log(`Read ${read.toLocaleString()} puzzles, ${eligible.toLocaleString()} passed the filters.`);
  return buckets;
}

function report(buckets) {
  let total = 0;
  buckets.forEach(({ kept }, index) => {
    const low = RATING_LOW + index * BUCKET_SIZE;
    total += kept.length;
    console.log(`  ${String(low).padStart(4)}–${low + BUCKET_SIZE - 1}: ${String(kept.length).padStart(5)} ${'#'.repeat(Math.round(kept.length / 100))}`);
  });
  // _id and rating indexes: two entries per puzzle.
  const bytes = total * (BYTES_PER_PUZZLE + 2 * BYTES_PER_INDEX_ENTRY);
  console.log(`Total ${total.toLocaleString()} puzzles, estimated ${(bytes / 1024 / 1024).toFixed(1)} MB with indexes.`);
  return total;
}

const buckets = await sample();
const total = report(buckets);
if (args['dry-run']) process.exit(0);

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (run with --env-file=.env)');
await mongoose.connect(process.env.MONGODB_URI);

if (args.reset) {
  await Puzzle.collection.drop().catch((err) => {
    if (err.codeName !== 'NamespaceNotFound') throw err;
  });
  console.log('Dropped the puzzles collection.');
}

// Interleave buckets so a partial import is still evenly spread.
const puzzles = buckets.flatMap(({ kept }) => kept).sort(() => Math.random() - 0.5);
let inserted = 0;
for (let start = 0; start < puzzles.length; start += BATCH) {
  const batch = puzzles.slice(start, start + BATCH);
  try {
    const result = await Puzzle.insertMany(batch, { ordered: false, lean: true });
    inserted += result.length;
  } catch (err) {
    // Duplicate ids from an earlier run are skipped; anything else stops the import.
    const written = err.insertedDocs?.length ?? err.result?.insertedCount;
    if (err.code !== 11000 && !err.writeErrors?.every((writeError) => writeError.code === 11000)) throw err;
    inserted += written ?? 0;
  }
  console.log(`  ${Math.min(start + BATCH, total).toLocaleString()} / ${total.toLocaleString()} processed, ${inserted.toLocaleString()} new`);
  await sleep(BATCH_PAUSE_MS);
}

await Puzzle.syncIndexes();
console.log(`Done: ${inserted.toLocaleString()} puzzles inserted, ${(await Puzzle.estimatedDocumentCount()).toLocaleString()} in the collection.`);
await mongoose.disconnect();
