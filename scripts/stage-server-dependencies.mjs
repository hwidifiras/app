import { createRequire } from 'node:module';
import { cp, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Materialize the framework's complete dependency graph. Dereferencing pnpm
// links alone loses sibling lookup paths; partial NFT files can then appear to
// work on a developer machine while failing on a clean installed machine.
export async function stageServerDependencies(target) {
  const rootRequire = createRequire(import.meta.url);
  const globalPackages = new Map();
  const copied = new Set();
  async function locate(name, requireFrom) {
    try { return path.dirname(requireFrom.resolve(`${name}/package.json`)); }
    catch {
      try {
        let directory = path.dirname(requireFrom.resolve(name));
        while (directory !== path.dirname(directory)) {
          try { const metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')); if (metadata.name === name) return directory; } catch { /* walk */ }
          directory = path.dirname(directory);
        }
      } catch { /* optional package absent */ }
      return null;
    }
  }
  const roots = ['next', 'react', 'react-dom', '@prisma/client'];
  for (const name of roots) {
    const source = await locate(name, rootRequire);
    if (!source) throw new Error(`Missing runtime dependency: ${name}`);
    globalPackages.set(name, source);
  }
  async function materialize(name, source, parentDestination) {
    const globalSource = globalPackages.get(name);
    const destination = globalSource && globalSource !== source
      ? path.join(parentDestination, 'node_modules', name)
      : path.join(target, 'node_modules', name);
    if (!globalSource) globalPackages.set(name, source);
    if (copied.has(destination)) return;
    copied.add(destination);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true, dereference: true, filter: (file) => !file.startsWith(path.join(source, 'node_modules') + path.sep) && file !== path.join(source, 'node_modules') });
    const metadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
    const requireFrom = createRequire(path.join(source, 'package.json'));
    for (const dependency of new Set([...Object.keys(metadata.dependencies ?? {}), ...Object.keys(metadata.optionalDependencies ?? {})])) {
      const location = await locate(dependency, requireFrom);
      if (location) await materialize(dependency, location, destination);
      else if (metadata.dependencies?.[dependency]) throw new Error(`Missing ${name} runtime dependency: ${dependency}`);
    }
  }
  for (const name of roots) await materialize(name, globalPackages.get(name), target);
  const prismaPackage = globalPackages.get('@prisma/client');
  const generated = path.resolve(prismaPackage, '../../.prisma/client');
  await cp(generated, path.join(target, 'node_modules/.prisma/client'), { recursive: true, dereference: true });
}
