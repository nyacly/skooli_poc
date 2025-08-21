import { promises as fs } from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('.vercel/output');
const functionsDir = path.join(outDir, 'functions');
const apiDir = path.join(functionsDir, 'api');
const apiFile = path.join(apiDir, 'index.js');
const apiFuncDir = path.join(apiDir, 'index.func');
const routesDir = path.join(apiDir, 'routes');
const libSrcDir = path.join(functionsDir, 'lib');
const libDestDir = path.join(apiFuncDir, 'lib');

await fs.mkdir(apiFuncDir, { recursive: true });
await fs.rename(apiFile, path.join(apiFuncDir, 'index.js'));
await fs.rename(routesDir, path.join(apiFuncDir, 'routes'));
await fs.rename(libSrcDir, libDestDir);

const indexPath = path.join(apiFuncDir, 'index.js');
let indexContent = await fs.readFile(indexPath, 'utf8');
indexContent = indexContent.replace(/\.\.\/lib\//g, './lib/');
await fs.writeFile(indexPath, indexContent);

const vcConfig = {
  runtime: 'nodejs20.x',
  handler: 'index.js'
};
await fs.writeFile(path.join(apiFuncDir, '.vc-config.json'), JSON.stringify(vcConfig, null, 2));

const rootConfig = { version: 3 };
await fs.writeFile(path.join(outDir, 'config.json'), JSON.stringify(rootConfig, null, 2));

