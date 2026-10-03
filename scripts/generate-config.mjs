import { writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY before building the public site.');
const output = `export const SUPABASE_URL = ${JSON.stringify(url)};\nexport const SUPABASE_ANON_KEY = ${JSON.stringify(key)};\n`;
await writeFile(new URL('../public/config.js', import.meta.url), output, 'utf8');
