import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = resolve(import.meta.dirname, '..');

// Ship the player only. Authoring remains available through the local server.
export async function preparePages(output = resolve(projectRoot, '.pages-build')) {
  const source = resolve(projectRoot, 'dist');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(source, output, {
    recursive: true,
    filter: path => path !== resolve(source, 'admin')
  });
  await writeFile(resolve(output, '.nojekyll'), '');
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`Pages player artifact: ${await preparePages()}`);
}
