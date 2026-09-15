// Prints data and index size per collection against the Atlas Free cap. Usage: npm run storage
import mongoose from 'mongoose';
import { mb, STORAGE_CAP_BYTES, STORAGE_WARN_BYTES, storageUsage } from '../src/services/storage.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (run with --env-file=.env)');
await mongoose.connect(process.env.MONGODB_URI);

const usage = await storageUsage();
console.log(`Database "${mongoose.connection.db.databaseName}"`);
console.log(`${'collection'.padEnd(20)}${'count'.padStart(10)}${'data'.padStart(12)}${'indexes'.padStart(12)}`);
for (const { name, count, data, indexes } of [...usage.collections].sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`${name.padEnd(20)}${count.toLocaleString().padStart(10)}${mb(data).padStart(12)}${mb(indexes).padStart(12)}`);
}

const percent = ((usage.total / STORAGE_CAP_BYTES) * 100).toFixed(1);
console.log(`\nTotal ${mb(usage.total)} of ${mb(STORAGE_CAP_BYTES)} (${percent}%): data ${mb(usage.data)}, indexes ${mb(usage.indexes)}`);
if (usage.total > STORAGE_WARN_BYTES) console.warn(`Warning: above ${mb(STORAGE_WARN_BYTES)} of the Atlas Free storage cap.`);
await mongoose.disconnect();
