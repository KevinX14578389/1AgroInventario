const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryRequest = () => {
      fetch(url)
        .then(async (response) => {
          if (response.ok) {
            resolve();
            return;
          }
          throw new Error(`Respuesta inesperada: ${response.status}`);
        })
        .catch(() => {
          if (Date.now() - startedAt > timeoutMs) {
            reject(new Error('No se pudo conectar al servidor'));
            return;
          }
          setTimeout(tryRequest, 500);
        });
    };

    tryRequest();
  });
}

test('el módulo cultivos responde correctamente', async () => {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: '3100',
      DB_HOST: 'localhost',
      DB_USER: 'root',
      DB_PASSWORD: '',
      DB_NAME: 'agroinventario'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  server.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer('http://localhost:3100/api/health');

    const response = await fetch('http://localhost:3100/api/cultivos');
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    const createResponse = await fetch('http://localhost:3100/api/cultivos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Prueba',
        tipo: 'Ensayo',
        area: 3.5,
        fecha_siembra: '2026-08-01',
        estado: 'Activo'
      })
    });

    const createBody = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createBody.success, true);
    assert.ok(createBody.data && createBody.data.id);
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
});
