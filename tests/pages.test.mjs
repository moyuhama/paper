import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { preparePages } from '../scripts/prepare-pages.mjs';

test('Pages artifact contains the player and resolves its relative assets without authoring files', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'paper-pages-'));
  const output = join(temporary, 'site');
  try {
    await preparePages(output);
    const files = await readdir(output, { recursive: true });
    assert.ok(files.includes('index.html'));
    assert.ok(files.includes('.nojekyll'));
    assert.ok(files.includes('plan-view.js'));
    assert.ok(files.some(file => file.endsWith('.mp3')));
    assert.ok(!files.some(file => file === 'admin' || file.startsWith('admin/')));
    for (const file of files.filter(file => /\.(js|css|html)$/.test(file))) {
      const content = await readFile(join(output, file), 'utf8');
      // These are the game's HTML, module and audio dependency forms.
      const references = [...content.matchAll(/(?:from\s*|import\s*|(?:src|href)=|new URL\(\s*)['"](\.[^'"]+)['"]/g)];
      for (const [, reference] of references) {
        const target = resolve(dirname(join(output, file)), reference);
        assert.ok(target.startsWith(output + '/'), `${file}: ${reference} stays inside Pages`);
        await readFile(target);
      }
      assert.doesNotMatch(content, /(?:src|href)=["']\/(?!\/)/, `${file}: root paths break project Pages`);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
