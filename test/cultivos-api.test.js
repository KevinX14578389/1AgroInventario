const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

function createSmtpServer() {
  const messages = [];
  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    socket.write('220 localhost ESMTP\r\n');
    let buffer = '';
    let receivingMessage = false;
    let messageLines = [];
    let authenticationStep = 0;

    socket.on('data', (chunk) => {
      buffer += chunk;
      let lineEnd;
      while ((lineEnd = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, lineEnd).replace(/\r$/, '');
        buffer = buffer.slice(lineEnd + 1);

        if (receivingMessage) {
          if (line === '.') {
            messages.push(messageLines.join('\n'));
            messageLines = [];
            receivingMessage = false;
            socket.write('250 Message accepted\r\n');
          } else {
            messageLines.push(line.startsWith('..') ? line.slice(1) : line);
          }
        } else if (/^EHLO\b/i.test(line)) {
          socket.write('250-localhost\r\n250-AUTH LOGIN\r\n250 SIZE 10485760\r\n');
        } else if (/^AUTH LOGIN/i.test(line)) {
          authenticationStep = 1;
          socket.write('334 VXNlcm5hbWU6\r\n');
        } else if (authenticationStep === 1) {
          authenticationStep = 2;
          socket.write('334 UGFzc3dvcmQ6\r\n');
        } else if (authenticationStep === 2) {
          authenticationStep = 0;
          socket.write('235 Authentication successful\r\n');
        } else if (/^MAIL FROM:/i.test(line) || /^RCPT TO:/i.test(line)) {
          socket.write('250 OK\r\n');
        } else if (/^DATA$/i.test(line)) {
          receivingMessage = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (/^QUIT$/i.test(line)) {
          socket.end('221 Bye\r\n');
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });
  });

  return { server, messages };
}

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
  const smtp = createSmtpServer();
  await new Promise((resolve) => smtp.server.listen(0, '127.0.0.1', resolve));
  const smtpPort = smtp.server.address().port;
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: '3100',
      DB_HOST: 'localhost',
      DB_USER: 'root',
      DB_PASSWORD: '',
      DB_NAME: 'agroinventario',
      RESET_LINK_DELIVERY: '',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(smtpPort),
      SMTP_SECURE: 'false',
      SMTP_USER: 'test-user',
      SMTP_PASSWORD: 'test-password',
      FRONTEND_URL: 'http://localhost:5500/index.html'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  let consoleServer;
  server.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer('http://localhost:3100/api/health');

    const cultivosSinAutenticacion = await fetch('http://localhost:3100/api/cultivos');
    assert.equal(cultivosSinAutenticacion.status, 401);

    const inventoryWithoutLogin = await fetch('http://localhost:3100/api/bodega');
    assert.equal(inventoryWithoutLogin.status, 401);

    const identificador = Date.now();
    const usuarioA = {
      nombre: 'Usuario prueba A',
      email: `prueba-a-${identificador}@example.com`,
      contraseña: 'prueba123'
    };
    const registro = await fetch('http://localhost:3100/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(usuarioA)
    });
    assert.equal(registro.status, 201);

    const login = await fetch('http://localhost:3100/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: usuarioA.email, contraseña: usuarioA.contraseña })
    });
    const loginBody = await login.json();
    assert.equal(login.status, 200);
    const headers = { Authorization: `Bearer ${loginBody.token}` };

    const response = await fetch('http://localhost:3100/api/cultivos', { headers });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    const usuarioB = {
      nombre: 'Usuario prueba B',
      email: `prueba-b-${identificador}@example.com`,
      contraseña: 'prueba123'
    };
    const registroB = await fetch('http://localhost:3100/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(usuarioB)
    });
    assert.equal(registroB.status, 201);

    const loginB = await fetch('http://localhost:3100/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: usuarioB.email, contraseña: usuarioB.contraseña })
    });
    const loginBBody = await loginB.json();
    assert.equal(loginB.status, 200);
    const headersB = { Authorization: `Bearer ${loginBBody.token}` };

    const animalBResponse = await fetch('http://localhost:3100/api/animales', {
      method: 'POST',
      headers: { ...headersB, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'Bovino privado', cantidad: 2, edad: 3 })
    });
    const animalBBody = await animalBResponse.json();
    assert.equal(animalBResponse.status, 201);
    assert.ok(animalBBody.data && animalBBody.data.id);

    const updateAnimalResponse = await fetch(`http://localhost:3100/api/animales/${animalBBody.data.id}`, {
      method: 'PUT',
      headers: { ...headersB, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'Bovino privado actualizado', cantidad: 4, edad: 4 })
    });
    const updateAnimalBody = await updateAnimalResponse.json();
    assert.equal(updateAnimalResponse.status, 200);
    assert.equal(updateAnimalBody.data.tipo, 'Bovino privado actualizado');
    assert.equal(updateAnimalBody.data.cantidad, 4);

    const unauthorizedUpdateResponse = await fetch(`http://localhost:3100/api/animales/${animalBBody.data.id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'Intento ajeno', cantidad: 99, edad: 99 })
    });
    assert.equal(unauthorizedUpdateResponse.status, 404);

    const animalesUsuarioA = await fetch('http://localhost:3100/api/animales', { headers });
    const animalesUsuarioABody = await animalesUsuarioA.json();
    assert.equal(animalesUsuarioA.status, 200);
    assert.equal(animalesUsuarioABody.data.some((animal) => animal.id === animalBBody.data.id), false);

    const animalesUsuarioB = await fetch('http://localhost:3100/api/animales', { headers: headersB });
    const animalesUsuarioBBody = await animalesUsuarioB.json();
    assert.equal(animalesUsuarioB.status, 200);
    assert.equal(animalesUsuarioBBody.data.some((animal) => animal.id === animalBBody.data.id), true);

    const bodegaBResponse = await fetch('http://localhost:3100/api/bodega', {
      method: 'POST',
      headers: { ...headersB, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Insumo privado B',
        cantidad: 10,
        unidad: 'kg',
        stock_minimo: 2,
        costo_unitario: 1500
      })
    });
    const bodegaBBody = await bodegaBResponse.json();
    assert.equal(bodegaBResponse.status, 201);
    assert.ok(bodegaBBody.data && bodegaBBody.data.id);

    const bodegaUsuarioA = await fetch('http://localhost:3100/api/bodega', { headers });
    const bodegaUsuarioABody = await bodegaUsuarioA.json();
    assert.equal(bodegaUsuarioA.status, 200);
    assert.equal(bodegaUsuarioABody.data.some((articulo) => articulo.id === bodegaBBody.data.id), false);

    const bodegaUsuarioB = await fetch('http://localhost:3100/api/bodega', { headers: headersB });
    const bodegaUsuarioBBody = await bodegaUsuarioB.json();
    assert.equal(bodegaUsuarioB.status, 200);
    assert.equal(bodegaUsuarioBBody.data.some((articulo) => articulo.id === bodegaBBody.data.id), true);

    const kardexUsuarioA = await fetch('http://localhost:3100/api/kardex', { headers });
    const kardexUsuarioABody = await kardexUsuarioA.json();
    assert.equal(kardexUsuarioA.status, 200);
    assert.equal(kardexUsuarioABody.data.some((movimiento) => movimiento.bodega_id === bodegaBBody.data.id), false);

    const deleteBodegaResponse = await fetch(`http://localhost:3100/api/bodega/${bodegaBBody.data.id}`, {
      method: 'DELETE',
      headers: headersB
    });
    const deleteBodegaBody = await deleteBodegaResponse.json();
    assert.equal(deleteBodegaResponse.status, 200);
    assert.equal(deleteBodegaBody.success, true);

    const bodegaBAfterDelete = await fetch('http://localhost:3100/api/bodega', { headers: headersB });
    const bodegaBAfterDeleteBody = await bodegaBAfterDelete.json();
    assert.equal(bodegaBAfterDeleteBody.data.some((articulo) => articulo.id === bodegaBBody.data.id), false);

    const invalidBodegaDelete = await fetch('http://localhost:3100/api/bodega/no-valido', {
      method: 'DELETE',
      headers: headersB
    });
    assert.equal(invalidBodegaDelete.status, 400);

    const createResponse = await fetch('http://localhost:3100/api/cultivos', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: loginBBody.usuario.id,
        tipo: 'Ensayo',
        area: 3.5,
        fecha_siembra: '2026-08-01',
        fecha_cosecha: '2026-12-01',
        produccion_esperada: 100,
        estado: 'Activo'
      })
    });

    const createBody = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createBody.success, true);
    assert.ok(createBody.data && createBody.data.id);
    assert.equal(createBody.data.usuario_id, loginBody.usuario.id);

    const cultivosUsuarioB = await fetch('http://localhost:3100/api/cultivos', { headers: headersB });
    const cultivosUsuarioBBody = await cultivosUsuarioB.json();
    assert.equal(cultivosUsuarioB.status, 200);
    assert.equal(cultivosUsuarioBBody.data.some((cultivo) => cultivo.id === createBody.data.id), false);

    const insumoAResponse = await fetch('http://localhost:3100/api/bodega', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Insumo de aplicación A',
        cantidad: 10,
        unidad: 'kg',
        stock_minimo: 1,
        costo_unitario: 100
      })
    });
    const insumoABody = await insumoAResponse.json();
    assert.equal(insumoAResponse.status, 201);

    const aplicacionResponse = await fetch('http://localhost:3100/api/insumos-cultivos', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cultivo_id: createBody.data.id,
        bodega_id: insumoABody.data.id,
        cantidad: 2,
        fecha_aplicacion: '2026-09-10'
      })
    });
    const aplicacionBody = await aplicacionResponse.json();
    assert.equal(aplicacionResponse.status, 201);

    const insumosAplicadosA = await fetch('http://localhost:3100/api/insumos-cultivos', { headers });
    const insumosAplicadosABody = await insumosAplicadosA.json();
    assert.equal(insumosAplicadosABody.data.some((insumo) => insumo.id === aplicacionBody.data.id), true);

    const insumosAplicadosB = await fetch('http://localhost:3100/api/insumos-cultivos', { headers: headersB });
    const insumosAplicadosBBody = await insumosAplicadosB.json();
    assert.equal(insumosAplicadosBBody.data.some((insumo) => insumo.id === aplicacionBody.data.id), false);

    const kardexConAplicacion = await fetch('http://localhost:3100/api/kardex', { headers });
    const kardexConAplicacionBody = await kardexConAplicacion.json();
    assert.equal(kardexConAplicacion.status, 200);
    assert.equal(kardexConAplicacionBody.data.some((movimiento) => movimiento.motivo === 'Aplicación en cultivo Ensayo'), true);

    const harvestResponse = await fetch('http://localhost:3100/api/cosechas', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ producto: 'Ensayo', kilos: 80, fecha: '2026-09-01' })
    });
    const harvestBody = await harvestResponse.json();
    assert.equal(harvestResponse.status, 201);
    assert.ok(harvestBody.data && harvestBody.data.id);

    const updateHarvestResponse = await fetch(`http://localhost:3100/api/cosechas/${harvestBody.data.id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ producto: 'Ensayo actualizado', kilos: 125, fecha: '2026-09-15' })
    });
    const updateHarvestBody = await updateHarvestResponse.json();
    assert.equal(updateHarvestResponse.status, 200);
    assert.equal(updateHarvestBody.success, true);
    assert.equal(updateHarvestBody.data.producto, 'Ensayo actualizado');
    assert.equal(Number(updateHarvestBody.data.kilos), 125);

    const workerResponse = await fetch('http://localhost:3100/api/trabajadores', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Trabajador de prueba', cedula: `CC-${identificador}`, cargo: 'Recolector' })
    });
    const workerBody = await workerResponse.json();
    assert.equal(workerResponse.status, 201);
    assert.ok(workerBody.data && workerBody.data.id);

    const salaryResponse = await fetch('http://localhost:3100/api/salarios', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trabajador_id: workerBody.data.id,
        pago_dia: 50000,
        dias_trabajados: 1
      })
    });
    const salaryBody = await salaryResponse.json();
    assert.equal(salaryResponse.status, 201);
    assert.ok(salaryBody.data && salaryBody.data.id);

    const deleteWorkerResponse = await fetch(`http://localhost:3100/api/trabajadores/${workerBody.data.id}`, {
      method: 'DELETE',
      headers
    });
    const deleteWorkerBody = await deleteWorkerResponse.json();
    assert.equal(deleteWorkerResponse.status, 200);
    assert.equal(deleteWorkerBody.success, true);

    const workersAfterDelete = await fetch('http://localhost:3100/api/trabajadores', { headers });
    const workersAfterDeleteBody = await workersAfterDelete.json();
    assert.equal(workersAfterDelete.status, 200);
    assert.equal(workersAfterDeleteBody.data.some((worker) => worker.id === workerBody.data.id), false);

    const salariesAfterDelete = await fetch('http://localhost:3100/api/salarios', { headers });
    const salariesAfterDeleteBody = await salariesAfterDelete.json();
    assert.equal(salariesAfterDelete.status, 200);
    assert.equal(salariesAfterDeleteBody.data.some((salary) => salary.id === salaryBody.data.id), false);

    const invalidDeleteResponse = await fetch('http://localhost:3100/api/trabajadores/no-valido', {
      method: 'DELETE',
      headers
    });
    assert.equal(invalidDeleteResponse.status, 400);

    const invalidRecoveryResponse = await fetch('http://localhost:3100/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    });
    assert.equal(invalidRecoveryResponse.status, 400);

    const recoveryResponse = await fetch('http://localhost:3100/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: usuarioA.email })
    });
    const recoveryBody = await recoveryResponse.json();
    assert.equal(recoveryResponse.status, 200);
    assert.equal(recoveryBody.success, true);
    const normalizedEmail = smtp.messages[0].replace(/=\r?\n/g, '').replace(/=3D/gi, '=');
    const resetToken = normalizedEmail.match(/resetToken=([a-f0-9]{64})/i)?.[1];
    assert.ok(resetToken, 'El correo debe incluir un enlace con token de recuperación');

    const unknownAccountRecovery = await fetch('http://localhost:3100/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `no-existe-${identificador}@example.com` })
    });
    const unknownAccountBody = await unknownAccountRecovery.json();
    assert.equal(unknownAccountRecovery.status, recoveryResponse.status);
    assert.equal(unknownAccountBody.message, recoveryBody.message);
    assert.equal(smtp.messages.length, 1);

    const invalidResetResponse = await fetch('http://localhost:3100/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    });
    assert.equal(invalidResetResponse.status, 400);

    const resetResponse = await fetch('http://localhost:3100/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, contraseña: 'nueva-clave-123' })
    });
    assert.equal(resetResponse.status, 200);

    const reusedTokenResponse = await fetch('http://localhost:3100/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, contraseña: 'otra-clave-123' })
    });
    assert.equal(reusedTokenResponse.status, 400);

    const loginWithNewPassword = await fetch('http://localhost:3100/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: usuarioA.email, contraseña: 'nueva-clave-123' })
    });
    assert.equal(loginWithNewPassword.status, 200);

    const loginWithOldPassword = await fetch('http://localhost:3100/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: usuarioA.email, contraseña: usuarioA.contraseña })
    });
    assert.equal(loginWithOldPassword.status, 401);

    consoleServer = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: '3101',
        DB_HOST: 'localhost',
        DB_USER: 'root',
        DB_PASSWORD: '',
        DB_NAME: 'agroinventario',
        NODE_ENV: 'development',
        RESET_LINK_DELIVERY: 'console',
        SMTP_HOST: '',
        SMTP_USER: '',
        SMTP_PASSWORD: '',
        FRONTEND_URL: 'http://localhost:5500/index.html'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitForServer('http://localhost:3101/api/health');

    const localRecoveryResponse = await fetch('http://localhost:3101/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5500'
      },
      body: JSON.stringify({ email: usuarioA.email })
    });
    const localRecoveryBody = await localRecoveryResponse.json();
    assert.equal(localRecoveryResponse.status, 200);
    assert.match(localRecoveryBody.message, /Enlace de prueba local generado/);
    const localResetUrl = new URL(localRecoveryBody.resetUrl);
    assert.equal(localResetUrl.origin, 'http://localhost:5500');
    const localToken = localResetUrl.searchParams.get('resetToken');
    assert.match(localToken, /^[a-f0-9]{64}$/);

    const untrustedOriginRecovery = await fetch('http://localhost:3101/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://example.com'
      },
      body: JSON.stringify({ email: usuarioA.email })
    });
    assert.equal(untrustedOriginRecovery.status, 403);

    const localResetResponse = await fetch('http://localhost:3101/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: localToken, contraseña: 'clave-modo-local-123' })
    });
    assert.equal(localResetResponse.status, 200);
  } finally {
    if (consoleServer) {
      consoleServer.kill('SIGTERM');
    }
    server.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await new Promise((resolve) => smtp.server.close(resolve));
  }
});