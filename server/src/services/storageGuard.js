import { mb, STORAGE_CAP_BYTES, STORAGE_WARN_BYTES, storageUsage } from './storage.js';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function check() {
  try {
    const usage = await storageUsage();
    const percent = ((usage.total / STORAGE_CAP_BYTES) * 100).toFixed(1);
    console.log(`Storage: ${mb(usage.total)} of ${mb(STORAGE_CAP_BYTES)} (${percent}%)`);
    if (usage.total > STORAGE_WARN_BYTES) {
      const breakdown = usage.collections.map((entry) => `${entry.name} ${mb(entry.data)} + ${mb(entry.indexes)} idx`).join(', ');
      console.warn(`Warning: storage above ${mb(STORAGE_WARN_BYTES)}. By collection: ${breakdown}`);
    }
  } catch (err) {
    console.error('Storage check failed:', err.message);
  }
}

// Logs database size at startup and once a day; warns near the Atlas Free cap.
export function startStorageGuard() {
  check();
  setInterval(check, CHECK_INTERVAL_MS).unref();
}
