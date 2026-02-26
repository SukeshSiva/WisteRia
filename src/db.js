import Database from '@tauri-apps/plugin-sql';
import { exists, mkdir } from '@tauri-apps/plugin-fs';

// Helper: build the SQLite connection string for a trip stored in the user's directory
function tripDbPath(rootDir, tripId) {
  return `sqlite:${rootDir}/projects/${tripId}/data.db`;
}

export async function initTripDB(rootDir, tripId) {
  const tripFolder = `${rootDir}/projects/${tripId}`;
  const filesFolder = `${tripFolder}/files`;

  // Ensure the directory exists before opening the database
  try {
    await mkdir(tripFolder, { recursive: true });
    await mkdir(filesFolder, { recursive: true });
  } catch (err) {
    console.log("mkdir info:", err);
  }

  // Verify the directory was actually created
  const dirExists = await exists(tripFolder);
  if (!dirExists) {
    throw new Error(`Failed to create trip directory: ${tripFolder}`);
  }

  const dbPath = tripDbPath(rootDir, tripId);
  console.log("Opening DB at:", dbPath);
  const db = await Database.load(dbPath);

  // Initialize Schema
  await db.execute(`
    CREATE TABLE IF NOT EXISTS trip_info (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      destination TEXT,
      startDate TEXT,
      endDate TEXT,
      budget REAL DEFAULT 0,
      headcount INTEGER DEFAULT 1,
      activeVersionId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    // Migration: add createdAt if it doesn't exist on older DBs
    // SQLite does not allow CURRENT_TIMESTAMP as default for added columns
    await db.execute("ALTER TABLE trip_info ADD COLUMN createdAt TEXT;");
  } catch (e) {
    // Expected to fail if column already exists
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      name TEXT NOT NULL,
      parentId TEXT,
      mergedFromId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(trip_id) REFERENCES trip_info(id) ON DELETE CASCADE
    );
  `);

  // Migration: add version graph columns for older DBs
  try { await db.execute("ALTER TABLE versions ADD COLUMN parentId TEXT;"); } catch (e) { }
  try { await db.execute("ALTER TABLE versions ADD COLUMN mergedFromId TEXT;"); } catch (e) { }
  try { await db.execute("ALTER TABLE versions ADD COLUMN createdAt TEXT;"); } catch (e) { }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      cost REAL DEFAULT 0,
      startTime TEXT NOT NULL,
      endTime TEXT,
      locationLink TEXT,
      notes TEXT,
      FOREIGN KEY(version_id) REFERENCES versions(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      fileName TEXT NOT NULL,
      fileType TEXT,
      localPath TEXT,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
    );
  `);

  return db;
}

export async function getTripSummary(rootDir, tripId) {
  const dbFile = `${rootDir}/projects/${tripId}/data.db`;
  if (!(await exists(dbFile))) {
    return null;
  }
  const db = await Database.load(tripDbPath(rootDir, tripId));
  const result = await db.select("SELECT * FROM trip_info LIMIT 1");
  return result.length > 0 ? result[0] : null;
}

export async function loadFullTrip(rootDir, tripId) {
  const dbFile = `${rootDir}/projects/${tripId}/data.db`;
  if (!(await exists(dbFile))) {
    return null;
  }
  const db = await Database.load(tripDbPath(rootDir, tripId));

  const tripResult = await db.select("SELECT * FROM trip_info LIMIT 1");
  if (tripResult.length === 0) return null;

  const tripInfo = tripResult[0];

  const versionsRaw = await db.select("SELECT * FROM versions WHERE trip_id = $1", [tripInfo.id]);
  const eventsRaw = await db.select(`
    SELECT e.*, v.trip_id
    FROM events e
    JOIN versions v ON e.version_id = v.id
    WHERE v.trip_id = $1
  `, [tripInfo.id]);

  const attachmentsRaw = await db.select(`
    SELECT a.*
    FROM attachments a
    JOIN events e ON a.event_id = e.id
    JOIN versions v ON e.version_id = v.id
    WHERE v.trip_id = $1
  `, [tripInfo.id]);

  const versions = versionsRaw.map(v => ({
    id: v.id,
    name: v.name,
    parentId: v.parentId || v.parentid || null,
    mergedFromId: v.mergedFromId || v.mergedfromid || null,
    createdAt: v.createdAt || v.createdat || null,
    events: eventsRaw
      .filter(e => e.version_id === v.id)
      .map(e => ({
        ...e,
        attachments: attachmentsRaw.filter(a => a.event_id === e.id)
      }))
  }));

  return {
    ...tripInfo,
    versions
  };
}

export async function upsertTrip(rootDir, trip) {
  const db = await initTripDB(rootDir, trip.id);
  await db.execute(`
        INSERT INTO trip_info (id, title, destination, startDate, endDate, budget, headcount, activeVersionId, createdAt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            destination=excluded.destination,
            startDate=excluded.startDate,
            endDate=excluded.endDate,
            budget=excluded.budget,
            headcount=excluded.headcount,
            activeVersionId=excluded.activeVersionId,
            createdAt=excluded.createdAt
    `, [
    trip.id, trip.title, trip.destination, trip.startDate, trip.endDate,
    trip.budget || 0, trip.headcount || 1, trip.activeVersionId, trip.createdAt || new Date().toISOString()
  ]);
}

export async function upsertVersion(rootDir, tripId, version) {
  const db = await Database.load(tripDbPath(rootDir, tripId));
  await db.execute(`
        INSERT INTO versions (id, trip_id, name, parentId, mergedFromId, createdAt)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            parentId=excluded.parentId,
            mergedFromId=excluded.mergedFromId,
            createdAt=excluded.createdAt
    `, [version.id, tripId, version.name, version.parentId || null, version.mergedFromId || null, version.createdAt || new Date().toISOString()]);
}

export async function upsertEvent(rootDir, tripId, versionId, event) {
  const db = await Database.load(tripDbPath(rootDir, tripId));
  await db.execute(`
        INSERT INTO events (id, version_id, title, type, cost, startTime, endTime, locationLink, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            type=excluded.type,
            cost=excluded.cost,
            startTime=excluded.startTime,
            endTime=excluded.endTime,
            locationLink=excluded.locationLink,
            notes=excluded.notes
    `, [
    event.id, versionId, event.title, event.type, event.cost || 0,
    event.startTime, event.endTime, event.locationLink || null, event.notes || null
  ]);
}

export async function deleteEventFromDB(rootDir, tripId, eventId) {
  const db = await Database.load(tripDbPath(rootDir, tripId));
  await db.execute("DELETE FROM events WHERE id = $1", [eventId]);
}

export async function deleteVersionFromDB(rootDir, tripId, versionId) {
  const db = await Database.load(tripDbPath(rootDir, tripId));
  await db.execute("DELETE FROM versions WHERE id = $1", [versionId]);
}

export async function upsertAttachment(rootDir, tripId, eventId, attachment) {
  const db = await Database.load(tripDbPath(rootDir, tripId));
  await db.execute(`
      INSERT INTO attachments (id, event_id, fileName, fileType, localPath)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(id) DO UPDATE SET
          fileName=excluded.fileName,
          fileType=excluded.fileType,
          localPath=excluded.localPath
  `, [attachment.id, eventId, attachment.name, attachment.type, attachment.localPath]);
}

export async function syncFullTripState(rootDir, trip) {
  const db = await Database.load(tripDbPath(rootDir, trip.id));

  // Wipe existing versions, events, and attachments for this trip to ensure a clean state
  await db.execute("DELETE FROM versions WHERE trip_id = $1", [trip.id]);
  await db.execute("DELETE FROM events WHERE version_id IN (SELECT id FROM versions WHERE trip_id = $1)", [trip.id]);
  // Note: attachments cascade delete if configured, or we can just leave orphans or delete explicitly
  // Since we don't have a direct trip_id on attachments, for now we rely on event deletion if there are cascades, 
  // otherwise they simply overwrite on conflict since attachment IDs are preserved.

  // Restore Trip Info
  await upsertTrip(rootDir, trip);

  // Restore all versions
  for (const ver of trip.versions) {
    await upsertVersion(rootDir, trip.id, ver);
    // Restore all events in version
    if (ver.events) {
      for (const ev of ver.events) {
        await upsertEvent(rootDir, trip.id, ver.id, ev);
        // Restore attachments
        if (Array.isArray(ev.attachments)) {
          for (const att of ev.attachments) {
            await upsertAttachment(rootDir, trip.id, ev.id, att);
          }
        }
      }
    }
  }
}

export async function deleteAttachmentFromDB(rootDir, tripId, attachmentId) {
  const db = await Database.load(tripDbPath(rootDir, tripId));
  await db.execute("DELETE FROM attachments WHERE id = $1", [attachmentId]);
}
