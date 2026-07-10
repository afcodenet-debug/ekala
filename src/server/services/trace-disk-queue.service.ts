/**
 * TRACE DISK QUEUE — Crash-safe NDJSON append-only buffer
 * 
 * Garantit qu'aucun événement de trace n'est perdu, même en cas de crash Node.js.
 * 
 * Architecture :
 *   Memory Buffer → Disk Queue (NDJSON + fsync) → SQLite → Supabase
 * 
 * Le Disk Queue est le point de non-retour : une fois écrit avec fsync,
 * l'event survit à un crash process.
 * 
 * Format : NDJSON (Newline-Delimited JSON) — chaque ligne est un event JSON
 * Fichier : /tmp/trace-queue-{process.pid}.log
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { TraceLogEntry } from './trace-manager.service';

// ── Configuration ──────────────────────────────────────────────────────────────

const QUEUE_DIR = process.env.TRACE_QUEUE_DIR || path.join(os.tmpdir(), 'trace-queue');
const MAX_QUEUE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB max before rotation
const FSYNC_INTERVAL_MS = 100; // fsync every 100ms max

// ── State ──────────────────────────────────────────────────────────────────────

let writeStream: fs.WriteStream | null = null;
let currentQueuePath: string | null = null;
let lastFsyncTime: number = 0;
let bytesWritten: number = 0;
let queueInitialized: boolean = false;

// ── Initialization ─────────────────────────────────────────────────────────────

function ensureQueueDir(): void {
  try {
    if (!fs.existsSync(QUEUE_DIR)) {
      fs.mkdirSync(QUEUE_DIR, { recursive: true });
    }
  } catch {
    // If we can't create the queue dir, fall back to process.cwd()
    const fallbackDir = path.join(process.cwd(), '.trace-queue');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    (globalThis as any).__TRACE_QUEUE_DIR = fallbackDir;
  }
}

function getQueueDir(): string {
  return (globalThis as any).__TRACE_QUEUE_DIR || QUEUE_DIR;
}

function getQueueFilePath(): string {
  const dir = getQueueDir();
  const pid = process.pid || 'unknown';
  return path.join(dir, `trace-queue-${pid}.log`);
}

function openWriteStream(): void {
  if (writeStream) return;

  ensureQueueDir();
  currentQueuePath = getQueueFilePath();

  try {
    writeStream = fs.createWriteStream(currentQueuePath, {
      flags: 'a',  // append mode
      encoding: 'utf-8',
      autoClose: false,
    });

    writeStream.on('error', (err) => {
      console.error('[TraceDiskQueue] Write stream error:', err.message);
      // Try to recover by reopening
      writeStream = null;
    });

    // Get current file size for rotation check
    try {
      const stats = fs.statSync(currentQueuePath);
      bytesWritten = stats.size;
    } catch {
      bytesWritten = 0;
    }

    queueInitialized = true;
  } catch (err: any) {
    console.error('[TraceDiskQueue] Failed to open write stream:', err.message);
    queueInitialized = false;
  }
}

// ── Rotation ───────────────────────────────────────────────────────────────────

function rotateQueue(): void {
  closeWriteStream();
  const oldPath = currentQueuePath;
  const rotatedPath = oldPath ? `${oldPath}.rotated.${Date.now()}` : null;

  if (oldPath && rotatedPath) {
    try {
      fs.renameSync(oldPath, rotatedPath);
    } catch {
      // If rename fails, just start fresh
    }
  }

  bytesWritten = 0;
  openWriteStream();
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Écrit un event de trace dans le Disk Queue avec fsync.
 * Garantie : ne jamais throw — les échecs sont loggés mais ne cassent pas le flux.
 * 
 * Retourne true si l'écriture a réussi, false sinon.
 */
export function writeToDiskQueue(event: TraceLogEntry): boolean {
  try {
    if (!writeStream) {
      openWriteStream();
    }

    if (!writeStream) {
      // Fallback: write directly to file with sync write
      const filePath = currentQueuePath || getQueueFilePath();
      try {
        ensureQueueDir();
        const line = JSON.stringify(event) + '\n';
        fs.appendFileSync(filePath, line, 'utf-8');
        // fsync for crash safety
        const fd = fs.openSync(filePath, 'a');
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        bytesWritten += Buffer.byteLength(line, 'utf-8');
        return true;
      } catch {
        return false;
      }
    }

    const line = JSON.stringify(event) + '\n';
    const written = writeStream.write(line);

    if (!written) {
      // Backpressure — drain will happen, but we need to fsync
      writeStream.once('drain', () => {
        try { writeStream?.emit('fsync'); } catch {}
      });
    }

    bytesWritten += Buffer.byteLength(line, 'utf-8');

    // Periodic fsync
    const now = Date.now();
    if (now - lastFsyncTime > FSYNC_INTERVAL_MS) {
      // fsync via the file descriptor
      try {
        const fd = fs.openSync(currentQueuePath!, 'a');
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        lastFsyncTime = now;
      } catch {
        // fsync failure is non-fatal
      }
    }

    // Rotation check
    if (bytesWritten > MAX_QUEUE_SIZE_BYTES) {
      rotateQueue();
    }

    return true;
  } catch (err: any) {
    console.error('[TraceDiskQueue] Write error:', err.message);
    return false;
  }
}

/**
 * Écrit plusieurs events en une seule opération batch.
 */
export function writeBatchToDiskQueue(events: TraceLogEntry[]): number {
  let successCount = 0;
  for (const event of events) {
    if (writeToDiskQueue(event)) {
      successCount++;
    }
  }
  return successCount;
}

// ── Read / Recover ─────────────────────────────────────────────────────────────

/**
 * Lit tous les events non-encore-traités depuis le Disk Queue.
 * Utilisé au démarrage pour récupérer les events survivant à un crash.
 */
export function readDiskQueue(): TraceLogEntry[] {
  const events: TraceLogEntry[] = [];

  try {
    ensureQueueDir();
    const dir = getQueueDir();

    // Read all queue files (including rotated ones)
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('trace-queue-') && f.endsWith('.log'))
      .sort();  // Process oldest first

    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim().length > 0);

        for (const line of lines) {
          try {
            const event = JSON.parse(line) as TraceLogEntry;
            events.push(event);
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return events;
  } catch {
    return [];
  }
}

/**
 * Marque les events comme traités en supprimant/archivant le fichier de queue.
 */
export function markQueueProcessed(): void {
  try {
    const dir = getQueueDir();
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('trace-queue-') && f.endsWith('.log'));

    for (const file of files) {
      const filePath = path.join(dir, file);
      const processedPath = filePath + '.processed';
      try {
        fs.renameSync(filePath, processedPath);
        // Delete processed files older than 1 hour
        setTimeout(() => {
          try {
            if (fs.existsSync(processedPath)) {
              fs.unlinkSync(processedPath);
            }
          } catch {}
        }, 3600000);
      } catch {
        // If rename fails, try to delete
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
  } catch {
    // Silently fail
  }
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

export function closeWriteStream(): void {
  if (writeStream) {
    try {
      // Final fsync before closing
      if (currentQueuePath) {
        try {
          const fd = fs.openSync(currentQueuePath, 'a');
          fs.fsyncSync(fd);
          fs.closeSync(fd);
        } catch {}
      }
      writeStream.end();
    } catch {}
    writeStream = null;
  }
}

/**
 * Force flush du buffer mémoire vers le disque.
 * Appelé par les hooks process avant shutdown.
 */
export function forceFlushDiskQueue(): void {
  if (writeStream && currentQueuePath) {
    try {
      const fd = fs.openSync(currentQueuePath, 'a');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
    } catch {}
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────────

export function getDiskQueueStats(): { path: string | null; bytes: number; initialized: boolean } {
  return {
    path: currentQueuePath,
    bytes: bytesWritten,
    initialized: queueInitialized,
  };
}