import mongoose from 'mongoose';

export const STORAGE_CAP_BYTES = 512 * 1024 * 1024; // Atlas Free: data + indexes
export const STORAGE_WARN_BYTES = 400 * 1024 * 1024;

export const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

// Data and index size per collection, largest first, plus totals. Needs an open mongoose connection.
export async function storageUsage() {
  const { db } = mongoose.connection;
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name);
  const collections = [];
  for (const name of names) {
    const [stats] = await db.collection(name).aggregate([{ $collStats: { storageStats: {} } }]).toArray();
    const { size = 0, totalIndexSize = 0, count = 0 } = stats?.storageStats ?? {};
    collections.push({ name, count, data: size, indexes: totalIndexSize });
  }
  collections.sort((a, b) => b.data + b.indexes - (a.data + a.indexes));
  const data = collections.reduce((sum, entry) => sum + entry.data, 0);
  const indexes = collections.reduce((sum, entry) => sum + entry.indexes, 0);
  return { collections, data, indexes, total: data + indexes };
}
