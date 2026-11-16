// --- NAVEGACIÓN ---
function hideAll() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('register-section').style.display = 'none';
    document.getElementById('recover-section').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
}
function showLogin() {
    recoveryToken = null;
    hideAll();
    document.getElementById('login-section').style.display = 'block';
}
function showRegister() {
    recoveryToken = null;
    hideAll();
    document.getElementById('register-section').style.display = 'block';
}
function showRecover() {
    recoveryToken = null;
    hideAll();
    document.getElementById('recover-section').style.display = 'block';
    document.getElementById('step-email').style.display = 'block';
    document.getElementById('step-reset').style.display = 'none';
    const result = document.getElementById('recovery-link-result');
    result.hidden = true;
    result.replaceChildren();
}

// CORREGIDO: Ahora incluye 'staff' y limpia secciones correctamente
function showModule(name) {
    document.getElementById('welcome-msg').style.display = 'none';
    document.querySelectorAll('.module-section').forEach(s => s.style.display = 'none');
    
    const section = document.getElementById('mod-' + name);
    if(section) section.style.display = 'block';

    if(name === 'crops') renderCrops();
    if(name === 'warehouse') renderWarehouse();
    if(name === 'harvests') renderHarvests();
    if(name === 'animals') renderAnimals();
    if(name === 'staff') renderStaff(); // <-- Línea agregada
}

// --- AUTENTICACIÓN CON SERVICIO WEB ---
/**
 * URL base del servicio web (cambiar si está en otro host)
 */
const API_URL = 'http://localhost:3000/api/auth';
const API_BASE = 'http://localhost:3000/api';
let currentCropList = [];
let recoveryToken = null;

async function sendRecoveryLink(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const result = document.getElementById('recovery-link-result');
    result.hidden = true;
    result.replaceChildren();
    button.disabled = true;
    button.textContent = 'Enviando...';

    try {
        const response = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: document.getElementById('recover-email').value.trim() })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            if (response.status === 401) {
                return alert('El servidor API que está ejecutándose no tiene activa la ruta de recuperación. Reinícialo desde la carpeta del proyecto con: node server.js');
            }
            return alert(data.message || 'No fue posible enviar el enlace.');
        }
        if (data.resetUrl) {
            const resetUrl = new URL(data.resetUrl);
            if (resetUrl.origin !== window.location.origin) {
                return alert('El servidor devolvió un enlace local que no coincide con esta página.');
            }

            const message = document.createElement('p');
            message.textContent = data.message;
            const link = document.createElement('a');
            link.className = 'recovery-link-button';
            link.href = resetUrl.toString();
            link.textContent = 'Restablecer mi contraseña';
            result.className = 'recovery-link-result';
            result.append(message, link);
            result.hidden = false;
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error solicitando enlace de recuperación:', error);
        alert('No fue posible conectar con el servidor para solicitar el enlace.');
    } finally {
        button.disabled = false;
        button.textContent = 'Enviar enlace';
    }
}

async function changePassword(event) {
    event.preventDefault();
    const contraseña = document.getElementById('new-pass').value;
    const confirmacion = document.getElementById('confirm-new-pass').value;
    if (contraseña !== confirmacion) {
        return alert('Las contraseñas no coinciden.');
    }
    if (!recoveryToken) {
        return alert('El enlace no es válido o ya venció. Solicita uno nuevo.');
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Actualizando...';
    try {
        const response = await fetch(`${API_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: recoveryToken, contraseña })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            return alert(data.message || 'No fue posible cambiar la contraseña.');
        }

        recoveryToken = null;
        document.getElementById('new-pass').value = '';
        document.getElementById('confirm-new-pass').value = '';
        alert(data.message);
        showLogin();
    } catch (error) {
        console.error('Error restableciendo contraseña:', error);
        alert('No fue posible conectar con el servidor para cambiar la contraseña.');
    } finally {
        button.disabled = false;
        button.textContent = 'Cambiar contraseña';
    }
}

function initializePasswordReset() {
    const params = new URLSearchParams(window.location.search);
    recoveryToken = params.get('resetToken');
    if (!recoveryToken) return;

    hideAll();
    document.getElementById('recover-section').style.display = 'block';
    document.getElementById('step-email').style.display = 'none';
    document.getElementById('step-reset').style.display = 'block';
    window.history.replaceState({}, document.title, window.location.pathname);
}

function apiFetch(url, options = {}) {
    const token = localStorage.getItem('authToken');
    const headers = new Headers(options.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...options, headers }).then(response => {
        if (token !== localStorage.getItem('authToken')) {
            throw new Error('La sesión cambió durante la solicitud');
        }
        return response;
    });
}

function clearUserDataViews() {
    document.querySelectorAll('.module-section tbody').forEach(tbody => tbody.replaceChildren());
    ['labor-employee', 'sal-emp', 'insumo-crop-select', 'insumo-select'].forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            const placeholder = select.options[0]?.cloneNode(true);
            select.replaceChildren(...(placeholder ? [placeholder] : []));
        }
    });
    const laboresList = document.getElementById('labores-list');
    if (laboresList) laboresList.replaceChildren();
    ['warehouse-summary', 'warehouse-available', 'warehouse-low', 'warehouse-empty'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = id === 'warehouse-summary' ? '' : '0';
    });
    currentCropList = [];
    currentHarvestList = [];
    animalesActuales = [];
    trabajadoresActuales = [];
}

/**
 * Registra un nuevo usuario mediante el servicio web
 * Validaciones: nombre, email válido, contraseña mínimo 6 caracteres
 */
async function registerUser() {
    try {
        const nombre = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const contraseña = document.getElementById('reg-pass').value;

        // Validar campos obligatorios
        if(!nombre || !email || !contraseña) {
            return alert("❌ Error: Completa todos los campos");
        }

        // Validar que la contraseña tenga mínimo 6 caracteres
        if(contraseña.length < 6) {
            return alert("❌ Error: La contraseña debe tener al menos 6 caracteres");
        }

        // Mostrar indicador de carga
        const boton = event.target;
        const textOriginal = boton.textContent;
        boton.disabled = true;
        boton.textContent = "Registrando...";

        // Enviar petición al servicio web
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombre: nombre,
                email: email,
                contraseña: contraseña
            })
        });

        // Procesar respuesta
        const data = await response.json();

        if (data.success) {
            alert("✅ " + data.message);
            // Limpiar formulario
            document.getElementById('reg-name').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-pass').value = '';
            // Ir a login
            showLogin();
        } else {
            alert("❌ " + data.message);
        }

    } catch (error) {
        console.error('Error:', error);
        alert("❌ Error de conexión: Verifica que el servidor esté ejecutándose en http://localhost:3000");
    } finally {
        // Restaurar botón
        const boton = event.target;
        boton.disabled = false;
        boton.textContent = "Registrarse";
    }
}

/**
 * Inicia sesión de usuario mediante el servicio web
 * Si la autenticación es correcta, muestra el dashboard
 * Si falla, muestra mensaje de error
 */
async function loginUser(event) {
    const boton = event.currentTarget;
    let timeoutId;
    const controller = new AbortController();

    try {
        const email = document.getElementById('login-email').value.trim();
        const contraseña = document.getElementById('login-password').value;

        // Validar campos obligatorios
        if(!email || !contraseña) {
            return alert("❌ Error: Completa email y contraseña");
        }

        // Mostrar indicador de carga
        boton.disabled = true;
        boton.textContent = "Ingresando...";
        timeoutId = setTimeout(() => controller.abort(), 15000);

        // Enviar petición al servicio web
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: controller.signal,
            body: JSON.stringify({
                email: email,
                contraseña: contraseña
            })
        });

        // Procesar respuesta
        const data = await response.json();

        if (data.success) {
            // Dar tiempo para mostrar el estado de autenticación sin bloquear la pantalla.
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Guardar usuario en localStorage
            localStorage.setItem('currentUser', JSON.stringify(data.usuario));
            localStorage.setItem('authToken', data.token);
            clearUserDataViews();
            
            // Limpiar formulario
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
            
            // Mostrar dashboard
            hideAll();
            document.getElementById('dashboard').style.display = 'block';
            document.getElementById('user-display').innerText = data.usuario.nombre;
        } else {
            // Error en autenticación
            alert("❌ " + data.message);
        }

    } catch (error) {
        console.error('Error:', error);
        if (error.name === 'AbortError') {
            alert("❌ La solicitud tardó demasiado. Verifica que el servidor y la base de datos estén disponibles.");
        } else {
            alert("❌ Error de conexión: Verifica que el servidor esté ejecutándose en http://localhost:3000");
        }
    } finally {
        // Restaurar botón
        clearTimeout(timeoutId);
        if (boton) {
            boton.disabled = false;
            boton.textContent = "Ingresar";
        }
    }
}

/**
 * Cierra la sesión del usuario actual
 */
function logout() { 
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    clearUserDataViews();
    showLogin();
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
}

// --- LÓGICA DE DATOS ---

// Cultivos
async function saveCrop(e) {
    e.preventDefault();

    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    if (!currentUser || !currentUser.id) {
        return alert('Debes iniciar sesión para guardar un cultivo.');
    }

    const tipo = document.getElementById('crop-type').value.trim();
    const area = document.getElementById('crop-area').value;
    const fecha_siembra = document.getElementById('crop-date').value;
    const fecha_cosecha = document.getElementById('crop-harvest-date').value;
    const produccion_esperada = document.getElementById('crop-expected-yield').value;
    const estado = document.getElementById('crop-status').value;

    if (!tipo || !area || !fecha_siembra || !fecha_cosecha || !produccion_esperada) {
        return alert('Completa todos los campos requeridos para guardar el cultivo.');
    }

    try {
        const response = await apiFetch(`${API_BASE}/cultivos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuario_id: currentUser.id,
                tipo,
                area: Number(area),
                fecha_siembra,
                fecha_cosecha,
                produccion_esperada: Number(produccion_esperada),
                estado
            })
        });

        const data = await response.json();

        if (!data.success) {
            return alert('Error al guardar el cultivo: ' + data.message);
        }

        alert('✅ Cultivo guardado correctamente.');
        e.target.reset();
        document.getElementById('hectares-display').innerText = '0.0000';
        document.getElementById('crop-area-hectares').value = '';
        await renderCrops();
    } catch (error) {
        console.error('Error guardando cultivo:', error);
        alert('Error de conexión: no se pudo guardar el cultivo.');
    }
}

async function renderCrops() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    let list = [];
    let appliedInputs = [];

    if (currentUser && currentUser.id) {
        try {
            const [response, inputsResponse, laboresResponse] = await Promise.all([
                apiFetch(`${API_BASE}/cultivos`),
                apiFetch(`${API_BASE}/insumos-cultivos`),
                apiFetch(`${API_BASE}/labores`)
            ]);
            const data = await response.json();
            const inputsData = await inputsResponse.json();
            const laboresData = await laboresResponse.json();

            if (inputsData.success && Array.isArray(inputsData.data)) {
                appliedInputs = inputsData.data;
            }
            const appliedLabors = laboresData.success && Array.isArray(laboresData.data) ? laboresData.data : [];

            if (data.success && Array.isArray(data.data)) {
                list = data.data.map(i => ({
                    id: i.id,
                    usuario_id: i.usuario_id,
                    type: i.tipo,
                    area: i.area,
                    date: i.fecha_siembra,
                    harvestDate: i.fecha_cosecha,
                    expectedYield: i.produccion_esperada,
                    status: i.estado,
                    insumos: appliedInputs.filter(input => input.cultivo_id === i.id),
                    labores: appliedLabors.filter(labor => labor.cultivo_id === i.id)
                }));
            }
        } catch (error) {
            console.error('Error cargando cultivos:', error);
        }
    }

    currentCropList = list;
    document.getElementById('table-crops').innerHTML = list.map(i => {
        const statusClass = getStatusClass(i);
        const insumosCount = i.insumos ? i.insumos.length : 0;
        const laboresCount = i.labores ? i.labores.length : 0;
        const areaHectares = parseFloat(i.area) / 10000;
        return `<tr>
            <td onclick="openEditCropModal(${i.id})" style="cursor:pointer;">${i.type}</td>
            <td onclick="openEditCropModal(${i.id})" style="cursor:pointer;">${i.area} m²<br><small style=\"color: #666;\">(${areaHectares.toFixed(2)} ha)</small></td>
            <td onclick="openEditCropModal(${i.id})" style="cursor:pointer;">${i.date}</td>
            <td onclick="openEditCropModal(${i.id})" style="cursor:pointer;"><span class="status-semaphore ${statusClass}">${i.status}</span></td>
            <td onclick="openEditCropModal(${i.id})" style="cursor:pointer;">${i.expectedYield || 0} kg</td>
            <td>
                <button class="btn-insumos" onclick="openInsumosModal(${i.id})">📦 Insumos (${insumosCount})</button>
            </td>
            <td>
                <button class="btn-labores" onclick="openLaboresModal(${i.id})">📋 Labores (${laboresCount})</button>
            </td>
            <td>
                <button class="btn-edit" onclick="openEditCropModal(${i.id})">✏️ Editar</button>
                <button class="btn-delete" onclick="deleteItem('crops', ${i.id})">X</button>
            </td>
        </tr>`;
    }).join('');
}

function openEditCropModal(cropId) {
    const crop = currentCropList.find(c => c.id == cropId);
    if (!crop) return;

    document.getElementById('edit-crop-id').value = crop.id;
    document.getElementById('edit-crop-type').value = crop.type || '';
    document.getElementById('edit-crop-area').value = crop.area || '';
    document.getElementById('edit-crop-date').value = crop.date || '';
    document.getElementById('edit-crop-harvest-date').value = crop.harvestDate || '';
    document.getElementById('edit-crop-expected-yield').value = crop.expectedYield || '';
    document.getElementById('edit-crop-status').value = crop.status || 'Siembra';

    document.getElementById('edit-crop-modal').style.display = 'block';
}

function closeEditCropModal() {
    document.getElementById('edit-crop-modal').style.display = 'none';
}

async function saveCropEdit(e) {
    e.preventDefault();
    const id = Number(document.getElementById('edit-crop-id').value);
    const crop = currentCropList.find(c => c.id === id);
    if (!crop) return;

    const tipo = document.getElementById('edit-crop-type').value.trim();
    const area = Number(document.getElementById('edit-crop-area').value);
    const fecha_siembra = document.getElementById('edit-crop-date').value;
    const fecha_cosecha = document.getElementById('edit-crop-harvest-date').value;
    const produccion_esperada = Number(document.getElementById('edit-crop-expected-yield').value);
    const estado = document.getElementById('edit-crop-status').value;

    if (!tipo || !area || !fecha_siembra || !fecha_cosecha || isNaN(produccion_esperada)) {
        return alert('Completa todos los campos para editar el cultivo.');
    }

    try {
        const response = await apiFetch(`${API_BASE}/cultivos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuario_id: crop.usuario_id,
                tipo,
                area,
                fecha_siembra,
                fecha_cosecha,
                produccion_esperada,
                estado
            })
        });

        const data = await response.json();
        if (!data.success) {
            return alert('Error al actualizar el cultivo: ' + data.message);
        }

        alert('✅ Cultivo actualizado correctamente.');
        closeEditCropModal();
        await renderCrops();
    } catch (error) {
        console.error('Error actualizando cultivo:', error);
        alert('Error de conexión: no se pudo actualizar el cultivo.');
    }
}

// Sistema de Semáforo
function getStatusClass(crop) {
    const today = new Date();
    const plantDate = new Date(crop.date);
    const harvestDate = crop.harvestDate ? new Date(crop.harvestDate) : null;
    const daysSincePlanting = Math.floor((today - plantDate) / (1000 * 60 * 60 * 24));

    if (crop.status === 'Siembra') return 'verde';
    if (crop.status === 'Crecimiento') return 'verde';
    if (crop.status === 'Mantenimiento') return 'amarillo';
    if (crop.status === 'Cosecha Próxima') return 'rojo';

    // Lógica automática basada en tiempo
    if (harvestDate) {
        const daysToHarvest = Math.floor((harvestDate - today) / (1000 * 60 * 60 * 24));
        if (daysToHarvest <= 7) return 'rojo'; // Menos de 7 días para cosecha
    }

    if (daysSincePlanting > 30) return 'amarillo'; // Necesita mantenimiento
    return 'verde'; // Recién sembrado
}

// Calculadora de Densidad
function calculatePlantDensity() {
    const area = parseFloat(document.getElementById('crop-area').value) || 0;
    const distPlantas = parseFloat(document.getElementById('calc-dist-plantas').value) / 100; // Convertir cm a m
    const distSurcos = parseFloat(document.getElementById('calc-dist-surcos').value) / 100; // Convertir cm a m

    if (!area || !distPlantas || !distSurcos) {
        document.getElementById('density-result').innerText = 'Complete todos los campos';
        return;
    }

    const plantasPorSurco = Math.floor(area / distSurcos);
    const plantasTotal = Math.floor(plantasPorSurco / distPlantas);

    const areaHectares = area / 10000;
    document.getElementById('density-result').innerText =
        `🌱 Caben aproximadamente ${plantasTotal.toLocaleString()} plantas en ${area.toLocaleString()} m² (${areaHectares.toFixed(2)} ha)`;
}

function clearDensityCalculator() {
    document.getElementById('calc-dist-plantas').value = '';
    document.getElementById('calc-dist-surcos').value = '';
    document.getElementById('density-result').innerText = '';
}

// Gestión de Insumos
async function openInsumosModal(cropId) {
    const modal = document.getElementById('insumos-modal');
    const cropSelect = document.getElementById('insumo-crop-select');
    const insumoSelect = document.getElementById('insumo-select');

    cropSelect.innerHTML = '<option value="">Cargando cultivos...</option>';
    insumoSelect.innerHTML = '<option value="">Cargando insumos...</option>';
    modal.style.display = 'block';

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
        const cropsUrl = currentUser && currentUser.id
            ? `${API_BASE}/cultivos?usuario_id=${currentUser.id}`
            : `${API_BASE}/cultivos`;
        const [cropsResponse, warehouseResponse] = await Promise.all([
            apiFetch(cropsUrl),
            apiFetch(`${API_BASE}/bodega`)
        ]);
        const cropsData = await cropsResponse.json();
        const data = await warehouseResponse.json();
        if (!cropsData.success) throw new Error(cropsData.message);
        if (!data.success) throw new Error(data.message);

        currentCropList = cropsData.data.map(c => ({
            id: c.id,
            type: c.tipo,
            area: c.area,
            date: c.fecha_siembra,
            harvestDate: c.fecha_cosecha,
            expectedYield: c.produccion_esperada,
            status: c.estado
        }));
        cropSelect.innerHTML = currentCropList.map(c => {
            const areaHa = (parseFloat(c.area) / 10000).toFixed(2);
            return `<option value="${c.id}" ${c.id == cropId ? 'selected' : ''}>${c.type} - ${c.area}m² (${areaHa}ha)</option>`;
        }).join('');
        insumoSelect.innerHTML = '<option value="">Seleccionar insumo</option>' +
            data.data.filter(w => Number(w.cantidad) > 0).map(w => `<option value="${w.id}">${w.nombre} (${w.cantidad} ${w.unidad})</option>`).join('');
    } catch (error) {
        console.error('Error cargando insumos disponibles:', error);
        cropSelect.innerHTML = '<option value="">No se pudieron cargar los cultivos</option>';
        insumoSelect.innerHTML = '<option value="">No se pudieron cargar los insumos</option>';
    }
    modal.dataset.cropId = cropId;
}

function closeInsumosModal() {
    document.getElementById('insumos-modal').style.display = 'none';
}

async function applyInsumo() {
    const cropId = document.getElementById('insumos-modal').dataset.cropId;
    const insumoId = document.getElementById('insumo-select').value;
    const quantity = parseFloat(document.getElementById('insumo-quantity').value);
    const date = document.getElementById('insumo-date').value;

    if (!insumoId || !quantity || !date) {
        alert('Complete todos los campos');
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE}/insumos-cultivos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cultivo_id: Number(cropId),
                bodega_id: Number(insumoId),
                cantidad: quantity,
                fecha_aplicacion: date
            })
        });
        const data = await response.json();
        if (!data.success) {
            alert('Error al aplicar insumo: ' + data.message);
            return;
        }

        document.getElementById('insumo-quantity').value = '';
        document.getElementById('insumo-date').value = '';
        closeInsumosModal();
        await renderCrops();
        await renderWarehouse();
    } catch (error) {
        console.error('Error aplicando insumo:', error);
        alert('Error de conexión: no se pudo aplicar el insumo.');
    }
}

// Gestión de Labores
async function openLaboresModal(cropId) {
    const modal = document.getElementById('labores-modal');
    const employeeSelect = document.getElementById('labor-employee');

    // Llenar select de trabajadores
    try {
        const [laboresResponse, employeesResponse] = await Promise.all([
            apiFetch(`${API_BASE}/labores?cultivo_id=${cropId}`),
            apiFetch(`${API_BASE}/trabajadores`)
        ]);
        const laboresData = await laboresResponse.json();
        const employeesData = await employeesResponse.json();
        employeeSelect.innerHTML = '<option value="">Seleccionar trabajador</option>' +
            employeesData.data.map(emp => `<option value="${emp.id}">${emp.nombre} (${emp.cargo})</option>`).join('');
        const laboresHtml = laboresData.data.map(l =>
            `<div style="padding: 8px; border-bottom: 1px solid #eee;">
                <strong>${l.fecha}:</strong> ${l.descripcion}<br>
                <small style="color:#555;">Trabajador: ${l.trabajador || 'No asignado'}</small>
                <button onclick="deleteLabor(${cropId}, ${l.id})" style="float:right; background:red; color:white; border:none; padding:2px 6px; border-radius:3px;">X</button>
            </div>`
        ).join('');
        document.getElementById('labores-list').innerHTML = laboresHtml || '<p>No hay labores registradas</p>';
    } catch (error) {
        console.error('Error cargando labores:', error);
        document.getElementById('labores-list').innerHTML = '<p>No hay labores registradas</p>';
    }

    document.getElementById('labor-date').value = '';
    document.getElementById('labor-description').value = '';
    document.getElementById('labor-employee').value = '';
    modal.style.display = 'block';
    modal.dataset.cropId = cropId;
}

function closeLaboresModal() {
    document.getElementById('labores-modal').style.display = 'none';
}

async function addLabor() {
    const cropId = document.getElementById('labores-modal').dataset.cropId;
    const date = document.getElementById('labor-date').value;
    const description = document.getElementById('labor-description').value;
    const workerId = document.getElementById('labor-employee').value;

    if (!date || !description || !workerId) {
        alert('Complete fecha, descripción y trabajador responsable');
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE}/labores`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cultivo_id: Number(cropId), trabajador_id: Number(workerId), fecha: date, descripcion: description })
        });
        const data = await response.json();
        if (!data.success) return alert('Error al guardar labor: ' + data.message);
        document.getElementById('labor-date').value = '';
        document.getElementById('labor-description').value = '';
        document.getElementById('labor-employee').value = '';
        await openLaboresModal(cropId);
        await renderCrops();
    } catch (error) {
        console.error('Error guardando labor:', error);
        alert('Error de conexión: no se pudo guardar la labor.');
    }
}

async function deleteLabor(cropId, laborId) {
    try {
        const response = await apiFetch(`${API_BASE}/labores/${laborId}`, { method: 'DELETE' });
        const data = await response.json();
        if (!data.success) return alert('Error al eliminar labor: ' + data.message);
        await openLaboresModal(cropId);
        await renderCrops();
    } catch (error) {
        console.error('Error eliminando labor:', error);
        alert('Error de conexión: no se pudo eliminar la labor.');
    }
}

// Bodega
async function saveWarehouse(e) {
    e.preventDefault();
    const articulo = {
        nombre: document.getElementById('wh-name').value.trim(),
        cantidad: Number(document.getElementById('wh-qty').value),
        unidad: document.getElementById('wh-unit').value.trim(),
        stock_minimo: Number(document.getElementById('wh-min-stock').value),
        fecha_vencimiento: document.getElementById('wh-expiry').value || null,
        costo_unitario: Number(document.getElementById('wh-cost').value),
        usuario: JSON.parse(localStorage.getItem('currentUser'))?.nombre || 'Sistema'
    };

    try {
        const response = await apiFetch(`${API_BASE}/bodega`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(articulo)
        });
        const data = await response.json();
        if (!data.success) return alert('Error: ' + data.message);
        e.target.reset();
        await renderWarehouse();
    } catch (error) {
        console.error('Error guardando artículo:', error);
        alert('Error de conexión: no se pudo guardar el artículo.');
    }
}
async function renderWarehouse() {
    try {
        const [response, kardexResponse, cropsResponse] = await Promise.all([
            apiFetch(`${API_BASE}/bodega`),
            apiFetch(`${API_BASE}/kardex`),
            apiFetch(`${API_BASE}/cultivos`)
        ]);
        const data = await response.json();
        const kardexData = await kardexResponse.json();
        const cropsData = await cropsResponse.json();
        const cropNames = new Map(
            cropsData.success && Array.isArray(cropsData.data)
                ? cropsData.data.map(crop => [String(crop.id), crop.tipo])
                : []
        );
        if (!data.success) throw new Error(data.message);
        const summary = document.getElementById('warehouse-summary');
        const totalUnits = data.data.reduce((total, item) => total + Number(item.cantidad), 0);
        const lowStockItems = data.data.filter(item => Number(item.cantidad) <= Number(item.stock_minimo)).length;
        const emptyStockItems = data.data.filter(item => Number(item.cantidad) <= 0).length;
        const availableItems = data.data.length - lowStockItems;
        document.getElementById('warehouse-available').textContent = availableItems;
        document.getElementById('warehouse-low').textContent = lowStockItems - emptyStockItems;
        document.getElementById('warehouse-empty').textContent = emptyStockItems;
        if (summary) {
            summary.textContent = data.data.length
                ? `${data.data.length} insumo(s) registrado(s) | ${totalUnits} unidades en inventario | ${lowStockItems} requieren atención`
                : 'No hay insumos registrados en el inventario.';
        }
        document.getElementById('table-warehouse').innerHTML = data.data.length ? data.data.map(item => {
            const total = Number(item.cantidad) * Number(item.costo_unitario);
            const cantidad = Number(item.cantidad);
            const estado = cantidad <= 0 ? 'Agotado' : cantidad <= Number(item.stock_minimo) ? 'Bajo' : 'Disponible';
            const estadoClave = estado.toLowerCase();
            return `<tr data-warehouse-status="${estadoClave}"><td>${item.nombre}</td><td>${item.cantidad}</td><td>${item.unidad}</td><td>${item.stock_minimo}</td><td>${item.fecha_vencimiento || '-'}</td><td>$${Number(item.costo_unitario).toFixed(2)}</td><td>$${total.toFixed(2)}</td><td><span class="inventory-status ${estadoClave}">${estado}</span></td><td><button type="button" class="btn-delete" onclick="deleteItem('warehouse', ${item.id})">Eliminar</button></td></tr>`;
        }).join('') : '<tr><td colspan="9">No hay insumos registrados.</td></tr>';

        const kardexBody = document.getElementById('table-kardex');
        if (kardexBody) {
            kardexBody.innerHTML = kardexData.success && kardexData.data.length
                ? kardexData.data.map(m => {
                    const motivo = String(m.motivo || '').replace(
                        /^Aplicación en cultivo (\d+)$/,
                        (_, cropId) => `Aplicación en cultivo ${cropNames.get(cropId) || cropId}`
                    );
                    return `<tr><td>${m.fecha}</td><td>${m.tipo}</td><td>${m.cantidad}</td><td>${motivo}</td><td>${m.usuario}</td></tr>`;
                }).join('')
                : '<tr><td colspan="5">No hay movimientos registrados.</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando bodega:', error);
        const summary = document.getElementById('warehouse-summary');
        if (summary) summary.textContent = 'No se pudo consultar el inventario.';
        document.getElementById('warehouse-available').textContent = '0';
        document.getElementById('warehouse-low').textContent = '0';
        document.getElementById('warehouse-empty').textContent = '0';
        document.getElementById('table-warehouse').innerHTML = '<tr><td colspan="9">No se pudo cargar la bodega.</td></tr>';
    }
}
function filterWarehouse() {
    const search = document.getElementById('warehouse-search').value.toLowerCase();
    const status = document.getElementById('warehouse-status-filter').value;
    document.querySelectorAll('#table-warehouse tr').forEach(row => {
        const matchesSearch = row.textContent.toLowerCase().includes(search);
        const matchesStatus = status === 'todos' || row.dataset.warehouseStatus === status;
        row.style.display = matchesSearch && matchesStatus ? '' : 'none';
    });
}

async function generateWarehouseReport() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        return alert('No se pudo cargar el generador de PDF. Revisa tu conexión e inténtalo de nuevo.');
    }

    const rows = [...document.querySelectorAll('#table-warehouse tr')]
        .filter(row => row.style.display !== 'none' && row.cells.length >= 8)
        .map(row => [...row.cells].slice(0, 8).map(cell => cell.textContent.trim()));
    if (!rows.length) return alert('No hay artículos visibles para generar el reporte.');

    const { jsPDF } = window.jspdf;
    const documentPdf = new jsPDF({ orientation: 'landscape' });
    documentPdf.setFontSize(18);
    documentPdf.text('Reporte de inventario', 14, 18);
    documentPdf.setFontSize(10);
    documentPdf.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 14, 25);

    const headers = ['Nombre', 'Cantidad', 'Unidad', 'Mínimo', 'Vencimiento', 'Costo unitario', 'Valor total', 'Estado'];
    const columnWidths = [42, 22, 22, 18, 32, 30, 28, 25];
    let y = 35;
    documentPdf.setFillColor(46, 125, 50);
    documentPdf.setTextColor(255, 255, 255);
    headers.forEach((header, index) => {
        const x = columnWidths.slice(0, index).reduce((total, width) => total + width, 14);
        documentPdf.rect(x, y - 5, columnWidths[index], 8, 'F');
        documentPdf.text(header, x + 2, y);
    });
    documentPdf.setTextColor(0, 0, 0);
    rows.forEach(row => {
        y += 9;
        if (y > 190) {
            documentPdf.addPage('landscape');
            y = 18;
        }
        row.forEach((value, index) => {
            const x = columnWidths.slice(0, index).reduce((total, width) => total + width, 14);
            documentPdf.text(value.slice(0, 24), x + 2, y);
        });
    });
    documentPdf.save(`reporte-inventario-${new Date().toISOString().slice(0, 10)}.pdf`);
}

let barcodeStream = null;
let barcodeAnimationFrame = null;

async function scanBarcode() {
    const modal = document.getElementById('barcode-modal');
    const video = document.getElementById('barcode-video');
    const status = document.getElementById('barcode-status');
    modal.style.display = 'block';
    document.getElementById('barcode-value').focus();

    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
        status.textContent = 'Tu navegador no permite lectura automática. Ingresa el código manualmente.';
        video.style.display = 'none';
        return;
    }

    try {
        barcodeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        video.srcObject = barcodeStream;
        const detector = new BarcodeDetector();
        const detect = async () => {
            if (modal.style.display === 'none') return;
            try {
                const barcodes = await detector.detect(video);
                if (barcodes.length) {
                    document.getElementById('barcode-value').value = barcodes[0].rawValue;
                    status.textContent = `Código detectado: ${barcodes[0].rawValue}`;
                    return;
                }
            } catch (error) {
                console.error('Error leyendo código de barras:', error);
            }
            barcodeAnimationFrame = requestAnimationFrame(detect);
        };
        video.addEventListener('loadeddata', detect, { once: true });
    } catch (error) {
        status.textContent = 'No se pudo abrir la cámara. Ingresa el código manualmente.';
        console.error('Error accediendo a la cámara:', error);
    }
}

function searchBarcodeItem() {
    const value = document.getElementById('barcode-value').value.trim().toLowerCase();
    if (!value) return alert('Ingresa o escanea un código.');
    const row = [...document.querySelectorAll('#table-warehouse tr')]
        .find(item => item.textContent.toLowerCase().includes(value));
    closeBarcodeScanner();
    if (!row) return alert(`No se encontró un artículo con el código ${value}.`);
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.style.backgroundColor = '#fff59d';
    setTimeout(() => { row.style.backgroundColor = ''; }, 2500);
}

function closeBarcodeScanner() {
    const video = document.getElementById('barcode-video');
    if (barcodeAnimationFrame) cancelAnimationFrame(barcodeAnimationFrame);
    barcodeAnimationFrame = null;
    if (barcodeStream) barcodeStream.getTracks().forEach(track => track.stop());
    barcodeStream = null;
    video.srcObject = null;
    document.getElementById('barcode-modal').style.display = 'none';
}

// Cosechas
let currentHarvestList = [];

async function saveHarvest(e) {
    e.preventDefault();
    const harvestId = document.getElementById('hv-id').value;
    const cropName = document.getElementById('hv-crop').value.trim();
    const kilos = parseFloat(document.getElementById('hv-kilos').value);
    const date = document.getElementById('hv-date').value;

    try {
        const response = await apiFetch(`${API_BASE}/cosechas${harvestId ? `/${harvestId}` : ''}`, {
            method: harvestId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ producto: cropName, kilos, fecha: date })
        });
        const data = await response.json();
        if (!data.success) return alert('Error: ' + data.message);
        resetHarvestForm();
        await renderHarvests();
    } catch (error) {
        console.error('Error guardando cosecha:', error);
        alert('Error de conexión: no se pudo guardar la cosecha.');
    }
}

function editHarvest(harvestId) {
    const harvest = currentHarvestList.find(item => item.id === harvestId);
    if (!harvest) return;
    document.getElementById('hv-id').value = harvest.id;
    document.getElementById('hv-crop').value = harvest.producto || '';
    document.getElementById('hv-kilos').value = harvest.kilos || '';
    document.getElementById('hv-date').value = harvest.fecha || '';
    document.getElementById('harvest-submit').textContent = 'Guardar cambios';
    document.getElementById('harvest-cancel').style.display = 'block';
    document.getElementById('hv-crop').focus();
}

function resetHarvestForm() {
    document.getElementById('hv-id').value = '';
    document.getElementById('hv-crop').value = '';
    document.getElementById('hv-kilos').value = '';
    document.getElementById('hv-date').value = '';
    document.getElementById('harvest-submit').textContent = 'Registrar';
    document.getElementById('harvest-cancel').style.display = 'none';
}

async function renderHarvests() {
    try {
        const response = await apiFetch(`${API_BASE}/cosechas`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        currentHarvestList = data.data;
        document.getElementById('table-harvests').innerHTML = data.data.map(i => {
            const efficiencyText = Number(i.expectedYield) > 0 ?
                `<br><small style="color: ${Number(i.efficiency) >= 100 ? 'green' : Number(i.efficiency) >= 80 ? 'orange' : 'red'};">Eficiencia: ${i.efficiency}%</small>` : '';
            return `<tr>
                <td>${i.producto}</td>
                <td>${i.kilos} kg${efficiencyText}</td>
                <td>${i.fecha}</td>
                <td><button class="btn-edit" onclick="editHarvest(${i.id})">Editar</button>
                <button class="btn-delete" onclick="deleteItem('harvests', ${i.id})">X</button></td>
            </tr>`;
        }).join('');
    } catch (error) {
        console.error('Error cargando cosechas:', error);
        document.getElementById('table-harvests').innerHTML = '<tr><td colspan="4">No se pudieron cargar las cosechas.</td></tr>';
    }
}

// Animales
let animalEnEdicion = null;

async function saveAnimal(e) {
    e.preventDefault();
    const animal = {
        tipo: document.getElementById('an-type').value.trim(),
        cantidad: Number(document.getElementById('an-qty').value),
        edad: Number(document.getElementById('an-age').value)
    };

    try {
        const response = await apiFetch(animalEnEdicion
            ? `${API_BASE}/animales/${animalEnEdicion}`
            : `${API_BASE}/animales`, {
            method: animalEnEdicion ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(animal)
        });
        const data = await response.json();
        if (!data.success) return alert(`Error al ${animalEnEdicion ? 'actualizar' : 'registrar'} animal: ` + data.message);
        resetAnimalForm();
        await renderAnimals();
    } catch (error) {
        console.error('Error guardando animal:', error);
        alert(`Error de conexión: no se pudo ${animalEnEdicion ? 'actualizar' : 'registrar'} el animal.`);
    }
}

function editAnimal(animal) {
    animalEnEdicion = animal.id;
    document.getElementById('an-type').value = animal.tipo;
    document.getElementById('an-qty').value = animal.cantidad;
    document.getElementById('an-age').value = animal.edad;
    document.getElementById('animal-submit').textContent = 'Guardar cambios';
    document.getElementById('animal-cancel').style.display = 'inline-block';
    document.getElementById('an-type').focus();
}

function editAnimalById(animalId) {
    const animal = animalesActuales.find(item => item.id === animalId);
    if (animal) editAnimal(animal);
}

function resetAnimalForm() {
    animalEnEdicion = null;
    const form = document.querySelector('#mod-animals form');
    if (form) form.reset();
    const submit = document.getElementById('animal-submit');
    if (submit) submit.textContent = 'Registrar';
    const cancel = document.getElementById('animal-cancel');
    if (cancel) cancel.style.display = 'none';
}

let animalesActuales = [];

async function renderAnimals() {
    try {
        const response = await apiFetch(`${API_BASE}/animales`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        animalesActuales = data.data;
        document.getElementById('table-animals').innerHTML = data.data.map(i => `<tr><td>${i.tipo}</td><td>${i.cantidad}</td><td>${i.edad}</td><td><button type="button" onclick="editAnimalById(${i.id})">Editar</button><button class="btn-delete" onclick="deleteItem('animals', ${i.id})">X</button></td></tr>`).join('');
    } catch (error) {
        console.error('Error cargando animales:', error);
        document.getElementById('table-animals').innerHTML = '<tr><td colspan="4">No se pudieron cargar los animales.</td></tr>';
    }
}

// --- EMPLEADOS Y NÓMINA ---

// Registro de Empleados
let trabajadorEnEdicion = null;
let trabajadoresActuales = [];

async function saveEmployee(e) {
    e.preventDefault();
    const trabajador = {
        nombre: document.getElementById('emp-name').value.trim(),
        cedula: document.getElementById('emp-cedula').value.trim(),
        cargo: document.getElementById('emp-cargo').value.trim()
    };
    try {
        const url = trabajadorEnEdicion
            ? `${API_BASE}/trabajadores/${trabajadorEnEdicion}`
            : `${API_BASE}/trabajadores`;
        const response = await apiFetch(url, {
            method: trabajadorEnEdicion ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trabajador)
        });
        const data = await response.json();
        if (!data.success) return alert('Error: ' + data.message);
        trabajadorEnEdicion = null;
        e.target.reset();
        resetEmployeeForm();
        await renderEmployees();
        await updateEmployeeSelect();
    } catch (error) {
        console.error('Error guardando trabajador:', error);
        alert('Error de conexión: no se pudo guardar el trabajador.');
    }
}

function editEmployee(trabajador) {
    trabajadorEnEdicion = trabajador.id;
    document.getElementById('emp-name').value = trabajador.nombre;
    document.getElementById('emp-cedula').value = trabajador.cedula;
    document.getElementById('emp-cargo').value = trabajador.cargo;
    document.getElementById('employee-submit').textContent = 'Guardar cambios';
    document.getElementById('employee-cancel').style.display = 'inline-block';
    document.getElementById('emp-name').focus();
}

function editEmployeeById(trabajadorId) {
    const trabajador = trabajadoresActuales.find(item => item.id === trabajadorId);
    if (trabajador) editEmployee(trabajador);
}

function resetEmployeeForm() {
    trabajadorEnEdicion = null;
    const form = document.getElementById('employee-form');
    if (form) form.reset();
    const submit = document.getElementById('employee-submit');
    if (submit) submit.textContent = 'Registrar Empleado';
    const cancel = document.getElementById('employee-cancel');
    if (cancel) cancel.style.display = 'none';
}

async function renderEmployees() {
    const tbody = document.getElementById('table-employees');
    if(!tbody) return;
    try {
        const response = await apiFetch(`${API_BASE}/trabajadores`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        trabajadoresActuales = data.data;
        tbody.innerHTML = data.data.map(i => `
        <tr>
            <td>${i.nombre}</td>
            <td>${i.cedula}</td>
            <td>${i.cargo}</td>
            <td>
            <button type="button" onclick="editEmployeeById(${i.id})">Editar</button>
                <button type="button" class="btn-delete" onclick="deleteItem('employees', ${i.id})">X</button>
            </td>
        </tr>`).join('');
    } catch (error) {
        console.error('Error cargando trabajadores:', error);
        tbody.innerHTML = '<tr><td colspan="4">No se pudieron cargar los trabajadores.</td></tr>';
    }
}

async function updateEmployeeSelect() {
    const select = document.getElementById('sal-emp');
    if(!select) return;
    try {
        const response = await apiFetch(`${API_BASE}/trabajadores`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        select.innerHTML = '<option value="">-- Seleccionar empleado --</option>' + data.data.map(i => `<option value="${i.id}|${i.nombre}|${i.cargo}">${i.nombre} (${i.cargo})</option>`).join('');
    } catch (error) {
        console.error('Error cargando trabajadores:', error);
    }
}

// Cálculo de Salarios
function calculateSalaryTotal() {
    const horasExtras = Number(document.getElementById('sal-horas-extras').value) || 0;
    const precioHoraExtra = Number(document.getElementById('sal-precio-hora-extra').value) || 0;
    const descSalud = Number(document.getElementById('sal-desc-salud').value) || 0;
    const descPension = Number(document.getElementById('sal-desc-pension').value) || 0;
    const descPrestamo = Number(document.getElementById('sal-desc-prestamo').value) || 0;
    const diasTrabajados = Number(document.getElementById('sal-dias-trabajados').value) || 0;
    const pagoDia = Number(document.getElementById('sal-pago-dia').value) || 0;
    
    const salarioBase = diasTrabajados * pagoDia;
    const pagoExtras = horasExtras * precioHoraExtra;
    const totalDescuentos = descSalud + descPension + descPrestamo;
    const total = salarioBase + pagoExtras - totalDescuentos;
    
    document.getElementById('sal-total-display').innerText = Math.max(0, total).toLocaleString('es-CO', {minimumFractionDigits: 2});
}

async function saveSalary(e) {
    e.preventDefault();
    const empData = document.getElementById('sal-emp').value.split('|');
    const empId = empData[0];
    const empName = empData[1];
    const empCargo = empData[2];
    
    const horasExtras = Number(document.getElementById('sal-horas-extras').value) || 0;
    const precioHoraExtra = Number(document.getElementById('sal-precio-hora-extra').value) || 0;
    const descSalud = Number(document.getElementById('sal-desc-salud').value) || 0;
    const descPension = Number(document.getElementById('sal-desc-pension').value) || 0;
    const descPrestamo = Number(document.getElementById('sal-desc-prestamo').value) || 0;
    const diasTrabajados = Number(document.getElementById('sal-dias-trabajados').value);
    const pagoDia = Number(document.getElementById('sal-pago-dia').value);
    
    const salarioBase = diasTrabajados * pagoDia;
    const pagoExtras = horasExtras * precioHoraExtra;
    const totalDescuentos = descSalud + descPension + descPrestamo;
    const totalAPagar = Math.max(0, salarioBase + pagoExtras - totalDescuentos);
    
    try {
        const response = await apiFetch(`${API_BASE}/salarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trabajador_id: Number(empId), pago_dia: pagoDia, dias_trabajados: diasTrabajados, horas_extras: horasExtras, precio_hora_extra: precioHoraExtra, descuento_salud: descSalud, descuento_pension: descPension, descuento_prestamo: descPrestamo })
        });
        const data = await response.json();
        if (!data.success) return alert('Error: ' + data.message);
        e.target.reset();
        document.getElementById('sal-total-display').innerText = '0';
        await renderSalaries();
    } catch (error) {
        console.error('Error guardando salario:', error);
        alert('Error de conexión: no se pudo guardar el salario.');
    }
}

async function renderSalaries() {
    const tbody = document.getElementById('table-salaries');
    if(!tbody) return;
    try {
        const response = await apiFetch(`${API_BASE}/salarios`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        let totalGeneral = 0;
        const formatMoney = value => Number(value || 0).toLocaleString('es-CO', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        tbody.innerHTML = data.data.map(i => {
        const descuentosText = `Salud: $${formatMoney(i.descuento_salud)}\nPensión: $${formatMoney(i.descuento_pension)}\nPréstamo: $${formatMoney(i.descuento_prestamo)}`;
        const pagoExtras = Number(i.horas_extras) * Number(i.precio_hora_extra);
        const horasExtrasText = Number(i.horas_extras) > 0 ? `${i.horas_extras} h x $${formatMoney(i.precio_hora_extra)}\nTotal: $${formatMoney(pagoExtras)}` : 'Ninguna';
        totalGeneral += Number(i.total_pagar);
        return `
        <tr>
            <td>${i.nombre}</td>
            <td>${i.cargo}</td>
            <td>${i.dias_trabajados}</td>
            <td class="salary-detail">${horasExtrasText}</td>
            <td class="salary-detail">${descuentosText}</td>
            <td class="salary-total"><strong>$${formatMoney(i.total_pagar)}</strong></td>
            <td><button class="btn-delete" onclick="deleteItem('salaries', ${i.id})">X</button></td>
        </tr>`;
        }).join('');
        document.getElementById('total-all-salaries').innerText = formatMoney(totalGeneral);
    } catch (error) {
        console.error('Error cargando salarios:', error);
        tbody.innerHTML = '<tr><td colspan="7">No se pudieron cargar los salarios.</td></tr>';
    }
}

function renderStaff() {
    renderEmployees();
    renderSalaries();
    updateEmployeeSelect();
}

// Función para convertir m² a hectáreas
function updateHectares() {
    const areaM2 = parseFloat(document.getElementById('crop-area').value) || 0;
    const areaHectares = areaM2 / 10000; // 1 hectárea = 10,000 m²
    document.getElementById('hectares-display').innerText = areaHectares.toFixed(4);
    document.getElementById('crop-area-hectares').value = areaHectares.toFixed(4);
}

// Función para convertir hectáreas a m²
function updateFromHectares() {
    const areaHectares = parseFloat(document.getElementById('crop-area-hectares').value) || 0;
    const areaM2 = areaHectares * 10000; // 1 hectárea = 10,000 m²
    document.getElementById('crop-area').value = Math.round(areaM2);
    document.getElementById('hectares-display').innerText = areaHectares.toFixed(4);
}

// Inicializar conversión de área al cargar
document.addEventListener('DOMContentLoaded', function() {
    const areaInput = document.getElementById('crop-area');
    const hectaresInput = document.getElementById('crop-area-hectares');
    
    if (areaInput) {
        areaInput.addEventListener('input', updateHectares);
        if (areaInput.value) {
            updateHectares();
        }
    }
    
    if (hectaresInput) {
        hectaresInput.addEventListener('input', updateFromHectares);
    }
});

// Función para eliminar elementos
async function deleteItem(key, id) {
    if (key === 'crops') {
        try {
            const response = await apiFetch(`${API_BASE}/cultivos/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (!data.success) {
                return alert('Error al eliminar el cultivo: ' + data.message);
            }
            await renderCrops();
        } catch (error) {
            console.error('Error eliminando cultivo:', error);
            alert('Error de conexión: no se pudo eliminar el cultivo.');
        }
        return;
    }

    if (key === 'warehouse') {
        const articulo = document.querySelector(`#table-warehouse button[onclick="deleteItem('warehouse', ${id})"]`);
        const nombreArticulo = articulo?.closest('tr')?.cells[0]?.textContent || 'este insumo';
        if (!confirm(`¿Deseas eliminar ${nombreArticulo}? Esta acción también eliminará su historial de movimientos.`)) return;

        try {
            const response = await apiFetch(`${API_BASE}/bodega/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!data.success) return alert('Error al eliminar el artículo: ' + data.message);
            await renderWarehouse();
        } catch (error) {
            console.error('Error eliminando artículo:', error);
            alert('Error de conexión: no se pudo eliminar el artículo.');
        }
        return;
    }

    if (key === 'harvests') {
        try {
            const response = await apiFetch(`${API_BASE}/cosechas/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!data.success) return alert('Error al eliminar la cosecha: ' + data.message);
            await renderHarvests();
        } catch (error) {
            console.error('Error eliminando cosecha:', error);
            alert('Error de conexión: no se pudo eliminar la cosecha.');
        }
        return;
    }

    if (key === 'animals') {
        try {
            const response = await apiFetch(`${API_BASE}/animales/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!data.success) return alert('Error al eliminar el animal: ' + data.message);
            await renderAnimals();
        } catch (error) {
            console.error('Error eliminando animal:', error);
            alert('Error de conexión: no se pudo eliminar el animal.');
        }
        return;
    }

    if (key === 'employees') {
        const trabajador = trabajadoresActuales.find(item => item.id === id);
        const nombreTrabajador = trabajador ? ` a ${trabajador.nombre}` : '';
        if (!confirm(`¿Deseas eliminar${nombreTrabajador}? Esta acción no se puede deshacer.`)) return;

        try {
            const response = await apiFetch(`${API_BASE}/trabajadores/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!data.success) return alert('Error al eliminar el trabajador: ' + data.message);
            await renderEmployees();
            await updateEmployeeSelect();
        } catch (error) {
            console.error('Error eliminando trabajador:', error);
            alert('Error de conexión: no se pudo eliminar el trabajador.');
        }
        return;
    }

    if (key === 'salaries') {
        try {
            const response = await apiFetch(`${API_BASE}/salarios/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!data.success) return alert('Error al eliminar el salario: ' + data.message);
            await renderSalaries();
        } catch (error) {
            console.error('Error eliminando salario:', error);
            alert('Error de conexión: no se pudo eliminar el salario.');
        }
        return;
    }

    let list = JSON.parse(localStorage.getItem(key)) || [];
    list = list.filter(i => i.id !== id);
    localStorage.setItem(key, JSON.stringify(list));
    if(key === 'warehouse') renderWarehouse();
    if(key === 'harvests') renderHarvests();
    if(key === 'animals') renderAnimals();
    if(key === 'staff') renderStaff();
    if(key === 'employees') renderEmployees();
    if(key === 'salaries') renderSalaries();
}

initializePasswordReset();
