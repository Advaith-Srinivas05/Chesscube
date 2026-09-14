// Prints data and index size per collection against the Atlas Free cap. Usage: npm run storage
import mongoose from 'mongoose';

const CAP_BYTES = 512 * 1024 * 1024;
const WARN_RATIO = 0.8;
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (run with --env-file=.env)');
await mongoose.connect(process.env.MONGODB_URI);
const { db } = mongoose.connection;

const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name).sort();
let dataTotal = 0;
let indexTotal = 0;

console.log(`Database "${db.databaseName}"`);
console.log(`${'collection'.padEnd(20)}${'count'.padStart(10)}${'data'.padStart(12)}${'indexes'.padStart(12)}`);
for (const name of collections) {
  const [stats] = await db
    .collection(name)
    .aggregate([{ $collStats: { storageStats: {} } }])
    .toArray();
  const { size = 0, totalIndexSize = 0, count = 0 } = stats?.storageStats ?? {};
  dataTotal += size;
  indexTotal += totalIndexSize;
  console.log(`${name.padEnd(20)}${count.toLocaleString().padStart(10)}${mb(size).padStart(12)}${mb(totalIndexSize).padStart(12)}`);
}

const used = dataTotal + indexTotal;
const ratio = used / CAP_BYTES;
console.log(`\nTotal ${mb(used)} of ${mb(CAP_BYTES)} (${(ratio * 100).toFixed(1)}%): data ${mb(dataTotal)}, indexes ${mb(indexTotal)}`);
if (ratio > WARN_RATIO) console.warn(`Warning: above ${WARN_RATIO * 100}% of the Atlas Free storage cap.`);
await mongoose.disconnect();
