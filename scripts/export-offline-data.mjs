import pg from 'pg';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Opt-in, read-only source export. Supply the source URL through the environment,
// never the command line. It is never called by the offline application.
const url = process.env.OFFLINE_EXPORT_DATABASE_URL;
const slug = process.argv[2]; const output = process.argv[3];
if (!url || !slug || !output) throw new Error('Set OFFLINE_EXPORT_DATABASE_URL, then run export-offline-data.mjs <club-slug> <output.json>.');
const metadata = JSON.parse(await readFile(new URL('../offline/model-metadata.json', import.meta.url), 'utf8'));
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const tenant = (await client.query('SELECT id, slug, name FROM "Tenant" WHERE slug = $1', [slug])).rows[0];
  if (!tenant) throw new Error('Club introuvable.');
  const collections = {};
  for (const [name, model] of Object.entries(metadata.models)) {
    if (!model.fields.some((field) => field.name === 'tenantId')) continue;
    // Identifiers come exclusively from checked-in schema metadata.
    if (!/^[A-Za-z]+$/.test(name)) throw new Error('Invalid schema model.');
    collections[name] = (await client.query(`SELECT * FROM "${name}" WHERE "tenantId" = $1`, [tenant.id])).rows;
  }
  await client.query('COMMIT');
  await writeFile(output, JSON.stringify({ format: 'all-in-gym-club-export', version: 1, exportId: randomUUID(), exportedAt: new Date().toISOString(), tenantId: tenant.id, tenant, collections }), { flag: 'wx', mode: 0o600 });
  console.log('Export local créé. La base source reste inchangée.');
} catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
finally { await client.end(); }
