import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { parseArgs } from 'node:util';
import process from 'node:process';
import chalk from 'chalk';
import { watch } from 'chokidar';
import JSON5 from 'json5';
import { Low } from 'lowdb';
import { DataFile, JSONFile } from 'lowdb/node';
import { App } from '@tinyhttp/app';
import { cors } from '@tinyhttp/cors';
import { createApp } from 'json-server/lib/app.js';
import { Observer } from 'json-server/lib/adapters/observer.js';
import { NormalizedAdapter } from 'json-server/lib/adapters/normalized-adapter.js';

// Parse command line arguments
let file = 'db.json';
let port = parseInt(process.env.PORT || '3001', 10);
let host = process.env.HOST || '0.0.0.0';

try {
  const { values, positionals } = parseArgs({
    options: {
      port: { type: 'string', short: 'p', default: String(port) },
      host: { type: 'string', short: 'h', default: host },
      watch: { type: 'boolean', short: 'w' },
    },
    allowPositionals: true,
  });
  if (positionals.length > 0 && positionals[0]) {
    file = positionals[0];
  }
  if (values.port) {
    port = parseInt(values.port, 10);
  }
  if (values.host) {
    host = values.host;
  }
} catch {
  // Use defaults if parseArgs fails
}

if (!existsSync(file)) {
  console.log(chalk.red(`Database file ${file} not found.`));
  process.exit(1);
}

if (readFileSync(file, 'utf-8').trim() === '') {
  writeFileSync(file, '{}');
}

// LowDB adapter setup with observer (mirrors json-server)
let adapter;
if (extname(file) === '.json5') {
  adapter = new DataFile(file, {
    parse: JSON5.parse,
    stringify: JSON5.stringify,
  });
} else {
  adapter = new JSONFile(file);
}

const observer = new Observer(new NormalizedAdapter(adapter));
const db = new Low(observer, {});
await db.read();

// Ensure required collections are initialized as arrays so json-server creates routes
const requiredCollections = [
  'categories',
  'products',
  'inventoryTransactions',
  'orders',
  'registers',
  'accounts',
  'staff',
  'workSessions',
  'workSessionMembers',
  'activityLogs'
];
if (!db.data) db.data = {};
let dbChanged = false;
for (const col of requiredCollections) {
  if (!Array.isArray(db.data[col])) {
    db.data[col] = [];
    dbChanged = true;
  }
}
if (dbChanged) {
  await db.write();
}

// Create master tinyhttp App
const serverApp = new App();

// 1. CORS handler
serverApp
  .use((req, res, next) => {
    return cors({
      allowedHeaders: req.headers['access-control-request-headers']
        ?.split(',')
        .map((h) => h.trim()),
    })(req, res, next);
  })
  .options('*', cors());

// 2. Unconditional server-level DELETE protection for historical WorkSession & WorkSessionMember records
serverApp.use((req, res, next) => {
  if (req.method === 'DELETE') {
    const rawPath = req.url.split('?')[0];

    if (/^\/workSessions(\/.*)?$/.test(rawPath)) {
      res.status(403).json({
        error: 'WORKSESSION_DELETION_RESTRICTED',
        message: 'KHÔNG ĐƯỢC PHÉP XÓA: Dữ liệu ca làm việc là bản ghi lịch sử không thể xóa.',
      });
      return;
    }

    if (/^\/workSessionMembers(\/.*)?$/.test(rawPath)) {
      res.status(403).json({
        error: 'WORKSESSION_MEMBER_DELETION_RESTRICTED',
        message: 'KHÔNG ĐƯỢC PHÉP XÓA: Dữ liệu nhân sự trực ca lịch sử không thể xóa (WORKSESSION_MEMBER_DELETION_RESTRICTED).',
      });
      return;
    }
  }
  next();
});

// 3. Mount json-server core app (serves all standard REST routes for db.json)
const jsonServerApp = createApp(db, { logger: false, static: [] });
serverApp.use(jsonServerApp);

// Start server
serverApp.listen(port, () => {
  console.log([
    chalk.bold(`Mini-Shop Server running on http://${host}:${port}`),
    chalk.gray(`Database: ${file}`),
    chalk.cyan(`[Security] DELETE /workSessions/* & DELETE /workSessionMembers/* protected (HTTP 403)`),
  ].join('\n'));
});

// File watching with chokidar (mirrors json-server)
if (process.env.NODE_ENV !== 'production') {
  let writing = false;
  observer.onWriteStart = () => { writing = true; };
  observer.onWriteEnd = () => { writing = false; };

  watch(file).on('change', () => {
    if (!writing) {
      db.read().catch((e) => {
        console.error(chalk.red(`Error reloading ${file}:`), e.message);
      });
    }
  });
}
