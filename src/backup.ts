// JSON export / import of the whole database.

import { db } from './db';
import { todayISO } from './lib/schedule';

const APP_TAG = 'workout531';

export async function exportJSON(): Promise<void> {
  const data = {
    app: APP_TAG,
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await db.settings.toArray(),
    workoutLogs: await db.workoutLogs.toArray(),
    bodyweight: await db.bodyweight.toArray(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `531-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Replaces ALL current data. Throws on unrecognized files. */
export async function importJSON(text: string): Promise<void> {
  const data: unknown = JSON.parse(text);
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as { app?: string }).app !== APP_TAG
  ) {
    throw new Error('Not a 5/3/1 backup file');
  }
  const d = data as {
    settings?: unknown[];
    workoutLogs?: unknown[];
    bodyweight?: unknown[];
  };
  await db.transaction('rw', db.settings, db.workoutLogs, db.bodyweight, async () => {
    await Promise.all([db.settings.clear(), db.workoutLogs.clear(), db.bodyweight.clear()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.settings.bulkAdd((d.settings ?? []) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.workoutLogs.bulkAdd((d.workoutLogs ?? []) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.bodyweight.bulkAdd((d.bodyweight ?? []) as any);
  });
}
