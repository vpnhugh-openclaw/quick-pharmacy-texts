import { openDB, type IDBPDatabase } from 'idb';
import type { SendSession } from '@/types';

const DB_NAME = 'hughs-pharmacy-sms';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveSession(session: SendSession): Promise<void> {
  const db = await getDB();
  await db.put(SESSIONS_STORE, { ...session, updatedAt: new Date().toISOString() });
}

export async function getSession(id: string): Promise<SendSession | undefined> {
  const db = await getDB();
  return db.get(SESSIONS_STORE, id);
}

export async function getAllSessions(): Promise<SendSession[]> {
  const db = await getDB();
  return db.getAll(SESSIONS_STORE);
}

export async function getActiveSession(): Promise<SendSession | undefined> {
  const sessions = await getAllSessions();
  return sessions.find(s => s.status === 'in_progress' || s.status === 'paused');
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(SESSIONS_STORE, id);
}
