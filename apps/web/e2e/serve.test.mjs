import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

test('development server serves the Portuguese shell without API', async () => {
  const port = await freePort();
  const cli = fileURLToPath(new URL('../node_modules/@angular/cli/bin/ng.js', import.meta.url));
  const child = spawn(
    process.execPath,
    [cli, 'serve', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      stdio: 'ignore',
    },
  );
  try {
    let response;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (child.exitCode !== null) throw new Error('Angular server exited before response');
      try {
        response = await fetch(`http://127.0.0.1:${port}/`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.ok(response, 'Angular server did not start in 30 seconds');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /lang="pt-BR"/);
    assert.match(html, /Além do SiSU/);
  } finally {
    child.kill();
  }
});
