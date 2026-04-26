const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { Client } = require('pg');

const SQLITE_PATH = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(__dirname, '..', 'dev.sqlite');
const TARGET_DATABASE_URL =
  process.env.TARGET_DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL;
const RESET_TARGET = process.env.RESET_TARGET === 'true';
const CHUNK_SIZE = 500;

const TABLES = [
  {
    name: 'bom_items',
    columns: ['id', 'model', 'partNumber', 'description', 'usageFactor', 'unit', 'location'],
  },
  {
    name: 'bay_layouts',
    columns: ['id', 'model', 'partNumber', 'bahia'],
  },
  {
    name: 'plans',
    columns: [
      'id',
      'workOrder',
      'model',
      'backen',
      'bahia',
      'quantity',
      'shift',
      'scheduledAt',
      'sequence',
      'status',
      'createdAt',
    ],
  },
  {
    name: 'kits',
    columns: [
      'id',
      'status',
      'preparedAt',
      'sentAt',
      'receivedAt',
      'createdAt',
      'planId',
      'kittedAt',
      'requestedAt',
      'deliveredAt',
    ],
  },
  {
    name: 'kit_materials',
    columns: [
      'id',
      'partNumber',
      'description',
      'quantityRequired',
      'quantityActual',
      'unit',
      'kitId',
      'quantityConsumed',
      'quantityRemaining',
      'quantityResupplied',
      'isBulkResupply',
    ],
  },
  {
    name: 'advances',
    columns: ['id', 'unitsAssembled', 'notes', 'registeredAt', 'kitId'],
  },
  {
    name: 'resupplies',
    columns: [
      'id',
      'partNumber',
      'description',
      'quantityRequested',
      'quantityDelivered',
      'status',
      'reason',
      'requestedAt',
      'deliveredAt',
      'kitId',
    ],
  },
  {
    name: 'kit_exceptions',
    columns: [
      'id',
      'type',
      'partNumber',
      'description',
      'status',
      'createdAt',
      'resolvedAt',
      'kitId',
    ],
  },
];

function openSqlite(filePath) {
  return new sqlite3.Database(filePath);
}

function sqliteAll(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function sqliteClose(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function normalizeValue(column, value) {
  if (value === undefined) return null;
  if (column === 'isBulkResupply' && value !== null) return Boolean(value);
  return value;
}

async function readSourceCounts(db) {
  const counts = {};
  for (const table of TABLES) {
    const [row] = await sqliteAll(db, `SELECT COUNT(*) AS count FROM ${table.name}`);
    counts[table.name] = Number(row.count || 0);
  }
  return counts;
}

async function readTableRows(db, table) {
  return sqliteAll(
    db,
    `SELECT ${table.columns.map((column) => `"${column}"`).join(', ')} FROM ${table.name} ORDER BY id ASC`,
  );
}

async function readTargetCounts(client) {
  const counts = {};
  for (const table of TABLES) {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM "${table.name}"`);
    counts[table.name] = Number(result.rows[0].count || 0);
  }
  return counts;
}

async function ensureTargetIsReady(client) {
  const counts = await readTargetCounts(client);
  const populated = Object.entries(counts).filter(([, count]) => count > 0);

  if (populated.length > 0 && !RESET_TARGET) {
    const summary = populated.map(([name, count]) => `${name}=${count}`).join(', ');
    throw new Error(
      `Target PostgreSQL already has data (${summary}). Re-run with RESET_TARGET=true if you want to replace it.`,
    );
  }

  if (populated.length > 0 && RESET_TARGET) {
    await client.query(`
      TRUNCATE TABLE
        "kit_exceptions",
        "resupplies",
        "advances",
        "kit_materials",
        "kits",
        "plans",
        "bay_layouts",
        "bom_items"
      RESTART IDENTITY CASCADE
    `);
  }
}

async function insertTable(client, table, rows) {
  if (rows.length === 0) {
    console.log(`Skipping ${table.name}: 0 rows`);
    return;
  }

  const quotedColumns = table.columns.map((column) => `"${column}"`).join(', ');

  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE);
    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const row of chunk) {
      const placeholders = table.columns.map((column) => {
        params.push(normalizeValue(column, row[column]));
        return `$${paramIndex++}`;
      });
      values.push(`(${placeholders.join(', ')})`);
    }

    await client.query(
      `INSERT INTO "${table.name}" (${quotedColumns}) VALUES ${values.join(', ')}`,
      params,
    );
  }

  await client.query(`
    SELECT setval(
      pg_get_serial_sequence('"${table.name}"', 'id'),
      COALESCE((SELECT MAX("id") FROM "${table.name}"), 1),
      EXISTS(SELECT 1 FROM "${table.name}")
    )
  `);

  console.log(`Imported ${rows.length} rows into ${table.name}`);
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(`SQLite source file not found: ${SQLITE_PATH}`);
  }

  if (!TARGET_DATABASE_URL) {
    throw new Error(
      'Missing target PostgreSQL URL. Set TARGET_DATABASE_URL, DATABASE_PUBLIC_URL, or DATABASE_URL.',
    );
  }

  const sqlite = openSqlite(SQLITE_PATH);
  const client = new Client({ connectionString: TARGET_DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    console.log(`Source SQLite: ${SQLITE_PATH}`);
    await client.connect();
    console.log('Connected to target PostgreSQL');

    const sourceCounts = await readSourceCounts(sqlite);
    console.log(`Source counts: ${JSON.stringify(sourceCounts)}`);

    await client.query('BEGIN');
    await ensureTargetIsReady(client);

    for (const table of TABLES) {
      const rows = await readTableRows(sqlite, table);
      await insertTable(client, table, rows);
    }

    await client.query('COMMIT');
    const targetCounts = await readTargetCounts(client);
    console.log(`Target counts: ${JSON.stringify(targetCounts)}`);
    console.log('SQLite to PostgreSQL migration completed successfully.');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // Ignore rollback errors if transaction never started.
    }
    throw error;
  } finally {
    await client.end().catch(() => {});
    await sqliteClose(sqlite).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
