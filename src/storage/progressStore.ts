import { INITIAL_LEVEL } from '../game/config';
import type { GameProgressSnapshot } from '../game/types';

const DB_NAME = 'gravity-smash';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';
const PROGRESS_KEY = 'progress';

export interface PersistedProgress extends GameProgressSnapshot {
  version: number;
  updatedAt: number;
}

function normalizeProgress(
  progress: Partial<PersistedProgress> | null | undefined
): PersistedProgress | null {
  if (!progress) {
    return null;
  }

  const resumeLevel =
    typeof progress.resumeLevel === 'number' && progress.resumeLevel >= INITIAL_LEVEL
      ? Math.floor(progress.resumeLevel)
      : INITIAL_LEVEL;
  const highestUnlockedLevel =
    typeof progress.highestUnlockedLevel === 'number' &&
    progress.highestUnlockedLevel >= resumeLevel
      ? Math.floor(progress.highestUnlockedLevel)
      : resumeLevel;
  const points =
    typeof progress.economy?.points === 'number' && progress.economy.points > 0
      ? Math.floor(progress.economy.points)
      : 0;
  const purchasedUpgrades = Array.isArray(progress.economy?.purchasedUpgrades)
    ? progress.economy.purchasedUpgrades
    : [];

  return {
    version: DB_VERSION,
    updatedAt:
      typeof progress.updatedAt === 'number' && Number.isFinite(progress.updatedAt)
        ? progress.updatedAt
        : Date.now(),
    resumeLevel,
    highestUnlockedLevel,
    economy: {
      points,
      purchasedUpgrades
    }
  };
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener('upgradeneeded', () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    });

    request.addEventListener('success', () => {
      resolve(request.result);
    });

    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Failed to open IndexedDB.'));
    });
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
) {
  return openDatabase().then(
    database =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);

        transaction.addEventListener('complete', () => {
          database.close();
        });

        transaction.addEventListener('error', () => {
          database.close();
          reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
        });

        transaction.addEventListener('abort', () => {
          database.close();
          reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
        });

        action(store, resolve, reject);
      })
  );
}

export async function loadProgress() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null;
  }

  try {
    const rawValue = await withStore<Partial<PersistedProgress> | undefined>(
      'readonly',
      (store, resolve, reject) => {
        const request = store.get(PROGRESS_KEY);

        request.addEventListener('success', () => {
          resolve(request.result as Partial<PersistedProgress> | undefined);
        });

        request.addEventListener('error', () => {
          reject(request.error ?? new Error('Failed to load saved progress.'));
        });
      }
    );

    return normalizeProgress(rawValue);
  } catch {
    return null;
  }
}

export async function saveProgress(progress: GameProgressSnapshot) {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return;
  }

  const normalized = normalizeProgress({
    ...progress,
    updatedAt: Date.now()
  });

  if (!normalized) {
    return;
  }

  try {
    await withStore<void>('readwrite', (store, resolve, reject) => {
      const request = store.put(normalized, PROGRESS_KEY);

      request.addEventListener('success', () => {
        resolve();
      });

      request.addEventListener('error', () => {
        reject(request.error ?? new Error('Failed to save progress.'));
      });
    });
  } catch {
    // Keep the game working even if browser storage is unavailable.
  }
}
