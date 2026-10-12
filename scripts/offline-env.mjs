import { readFile } from 'node:fs/promises';
const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
if (!schema.includes('provider = "mongodb"')) throw new Error('Offline edition requires the MongoDB schema.');
