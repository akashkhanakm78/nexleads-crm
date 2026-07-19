import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const client = createClient({
  url: REDIS_URL,
});

client.on('error', (err) => {
  console.error('[Redis Client Error]:', err);
});

client.on('connect', () => {
  console.log('[Redis]: Connected to Redis cache service.');
});

// Connect to Redis on startup
let isConnected = false;
async function ensureConnected() {
  if (isConnected) return true;
  try {
    if (!client.isOpen) {
      await client.connect();
    }
    isConnected = true;
    return true;
  } catch (err) {
    console.error('[Redis Connection Failed]: Caching will be bypassed.', err);
    return false;
  }
}

// Automatically trigger connection
ensureConnected();

export async function getCache(key: string): Promise<string | null> {
  const connected = await ensureConnected();
  if (!connected) return null;
  try {
    return await client.get(key);
  } catch (err) {
    console.error(`[Redis getCache Error for ${key}]:`, err);
    return null;
  }
}

export async function setCache(key: string, value: string, ttlSeconds = 3600): Promise<void> {
  const connected = await ensureConnected();
  if (!connected) return;
  try {
    await client.set(key, value, {
      EX: ttlSeconds,
    });
  } catch (err) {
    console.error(`[Redis setCache Error for ${key}]:`, err);
  }
}

export async function clearCache(key: string): Promise<void> {
  const connected = await ensureConnected();
  if (!connected) return;
  try {
    await client.del(key);
    console.log(`[Redis Cache Cleared]: Key "${key}"`);
  } catch (err) {
    console.error(`[Redis clearCache Error for ${key}]:`, err);
  }
}
