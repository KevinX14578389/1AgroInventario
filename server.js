/**
 * ================================================
 * SERVICIO WEB DE AUTENTICACIÓN - AgroInventario
 * Evidencia: GA7-220501096-AA5-EV01
 * Diseño y desarrollo de servicios web
 * ================================================
 * 
 * Este servicio web proporciona dos endpoints principales:
 * 1. POST /api/auth/register - Registro de nuevos usuarios
 * 2. POST /api/auth/login - Inicio de sesión
 * 
 * Autor: kevin isaza
 * Fecha: 2026
 */

// ============= IMPORTAR DEPENDENCIAS =============
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

// ============= CONFIGURACIÓN INICIAL =============
const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'agroinventario-local-secret';
const RESET_TOKEN_TTL_MINUTES = 30;
const consoleResetDelivery = process.env.RESET_LINK_DELIVERY === 'console' && process.env.NODE_ENV !== 'production';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const emailTransport = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
    && Number.isInteger(smtpPort) && smtpPort > 0 && smtpPort <= 65535
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD.replace(/\s+/g, '')
        }
    })
    : null;

// Middleware para parsear JSON
app.use(express.json());

// Habilitamos CORS para permitir peticiones desde el frontend
app.use(cors());

// ============= CONFIGURACIÓN DE BASE DE DATOS =============
/**
 * Configuración de conexión a MySQL
 * Variables de entorno: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 */
const dbName = process.env.DB_NAME || 'agroinventario';

const basePool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function inicializarBaseDeDatos() {
    const connection = await basePool.getConnection();

    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await connection.query(`USE \`${dbName}\``);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                contraseña VARCHAR(255) NOT NULL,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token_hash CHAR(64) PRIMARY KEY,
                user_id INT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_password_reset_user (user_id),
                INDEX idx_password_reset_expiration (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS trabajadores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                nombre VARCHAR(150) NOT NULL,
                cedula VARCHAR(50) NOT NULL,
                cargo VARCHAR(100) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS salarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                trabajador_id INT NOT NULL,
                pago_dia DECIMAL(12,2) NOT NULL,
                dias_trabajados INT NOT NULL,
                horas_extras DECIMAL(10,2) NOT NULL DEFAULT 0,
                precio_hora_extra DECIMAL(12,2) NOT NULL DEFAULT 0,
                descuento_salud DECIMAL(12,2) NOT NULL DEFAULT 0,
                descuento_pension DECIMAL(12,2) NOT NULL DEFAULT 0,
                descuento_prestamo DECIMAL(12,2) NOT NULL DEFAULT 0,
                total_pagar DECIMAL(12,2) NOT NULL,
                fecha_registro DATE NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS labores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                cultivo_id INT NOT NULL,
                trabajador_id INT NOT NULL,
                fecha DATE NOT NULL,
                descripcion VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS cultivos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                tipo VARCHAR(100) NOT NULL,
                area DECIMAL(10,2) NOT NULL,
                fecha_siembra DATE NOT NULL,
                fecha_cosecha DATE NOT NULL,
                produccion_esperada DECIMAL(10,2) NOT NULL,
                estado VARCHAR(50) NOT NULL,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS bodega (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                nombre VARCHAR(150) NOT NULL,
                cantidad DECIMAL(10,2) NOT NULL DEFAULT 0,
                unidad VARCHAR(50) NOT NULL,
                stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 0,
                fecha_vencimiento DATE NULL,
                costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS kardex (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                bodega_id INT NOT NULL,
                fecha DATE NOT NULL,
                tipo VARCHAR(30) NOT NULL,
                cantidad DECIMAL(10,2) NOT NULL,
                motivo VARCHAR(255) NOT NULL,
                usuario VARCHAR(150) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS animales (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                tipo VARCHAR(100) NOT NULL,
                cantidad INT NOT NULL,
                edad DECIMAL(10,2) NOT NULL,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS insumos_cultivos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                cultivo_id INT NOT NULL,
                bodega_id INT NOT NULL,
                cantidad DECIMAL(10,2) NOT NULL,
                fecha_aplicacion DATE NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
            await connection.query(`
                CREATE TABLE IF NOT EXISTS cosechas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    usuario_id INT NOT NULL,
                    cultivo_id INT NULL,
                    producto VARCHAR(150) NOT NULL,
                    kilos DECIMAL(10,2) NOT NULL,
                    fecha DATE NOT NULL,
                    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_cosechas_cultivo FOREIGN KEY (cultivo_id) REFERENCES cultivos(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS cosechas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                cultivo_id INT NULL,
                producto VARCHAR(150) NOT NULL,
                kilos DECIMAL(10,2) NOT NULL,
                fecha DATE NOT NULL,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_cosechas_cultivo FOREIGN KEY (cultivo_id) REFERENCES cultivos(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Agrega el propietario a instalaciones existentes sin destruir sus datos.
        const tablasConPropietario = ['trabajadores', 'salarios', 'bodega', 'kardex', 'animales', 'cosechas', 'labores', 'insumos_cultivos'];
        for (const tabla of tablasConPropietario) {
            try {
                await connection.query(`ALTER TABLE \`${tabla}\` ADD COLUMN usuario_id INT NULL`);
            } catch (error) {
                if (error.code !== 'ER_DUP_FIELDNAME') throw error;
            }
            try {
                await connection.query(`CREATE INDEX idx_${tabla}_usuario ON \`${tabla}\` (usuario_id)`);
            } catch (error) {
                if (error.code !== 'ER_DUP_KEYNAME') throw error;
            }
        }

        // No se insertan datos de ejemplo automáticamente.
        // La base de datos queda limpia y solo se usarán los registros que ingrese el usuario.
    } finally {
        connection.release();
    }
}

function crearToken(usuarioId) {
    const payload = Buffer.from(JSON.stringify({ usuarioId, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
    const firma = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    return `${payload}.${firma}`;
}

function verificarToken(token) {
    if (!token) return null;
    const [payload, firma] = token.split('.');
    if (!payload || !firma) return null;
    const firmaEsperada = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    if (firma.length !== firmaEsperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(firmaEsperada))) return null;
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isInteger(datos.usuarioId) && datos.usuarioId > 0 && datos.exp > Date.now() ? datos.usuarioId : null;
}

function requiereAutenticacion(req, res, next) {
    try {
        const autorizacion = req.headers.authorization || '';
        const usuarioId = verificarToken(autorizacion.startsWith('Bearer ') ? autorizacion.slice(7) : null);
        if (!usuarioId) return res.status(401).json({ success: false, message: 'Debes iniciar sesión para acceder a estos datos' });
        req.usuarioId = usuarioId;
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Token de autenticación inválido' });
    }
}

function validarBodegaPayload(articulo) {
    const errores = [];

    if (!articulo || typeof articulo !== 'object') {
        return { valido: false, errores: ['El cuerpo de la solicitud debe ser un objeto JSON'] };
    }

    if (!articulo.nombre || typeof articulo.nombre !== 'string' || articulo.nombre.trim() === '') {
        errores.push('El campo nombre es obligatorio');
    }
    if (articulo.cantidad === undefined || Number.isNaN(Number(articulo.cantidad)) || Number(articulo.cantidad) < 0) {
        errores.push('El campo cantidad debe ser un número mayor o igual a 0');
    }
    if (!articulo.unidad || typeof articulo.unidad !== 'string' || articulo.unidad.trim() === '') {
        errores.push('El campo unidad es obligatorio');
    }
    if (articulo.stock_minimo === undefined || Number.isNaN(Number(articulo.stock_minimo)) || Number(articulo.stock_minimo) < 0) {
        errores.push('El campo stock_minimo debe ser un número mayor o igual a 0');
    }
    if (articulo.costo_unitario === undefined || Number.isNaN(Number(articulo.costo_unitario)) || Number(articulo.costo_unitario) < 0) {
        errores.push('El campo costo_unitario debe ser un número mayor o igual a 0');
    }
    if (articulo.fecha_vencimiento && !/^\d{4}-\d{2}-\d{2}$/.test(articulo.fecha_vencimiento)) {
        errores.push('El campo fecha_vencimiento debe tener formato YYYY-MM-DD');
    }

    return { valido: errores.length === 0, errores };
}

function validarCosechaPayload(cosecha) {
    const errores = [];

    if (!cosecha || typeof cosecha !== 'object') {
        return { valido: false, errores: ['El cuerpo de la solicitud debe ser un objeto JSON'] };
    }
    if (!cosecha.producto || typeof cosecha.producto !== 'string' || cosecha.producto.trim() === '') {
        errores.push('El campo producto es obligatorio');
    }
    if (cosecha.kilos === undefined || Number.isNaN(Number(cosecha.kilos)) || Number(cosecha.kilos) <= 0) {
        errores.push('El campo kilos debe ser un número mayor a 0');
    }
    if (!cosecha.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(cosecha.fecha)) {
        errores.push('El campo fecha debe tener formato YYYY-MM-DD');
    }

    return { valido: errores.length === 0, errores };
}

function validarAnimalPayload(animal) {
    const errores = [];

    if (!animal || typeof animal !== 'object') {
        return { valido: false, errores: ['El cuerpo de la solicitud debe ser un objeto JSON'] };
    }
    if (!animal.tipo || typeof animal.tipo !== 'string' || animal.tipo.trim() === '') {
        errores.push('El campo tipo es obligatorio');
    }
    if (animal.cantidad === undefined || !Number.isInteger(Number(animal.cantidad)) || Number(animal.cantidad) <= 0) {
        errores.push('El campo cantidad debe ser un número entero mayor a 0');
    }
    if (animal.edad === undefined || Number.isNaN(Number(animal.edad)) || Number(animal.edad) < 0) {
        errores.push('El campo edad debe ser un número mayor o igual a 0');
    }

    return { valido: errores.length === 0, errores };
}

function validarInsumoCultivoPayload(insumo) {
    const errores = [];

    if (!insumo || typeof insumo !== 'object') {
        return { valido: false, errores: ['El cuerpo de la solicitud debe ser un objeto JSON'] };
    }
    if (!Number.isInteger(Number(insumo.cultivo_id)) || Number(insumo.cultivo_id) <= 0) {
        errores.push('El cultivo_id debe ser un número entero positivo');
    }
    if (!Number.isInteger(Number(insumo.bodega_id)) || Number(insumo.bodega_id) <= 0) {
        errores.push('El bodega_id debe ser un número entero positivo');
    }
    if (Number.isNaN(Number(insumo.cantidad)) || Number(insumo.cantidad) <= 0) {
        errores.push('La cantidad debe ser un número mayor a 0');
    }
    if (!insumo.fecha_aplicacion || !/^\d{4}-\d{2}-\d{2}$/.test(insumo.fecha_aplicacion)) {
        errores.push('La fecha_aplicacion debe tener formato YYYY-MM-DD');
    }

    return { valido: errores.length === 0, errores };
}

// ============= RUTAS DEL SERVICIO WEB =============

/**
 * Función auxiliar para validar los datos de un cultivo.
 * Retorna un objeto con la validación y mensajes de error.
 */
function validarCultivoPayload(cultivo) {
    const errores = [];

    if (!cultivo || typeof cultivo !== 'object') {
        return {
            valido: false,
            errores: ['El cuerpo de la solicitud debe ser un objeto JSON']
        };
    }

    const { tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado } = cultivo;

    if (!tipo || typeof tipo !== 'string' || tipo.trim() === '') {
        errores.push('El campo tipo es obligatorio');
    }

    if (area === undefined || area === null || Number.isNaN(Number(area)) || Number(area) <= 0) {
        errores.push('El campo area debe ser un número mayor a 0');
    }

    if (!fecha_siembra || typeof fecha_siembra !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_siembra)) {
        errores.push('El campo fecha_siembra debe tener formato YYYY-MM-DD');
    }

    if (!fecha_cosecha || typeof fecha_cosecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_cosecha)) {
        errores.push('El campo fecha_cosecha debe tener formato YYYY-MM-DD');
    }

    if (produccion_esperada === undefined || produccion_esperada === null || Number.isNaN(Number(produccion_esperada)) || Number(produccion_esperada) < 0) {
        errores.push('El campo produccion_esperada debe ser un número válido');
    }

    if (!estado || typeof estado !== 'string' || estado.trim() === '') {
        errores.push('El campo estado es obligatorio');
    }

    return {
        valido: errores.length === 0,
        errores
    };
}

/**
 * ENDPOINT 1: POST /api/auth/register
 * 
 * Descripción: Registra un nuevo usuario en el sistema
 * 
 * Parámetros esperados (JSON):
 * - nombre: string (nombre completo del usuario)
 * - email: string (correo electrónico único)
 * - contraseña: string (contraseña a encriptar)
 * 
 * Respuestas:
 * - 201: Usuario registrado exitosamente
 * - 400: Datos inválidos o usuario ya existe
 * - 500: Error del servidor
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nombre, email, contraseña } = req.body;

        // Validar que todos los campos estén presentes
        if (!nombre || !email || !contraseña) {
            return res.status(400).json({
                success: false,
                message: "Error: Debes proporcionar nombre, email y contraseña"
            });
        }

        // Validar formato del email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Error: El formato del email no es válido"
            });
        }

        // Validar longitud mínima de contraseña
        if (contraseña.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Error: La contraseña debe tener al menos 6 caracteres"
            });
        }

        // Obtener conexión del pool
        const connection = await pool.getConnection();

        try {
            // Verificar si el usuario ya existe
            const [usuarios] = await connection.query(
                'SELECT email FROM usuarios WHERE email = ?',
                [email]
            );

            if (usuarios.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Error: El email ya está registrado"
                });
            }

            // Encriptar la contraseña usando bcryptjs
            const contrasenaEncriptada = await bcrypt.hash(contraseña, 10);

            // Insertar nuevo usuario en la base de datos
            await connection.query(
                'INSERT INTO usuarios (nombre, email, contraseña, fecha_registro) VALUES (?, ?, ?, NOW())',
                [nombre, email, contrasenaEncriptada]
            );

            // Respuesta exitosa
            return res.status(201).json({
                success: true,
                message: "¡Registro exitoso! Ahora puedes iniciar sesión."
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({
            success: false,
            message: "Error del servidor: " + error.message
        });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const email = req.body && typeof req.body.email === 'string' ? req.body.email.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Ingresa un correo electrónico válido.' });
    }

    const frontendUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:5500/index.html');
    const remoteAddress = req.socket.remoteAddress || '';
    const isLoopback = remoteAddress === '127.0.0.1'
        || remoteAddress === '::1'
        || remoteAddress.startsWith('::ffff:127.');
    if (consoleResetDelivery && (!isLoopback || req.get('origin') !== frontendUrl.origin)) {
        return res.status(403).json({
            success: false,
            message: 'La generación de enlaces de prueba solo está disponible desde la aplicación local.'
        });
    }

    if (!emailTransport && !consoleResetDelivery) {
        return res.status(503).json({
            success: false,
            message: 'El envío de correo no está configurado. Configura SMTP en el servidor e inténtalo de nuevo.'
        });
    }

    if (!consoleResetDelivery) {
        try {
            await emailTransport.verify();
        } catch (error) {
            console.error('El servicio de correo no está disponible:', error);
            return res.status(503).json({
                success: false,
                message: 'El servidor no pudo conectarse con Gmail para enviar el enlace. Comprueba la conexión a Internet y la configuración SMTP.'
            });
        }
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [usuarios] = await connection.query(
            'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [email]
        );

        let resetUrl;
        if (usuarios.length > 0) {
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            resetUrl = new URL(frontendUrl);
            resetUrl.searchParams.set('resetToken', token);

            await connection.beginTransaction();
            await connection.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [usuarios[0].id]);
            await connection.query(
                'INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
                [tokenHash, usuarios[0].id, RESET_TOKEN_TTL_MINUTES]
            );
            await connection.commit();

            if (consoleResetDelivery) {
                console.log(`Enlace local de recuperación generado (válido por ${RESET_TOKEN_TTL_MINUTES} minutos).`);
            } else {
                try {
                    await emailTransport.sendMail({
                        from: process.env.MAIL_FROM || process.env.SMTP_USER,
                        to: email,
                        subject: 'Restablece tu contraseña de AgroInventario',
                        text: `Recibimos una solicitud para cambiar tu contraseña. Abre este enlace dentro de ${RESET_TOKEN_TTL_MINUTES} minutos:\n\n${resetUrl.toString()}\n\nSi no solicitaste este cambio, ignora este correo.`,
                        html: `<p>Recibimos una solicitud para cambiar tu contraseña.</p><p><a href="${resetUrl.toString()}">Restablecer contraseña</a></p><p>El enlace vence en ${RESET_TOKEN_TTL_MINUTES} minutos. Si no solicitaste este cambio, ignora este correo.</p>`
                    });
                } catch (error) {
                    await connection.query('DELETE FROM password_reset_tokens WHERE token_hash = ?', [tokenHash]);
                    console.error('No fue posible enviar el correo de recuperación:', error);
                    return res.status(503).json({
                        success: false,
                        message: 'Gmail no aceptó el mensaje. Comprueba la cuenta remitente y su contraseña de aplicación.'
                    });
                }
            }
        }

        return res.json({
            success: true,
            message: consoleResetDelivery
                ? (resetUrl
                    ? 'Enlace de prueba local generado. Vence en 30 minutos y solo puede usarse una vez.'
                    : 'Si el correo está registrado, se generará un enlace de prueba local.')
                : 'Si el correo está registrado y puede recibir mensajes, enviaremos un enlace para restablecer la contraseña.',
            ...(consoleResetDelivery && resetUrl ? { resetUrl: resetUrl.toString() } : {})
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('No fue posible revertir la solicitud de recuperación:', rollbackError);
            }
        }
        console.error('Error al solicitar recuperación de contraseña:', error);
        return res.status(500).json({ success: false, message: 'No fue posible procesar la solicitud. Inténtalo más tarde.' });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { token, contraseña } = body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({ success: false, message: 'El enlace no es válido o ya venció. Solicita uno nuevo.' });
    }
    if (typeof contraseña !== 'string' || contraseña.length < 6 || contraseña.length > 128) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener entre 6 y 128 caracteres.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    let connection;
    let transactionStarted = false;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        const [tokens] = await connection.query(
            'SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > NOW() FOR UPDATE',
            [tokenHash]
        );
        if (tokens.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return res.status(400).json({ success: false, message: 'El enlace no es válido o ya venció. Solicita uno nuevo.' });
        }

        const hashedPassword = await bcrypt.hash(contraseña, 10);
        await connection.query('UPDATE usuarios SET contraseña = ? WHERE id = ?', [hashedPassword, tokens[0].user_id]);
        await connection.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [tokens[0].user_id]);
        await connection.commit();
        transactionStarted = false;

        return res.json({ success: true, message: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' });
    } catch (error) {
        if (transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('No fue posible revertir el cambio de contraseña:', rollbackError);
            }
        }
        console.error('Error al restablecer contraseña:', error);
        return res.status(500).json({ success: false, message: 'No fue posible cambiar la contraseña. Inténtalo más tarde.' });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * ENDPOINT 2: POST /api/auth/login
 * 
 * Descripción: Autentica un usuario con sus credenciales
 * 
 * Parámetros esperados (JSON):
 * - email: string (correo del usuario)
 * - contraseña: string (contraseña sin encriptar)
 * 
 * Respuestas:
 * - 200: Autenticación satisfactoria
 * - 401: Credenciales inválidas
 * - 400: Datos incompletos
 * - 500: Error del servidor
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, contraseña } = req.body;

        // Validar que los campos no estén vacíos
        if (!email || !contraseña) {
            return res.status(400).json({
                success: false,
                message: "Error: Debes proporcionar email y contraseña"
            });
        }

        // Obtener conexión del pool
        const connection = await pool.getConnection();

        try {
            // Buscar el usuario en la base de datos por email
            const [usuarios] = await connection.query(
                'SELECT id, nombre, email, contraseña FROM usuarios WHERE email = ?',
                [email]
            );

            // Si no existe el usuario
            if (usuarios.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: "Error en la autenticación: Email o contraseña incorrectos"
                });
            }

            const usuario = usuarios[0];

            // Comparar la contraseña ingresada con la encriptada en la BD
            const contraseñaValida = await bcrypt.compare(contraseña, usuario.contraseña);

            // Si la contraseña no es válida
            if (!contraseñaValida) {
                return res.status(401).json({
                    success: false,
                    message: "Error en la autenticación: Email o contraseña incorrectos"
                });
            }

            // Autenticación satisfactoria
            return res.status(200).json({
                success: true,
                message: "¡Autenticación satisfactoria!",
                token: crearToken(usuario.id),
                usuario: {
                    id: usuario.id,
                    nombre: usuario.nombre,
                    email: usuario.email
                }
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: "Error del servidor: " + error.message
        });
    }
});

// Todos los módulos de datos requieren una identidad autenticada.
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Servicio web operativo' });
});
app.use('/api', requiereAutenticacion);

/**
 * ENDPOINT 3: GET /api/cultivos
 * 
 * Descripción: Consulta todos los cultivos registrados en el sistema
 * Respuesta: Lista de cultivos
 */
app.get('/api/cultivos', async (req, res) => {
    try {
        const usuarioId = req.usuarioId;
        const connection = await pool.getConnection();

        try {
            const [cultivos] = await connection.query(
                'SELECT id, usuario_id, tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado, fecha_registro FROM cultivos WHERE usuario_id = ? ORDER BY id DESC',
                [usuarioId]
            );

            return res.status(200).json({
                success: true,
                message: 'Cultivos consultados correctamente',
                data: cultivos
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al consultar cultivos:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor: ' + error.message
        });
    }
});

/**
 * ENDPOINT 4: GET /api/cultivos/:id
 * 
 * Descripción: Consulta un cultivo por su identificador
 */
app.get('/api/cultivos/:id', async (req, res) => {
    try {
        const cultivoId = Number(req.params.id);

        if (!Number.isInteger(cultivoId) || cultivoId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'El id del cultivo debe ser un número válido'
            });
        }

        const connection = await pool.getConnection();

        try {
            const [cultivos] = await connection.query(
                'SELECT id, usuario_id, tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado, fecha_registro FROM cultivos WHERE id = ? AND usuario_id = ?',
                [cultivoId, req.usuarioId]
            );

            if (cultivos.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró el cultivo solicitado'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Cultivo encontrado',
                data: cultivos[0]
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al consultar el cultivo:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor: ' + error.message
        });
    }
});

/**
 * ENDPOINT 5: POST /api/cultivos
 * 
 * Descripción: Registra un nuevo cultivo en el sistema
 */
app.post('/api/cultivos', async (req, res) => {
    try {
        const validacion = validarCultivoPayload(req.body);

        if (!validacion.valido) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos',
                errores: validacion.errores
            });
        }

        const { tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado } = req.body;
        const connection = await pool.getConnection();

        try {
            const [resultado] = await connection.query(
                'INSERT INTO cultivos (usuario_id, tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado, fecha_registro) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
                [req.usuarioId, tipo.trim(), Number(area), fecha_siembra, fecha_cosecha, Number(produccion_esperada), estado.trim()]
            );

            return res.status(201).json({
                success: true,
                message: 'Cultivo registrado correctamente',
                data: {
                    id: resultado.insertId,
                    usuario_id: req.usuarioId,
                    tipo: tipo.trim(),
                    area: Number(area),
                    fecha_siembra,
                    fecha_cosecha,
                    produccion_esperada: Number(produccion_esperada),
                    estado: estado.trim()
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al crear cultivo:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor: ' + error.message
        });
    }
});

/**
 * ENDPOINT 6: PUT /api/cultivos/:id
 * 
 * Descripción: Actualiza los datos de un cultivo existente
 */
app.put('/api/cultivos/:id', async (req, res) => {
    try {
        const cultivoId = Number(req.params.id);

        if (!Number.isInteger(cultivoId) || cultivoId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'El id del cultivo debe ser un número válido'
            });
        }

        const validacion = validarCultivoPayload(req.body);
        if (!validacion.valido) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos',
                errores: validacion.errores
            });
        }

        const { tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado } = req.body;
        const connection = await pool.getConnection();

        try {
            const [resultado] = await connection.query(
                'UPDATE cultivos SET tipo = ?, area = ?, fecha_siembra = ?, fecha_cosecha = ?, produccion_esperada = ?, estado = ? WHERE id = ? AND usuario_id = ?',
                [tipo.trim(), Number(area), fecha_siembra, fecha_cosecha, Number(produccion_esperada), estado.trim(), cultivoId, req.usuarioId]
            );

            if (resultado.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró el cultivo para actualizar'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Cultivo actualizado correctamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al actualizar cultivo:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor: ' + error.message
        });
    }
});

/**
 * ENDPOINT 7: DELETE /api/cultivos/:id
 * 
 * Descripción: Elimina un cultivo del sistema por su identificador
 */
app.delete('/api/cultivos/:id', async (req, res) => {
    try {
        const cultivoId = Number(req.params.id);

        if (!Number.isInteger(cultivoId) || cultivoId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'El id del cultivo debe ser un número válido'
            });
        }

        const connection = await pool.getConnection();

        try {
            const [resultado] = await connection.query(
                'DELETE FROM cultivos WHERE id = ? AND usuario_id = ?',
                [cultivoId, req.usuarioId]
            );

            if (resultado.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró el cultivo para eliminar'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Cultivo eliminado correctamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error al eliminar cultivo:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor: ' + error.message
        });
    }
});

// ============= ENDPOINTS DE COSECHAS =============
app.get('/api/cosechas', async (req, res) => {
    try {
        const [cosechas] = await pool.query(`
            SELECT c.id, c.cultivo_id, c.producto, c.kilos, c.fecha,
                   COALESCE(cu.produccion_esperada, 0) AS expectedYield
            FROM cosechas c
            LEFT JOIN cultivos cu ON cu.id = c.cultivo_id AND cu.usuario_id = c.usuario_id
            WHERE c.usuario_id = ?
            ORDER BY c.id DESC
        `, [req.usuarioId]);
        const data = cosechas.map(cosecha => ({
            ...cosecha,
            efficiency: Number(cosecha.expectedYield) > 0
                ? ((Number(cosecha.kilos) / Number(cosecha.expectedYield)) * 100).toFixed(1)
                : 0
        }));
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error al consultar cosechas:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.post('/api/cosechas', async (req, res) => {
    const validacion = validarCosechaPayload(req.body);
    if (!validacion.valido) {
        return res.status(400).json({ success: false, message: validacion.errores.join('. ') });
    }

    try {
        const { producto, kilos, fecha, cultivo_id } = req.body;
        let cultivoId = cultivo_id || null;
        if (!cultivoId) {
            const [cultivos] = await pool.query(
                'SELECT id FROM cultivos WHERE LOWER(tipo) = LOWER(?) AND usuario_id = ? LIMIT 1',
                [producto.trim(), req.usuarioId]
            );
            cultivoId = cultivos[0]?.id || null;
        } else {
            const [cultivos] = await pool.query('SELECT id FROM cultivos WHERE id = ? AND usuario_id = ?', [cultivoId, req.usuarioId]);
            if (cultivos.length === 0) return res.status(404).json({ success: false, message: 'No se encontró el cultivo seleccionado' });
        }
        const [resultado] = await pool.query(
            'INSERT INTO cosechas (usuario_id, cultivo_id, producto, kilos, fecha) VALUES (?, ?, ?, ?, ?)',
            [req.usuarioId, cultivoId, producto.trim(), Number(kilos), fecha]
        );
        const [cosechas] = await pool.query('SELECT * FROM cosechas WHERE id = ? AND usuario_id = ?', [resultado.insertId, req.usuarioId]);
        res.status(201).json({ success: true, data: cosechas[0], message: 'Cosecha registrada correctamente' });
    } catch (error) {
        console.error('Error al registrar cosecha:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.put('/api/cosechas/:id', async (req, res) => {
    const cosechaId = Number(req.params.id);
    if (!Number.isInteger(cosechaId) || cosechaId <= 0) {
        return res.status(400).json({ success: false, message: 'El id de la cosecha no es válido' });
    }

    const validacion = validarCosechaPayload(req.body);
    if (!validacion.valido) {
        return res.status(400).json({ success: false, message: validacion.errores.join('. ') });
    }

    try {
        const { producto, kilos, fecha, cultivo_id } = req.body;
        let cultivoId = cultivo_id || null;
        if (!cultivoId) {
            const [cultivos] = await pool.query(
                'SELECT id FROM cultivos WHERE LOWER(tipo) = LOWER(?) AND usuario_id = ? LIMIT 1',
                [producto.trim(), req.usuarioId]
            );
            cultivoId = cultivos[0]?.id || null;
        } else {
            const [cultivos] = await pool.query('SELECT id FROM cultivos WHERE id = ? AND usuario_id = ?', [cultivoId, req.usuarioId]);
            if (cultivos.length === 0) return res.status(404).json({ success: false, message: 'No se encontró el cultivo seleccionado' });
        }

        const [resultado] = await pool.query(
            'UPDATE cosechas SET cultivo_id = ?, producto = ?, kilos = ?, fecha = ? WHERE id = ? AND usuario_id = ?',
            [cultivoId, producto.trim(), Number(kilos), fecha, cosechaId, req.usuarioId]
        );
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'No se encontró la cosecha para actualizar' });
        }
        const [cosechas] = await pool.query('SELECT * FROM cosechas WHERE id = ? AND usuario_id = ?', [cosechaId, req.usuarioId]);
        res.status(200).json({ success: true, data: cosechas[0], message: 'Cosecha actualizada correctamente' });
    } catch (error) {
        console.error('Error al actualizar cosecha:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.delete('/api/cosechas/:id', async (req, res) => {
    try {
        const [resultado] = await pool.query('DELETE FROM cosechas WHERE id = ? AND usuario_id = ?', [req.params.id, req.usuarioId]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'No se encontró la cosecha para eliminar' });
        }
        res.status(200).json({ success: true, message: 'Cosecha eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar cosecha:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

// ============= ENDPOINTS DE BODEGA =============
app.get('/api/bodega', async (req, res) => {
    try {
        const [articulos] = await pool.query(
            'SELECT id, nombre, cantidad, unidad, stock_minimo, fecha_vencimiento, costo_unitario FROM bodega WHERE usuario_id = ? ORDER BY id DESC',
            [req.usuarioId]
        );
        res.status(200).json({ success: true, data: articulos });
    } catch (error) {
        console.error('Error al consultar bodega:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.post('/api/bodega', async (req, res) => {
    const validacion = validarBodegaPayload(req.body);
    if (!validacion.valido) {
        return res.status(400).json({ success: false, message: validacion.errores.join('. ') });
    }

    try {
        const { nombre, cantidad, unidad, stock_minimo, fecha_vencimiento, costo_unitario, usuario } = req.body;
        const [resultado] = await pool.query(
            `INSERT INTO bodega
                 (usuario_id, nombre, cantidad, unidad, stock_minimo, fecha_vencimiento, costo_unitario)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [req.usuarioId, nombre.trim(), Number(cantidad), unidad.trim(), Number(stock_minimo), fecha_vencimiento || null, Number(costo_unitario)]
        );
        await pool.query(
                'INSERT INTO kardex (usuario_id, bodega_id, fecha, tipo, cantidad, motivo, usuario) VALUES (?, ?, CURDATE(), ?, ?, ?, ?)',
                [req.usuarioId, resultado.insertId, 'Entrada', Number(cantidad), 'Ingreso de inventario', usuario || 'Sistema']
        );
            const [articulos] = await pool.query('SELECT * FROM bodega WHERE id = ? AND usuario_id = ?', [resultado.insertId, req.usuarioId]);
        res.status(201).json({ success: true, data: articulos[0], message: 'Artículo agregado correctamente' });
    } catch (error) {
        console.error('Error al registrar artículo de bodega:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.delete('/api/bodega/:id', async (req, res) => {
    const articuloId = Number(req.params.id);
    if (!Number.isInteger(articuloId) || articuloId <= 0) {
        return res.status(400).json({ success: false, message: 'El id del artículo no es válido' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [articulos] = await connection.query(
            'SELECT id FROM bodega WHERE id = ? AND usuario_id = ? FOR UPDATE',
            [articuloId, req.usuarioId]
        );
        if (articulos.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'No se encontró el artículo para eliminar' });
        }

        await connection.query('DELETE FROM insumos_cultivos WHERE bodega_id = ? AND usuario_id = ?', [articuloId, req.usuarioId]);
        await connection.query('DELETE FROM kardex WHERE bodega_id = ? AND usuario_id = ?', [articuloId, req.usuarioId]);
        const [resultado] = await connection.query(
            'DELETE FROM bodega WHERE id = ? AND usuario_id = ?',
            [articuloId, req.usuarioId]
        );
        if (resultado.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'No se encontró el artículo para eliminar' });
        }

        await connection.commit();
        res.status(200).json({ success: true, message: 'Artículo eliminado correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al eliminar artículo de bodega:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    } finally {
        connection.release();
    }
});

app.get('/api/kardex', async (req, res) => {
    try {
        const [movimientos] = await pool.query(`
            SELECT k.id, k.bodega_id, k.fecha, k.tipo, k.cantidad,
                   CASE
                       WHEN k.motivo REGEXP '^Aplicación en cultivo [0-9]+$'
                       THEN CONCAT('Aplicación en cultivo ', COALESCE(c.tipo, SUBSTRING_INDEX(k.motivo, ' ', -1)))
                       ELSE k.motivo
                   END AS motivo,
                   k.usuario,
                   b.nombre AS articulo
            FROM kardex k
            LEFT JOIN bodega b ON b.id = k.bodega_id AND b.usuario_id = k.usuario_id
            LEFT JOIN cultivos c ON c.id = CAST(SUBSTRING_INDEX(k.motivo, ' ', -1) AS UNSIGNED)
                AND c.usuario_id = k.usuario_id
            WHERE k.usuario_id = ?
            ORDER BY k.id DESC
        `, [req.usuarioId]);
        res.status(200).json({ success: true, data: movimientos });
    } catch (error) {
        console.error('Error al consultar kardex:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

// ============= ENDPOINTS DE ANIMALES =============
app.get('/api/animales', async (req, res) => {
    try {
        const [animales] = await pool.query(
            'SELECT id, tipo, cantidad, edad FROM animales WHERE usuario_id = ? ORDER BY id DESC',
            [req.usuarioId]
        );
        res.status(200).json({ success: true, data: animales });
    } catch (error) {
        console.error('Error al consultar animales:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.post('/api/animales', async (req, res) => {
    const validacion = validarAnimalPayload(req.body);
    if (!validacion.valido) {
        return res.status(400).json({ success: false, message: validacion.errores.join('. ') });
    }

    try {
        const { tipo, cantidad, edad } = req.body;
        const [resultado] = await pool.query(
            'INSERT INTO animales (usuario_id, tipo, cantidad, edad) VALUES (?, ?, ?, ?)',
            [req.usuarioId, tipo.trim(), Number(cantidad), Number(edad)]
        );
        const [animales] = await pool.query('SELECT * FROM animales WHERE id = ? AND usuario_id = ?', [resultado.insertId, req.usuarioId]);
        res.status(201).json({ success: true, data: animales[0], message: 'Animal registrado correctamente' });
    } catch (error) {
        console.error('Error al registrar animal:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.put('/api/animales/:id', async (req, res) => {
    const animalId = Number(req.params.id);
    if (!Number.isInteger(animalId) || animalId <= 0) {
        return res.status(400).json({ success: false, message: 'El id del animal no es válido' });
    }

    const validacion = validarAnimalPayload(req.body);
    if (!validacion.valido) {
        return res.status(400).json({ success: false, message: validacion.errores.join('. ') });
    }

    try {
        const { tipo, cantidad, edad } = req.body;
        const [resultado] = await pool.query(
            'UPDATE animales SET tipo = ?, cantidad = ?, edad = ? WHERE id = ? AND usuario_id = ?',
            [tipo.trim(), Number(cantidad), Number(edad), animalId, req.usuarioId]
        );
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'No se encontró el animal para actualizar' });
        }

        const [animales] = await pool.query(
            'SELECT id, tipo, cantidad, edad FROM animales WHERE id = ? AND usuario_id = ?',
            [animalId, req.usuarioId]
        );
        res.status(200).json({ success: true, data: animales[0], message: 'Animal actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar animal:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.delete('/api/animales/:id', async (req, res) => {
    try {
        const [resultado] = await pool.query('DELETE FROM animales WHERE id = ? AND usuario_id = ?', [req.params.id, req.usuarioId]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'No se encontró el animal para eliminar' });
        }
        res.status(200).json({ success: true, message: 'Animal eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar animal:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

// ============= ENDPOINTS DE TRABAJADORES =============
app.get('/api/trabajadores', async (req, res) => {
    try {
        const [trabajadores] = await pool.query(
            'SELECT id, nombre, cedula, cargo FROM trabajadores WHERE usuario_id = ? ORDER BY id DESC',
            [req.usuarioId]
        );
        res.status(200).json({ success: true, data: trabajadores });
    } catch (error) {
        console.error('Error al consultar trabajadores:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.post('/api/trabajadores', async (req, res) => {
    const { nombre, cedula, cargo } = req.body || {};
    if (!nombre?.trim() || !cedula?.trim() || !cargo?.trim()) {
        return res.status(400).json({ success: false, message: 'Nombre, cédula y cargo son obligatorios' });
    }

    try {
        const [resultado] = await pool.query(
            'INSERT INTO trabajadores (usuario_id, nombre, cedula, cargo) VALUES (?, ?, ?, ?)',
            [req.usuarioId, nombre.trim(), cedula.trim(), cargo.trim()]
        );
        res.status(201).json({
            success: true,
            data: { id: resultado.insertId, nombre: nombre.trim(), cedula: cedula.trim(), cargo: cargo.trim() },
            message: 'Trabajador registrado correctamente'
        });
    } catch (error) {
        console.error('Error al registrar trabajador:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.put('/api/trabajadores/:id', async (req, res) => {
    const trabajadorId = Number(req.params.id);
    const { nombre, cedula, cargo } = req.body || {};

    if (!Number.isInteger(trabajadorId) || trabajadorId <= 0) {
        return res.status(400).json({ success: false, message: 'El id del trabajador no es válido' });
    }
    if (!nombre?.trim() || !cedula?.trim() || !cargo?.trim()) {
        return res.status(400).json({ success: false, message: 'Nombre, cédula y cargo son obligatorios' });
    }

    try {
        const [resultado] = await pool.query(
            'UPDATE trabajadores SET nombre = ?, cedula = ?, cargo = ? WHERE id = ? AND usuario_id = ?',
            [nombre.trim(), cedula.trim(), cargo.trim(), trabajadorId, req.usuarioId]
        );
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'No se encontró el trabajador' });
        }
        res.status(200).json({
            success: true,
            data: { id: trabajadorId, nombre: nombre.trim(), cedula: cedula.trim(), cargo: cargo.trim() },
            message: 'Trabajador actualizado correctamente'
        });
    } catch (error) {
        console.error('Error al actualizar trabajador:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.delete('/api/trabajadores/:id', async (req, res) => {
    const trabajadorId = Number(req.params.id);
    if (!Number.isInteger(trabajadorId) || trabajadorId <= 0) {
        return res.status(400).json({ success: false, message: 'El id del trabajador no es válido' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [trabajadores] = await connection.query(
            'SELECT id FROM trabajadores WHERE id = ? AND usuario_id = ? FOR UPDATE',
            [trabajadorId, req.usuarioId]
        );
        if (trabajadores.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'No se encontró el trabajador para eliminar' });
        }

        await connection.query('DELETE FROM salarios WHERE trabajador_id = ? AND usuario_id = ?', [trabajadorId, req.usuarioId]);
        await connection.query('DELETE FROM labores WHERE trabajador_id = ? AND usuario_id = ?', [trabajadorId, req.usuarioId]);
        const [resultado] = await connection.query(
            'DELETE FROM trabajadores WHERE id = ? AND usuario_id = ?',
            [trabajadorId, req.usuarioId]
        );
        if (resultado.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'No se encontró el trabajador para eliminar' });
        }

        await connection.commit();
        res.status(200).json({ success: true, message: 'Trabajador eliminado correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al eliminar trabajador:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    } finally {
        connection.release();
    }
});

// ============= ENDPOINTS DE SALARIOS =============
app.get('/api/salarios', async (req, res) => {
    try {
        const [salarios] = await pool.query(`
            SELECT s.id, s.trabajador_id, t.nombre, t.cargo, s.pago_dia,
                   s.dias_trabajados, s.horas_extras, s.precio_hora_extra,
                   s.descuento_salud, s.descuento_pension, s.descuento_prestamo,
                   s.total_pagar, s.fecha_registro
            FROM salarios s
            INNER JOIN trabajadores t ON t.id = s.trabajador_id AND t.usuario_id = s.usuario_id
            WHERE s.usuario_id = ?
            ORDER BY s.id DESC
        `, [req.usuarioId]);
        res.status(200).json({ success: true, data: salarios });
    } catch (error) {
        console.error('Error al consultar salarios:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.post('/api/salarios', async (req, res) => {
    const {
        trabajador_id, pago_dia, dias_trabajados, horas_extras = 0,
        precio_hora_extra = 0, descuento_salud = 0, descuento_pension = 0,
        descuento_prestamo = 0
    } = req.body || {};
    const values = [pago_dia, dias_trabajados, horas_extras, precio_hora_extra, descuento_salud, descuento_pension, descuento_prestamo];
    if (!Number.isInteger(Number(trabajador_id)) || Number(trabajador_id) <= 0 || values.some(value => Number.isNaN(Number(value)) || Number(value) < 0) || Number(dias_trabajados) <= 0 || Number(pago_dia) <= 0) {
        return res.status(400).json({ success: false, message: 'Los datos del salario no son válidos' });
    }

    try {
        const [trabajadores] = await pool.query('SELECT id FROM trabajadores WHERE id = ? AND usuario_id = ?', [Number(trabajador_id), req.usuarioId]);
        if (trabajadores.length === 0) return res.status(404).json({ success: false, message: 'No se encontró el trabajador' });
        const totalPagar = Math.max(0, Number(dias_trabajados) * Number(pago_dia) + Number(horas_extras) * Number(precio_hora_extra) - Number(descuento_salud) - Number(descuento_pension) - Number(descuento_prestamo));
        const [resultado] = await pool.query(`
            INSERT INTO salarios (usuario_id, trabajador_id, pago_dia, dias_trabajados, horas_extras, precio_hora_extra, descuento_salud, descuento_pension, descuento_prestamo, total_pagar, fecha_registro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())
        `, [req.usuarioId, Number(trabajador_id), Number(pago_dia), Number(dias_trabajados), Number(horas_extras), Number(precio_hora_extra), Number(descuento_salud), Number(descuento_pension), Number(descuento_prestamo), totalPagar]);
        res.status(201).json({ success: true, data: { id: resultado.insertId, total_pagar: totalPagar }, message: 'Salario guardado correctamente' });
    } catch (error) {
        console.error('Error al guardar salario:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.delete('/api/salarios/:id', async (req, res) => {
    try {
        const [resultado] = await pool.query('DELETE FROM salarios WHERE id = ? AND usuario_id = ?', [req.params.id, req.usuarioId]);
        if (resultado.affectedRows === 0) return res.status(404).json({ success: false, message: 'No se encontró el salario' });
        res.status(200).json({ success: true, message: 'Salario eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar salario:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

// ============= ENDPOINTS DE LABORES =============
app.get('/api/labores', async (req, res) => {
    try {
        const cultivoId = req.query.cultivo_id ? Number(req.query.cultivo_id) : null;
        let query = `
            SELECT l.id, l.cultivo_id, l.trabajador_id, l.fecha, l.descripcion,
                   t.nombre AS trabajador
            FROM labores l
            INNER JOIN trabajadores t ON t.id = l.trabajador_id AND t.usuario_id = l.usuario_id
            WHERE l.usuario_id = ?`;
        const params = [req.usuarioId];
        if (cultivoId !== null) {
            if (!Number.isInteger(cultivoId) || cultivoId <= 0) return res.status(400).json({ success: false, message: 'El cultivo_id no es válido' });
            query += ' AND l.cultivo_id = ?';
            params.push(cultivoId);
        }
        query += ' ORDER BY l.id DESC';
        const [labores] = await pool.query(query, params);
        res.status(200).json({ success: true, data: labores });
    } catch (error) {
        console.error('Error al consultar labores:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.post('/api/labores', async (req, res) => {
    const { cultivo_id, trabajador_id, fecha, descripcion } = req.body || {};
    if (!Number.isInteger(Number(cultivo_id)) || Number(cultivo_id) <= 0 || !Number.isInteger(Number(trabajador_id)) || Number(trabajador_id) <= 0 || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !descripcion?.trim()) {
        return res.status(400).json({ success: false, message: 'Cultivo, trabajador, fecha y descripción son obligatorios' });
    }
    try {
        const [relaciones] = await pool.query(`
            SELECT c.id AS cultivo_id, t.id AS trabajador_id
            FROM cultivos c
            INNER JOIN trabajadores t ON t.usuario_id = c.usuario_id
            WHERE c.id = ? AND c.usuario_id = ? AND t.id = ?
        `, [Number(cultivo_id), req.usuarioId, Number(trabajador_id)]);
        if (relaciones.length === 0) return res.status(404).json({ success: false, message: 'El cultivo o trabajador no pertenece a tu cuenta' });
        const [resultado] = await pool.query(
            'INSERT INTO labores (usuario_id, cultivo_id, trabajador_id, fecha, descripcion) VALUES (?, ?, ?, ?, ?)',
            [req.usuarioId, Number(cultivo_id), Number(trabajador_id), fecha, descripcion.trim()]
        );
        res.status(201).json({ success: true, data: { id: resultado.insertId }, message: 'Labor registrada correctamente' });
    } catch (error) {
        console.error('Error al registrar labor:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.delete('/api/labores/:id', async (req, res) => {
    try {
        const [resultado] = await pool.query('DELETE FROM labores WHERE id = ? AND usuario_id = ?', [req.params.id, req.usuarioId]);
        if (resultado.affectedRows === 0) return res.status(404).json({ success: false, message: 'No se encontró la labor' });
        res.status(200).json({ success: true, message: 'Labor eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar labor:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

// ============= ENDPOINTS DE INSUMOS APLICADOS =============
app.get('/api/insumos-cultivos', async (req, res) => {
    try {
        const cultivoId = req.query.cultivo_id ? Number(req.query.cultivo_id) : null;
        let query = `
            SELECT ic.id, ic.cultivo_id, ic.bodega_id, ic.cantidad, ic.fecha_aplicacion,
                   b.nombre AS insumo, b.unidad
            FROM insumos_cultivos ic
            INNER JOIN bodega b ON b.id = ic.bodega_id AND b.usuario_id = ic.usuario_id
            WHERE ic.usuario_id = ?`;
        const params = [req.usuarioId];

        if (cultivoId !== null) {
            if (!Number.isInteger(cultivoId) || cultivoId <= 0) {
                return res.status(400).json({ success: false, message: 'El cultivo_id no es válido' });
            }
            query += ' AND ic.cultivo_id = ?';
            params.push(cultivoId);
        }
        query += ' ORDER BY ic.id DESC';

        const [insumos] = await pool.query(query, params);
        res.status(200).json({ success: true, data: insumos });
    } catch (error) {
        console.error('Error al consultar insumos aplicados:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    }
});

app.post('/api/insumos-cultivos', async (req, res) => {
    const validacion = validarInsumoCultivoPayload(req.body);
    if (!validacion.valido) {
        return res.status(400).json({ success: false, message: validacion.errores.join('. ') });
    }

    const { cultivo_id, bodega_id, cantidad, fecha_aplicacion } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [cultivos] = await connection.query('SELECT id, tipo FROM cultivos WHERE id = ? AND usuario_id = ?', [Number(cultivo_id), req.usuarioId]);
        if (cultivos.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'No se encontró el cultivo seleccionado' });
        }

        const [articulos] = await connection.query(
            'SELECT id, nombre, cantidad, unidad FROM bodega WHERE id = ? AND usuario_id = ? FOR UPDATE',
            [Number(bodega_id), req.usuarioId]
        );
        if (articulos.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'No se encontró el insumo seleccionado' });
        }
        if (Number(articulos[0].cantidad) < Number(cantidad)) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Stock insuficiente' });
        }

        const [resultado] = await connection.query(
            'INSERT INTO insumos_cultivos (usuario_id, cultivo_id, bodega_id, cantidad, fecha_aplicacion) VALUES (?, ?, ?, ?, ?)',
            [req.usuarioId, Number(cultivo_id), Number(bodega_id), Number(cantidad), fecha_aplicacion]
        );
        await connection.query('UPDATE bodega SET cantidad = cantidad - ? WHERE id = ? AND usuario_id = ?', [Number(cantidad), Number(bodega_id), req.usuarioId]);
        await connection.query(
            'INSERT INTO kardex (usuario_id, bodega_id, fecha, tipo, cantidad, motivo, usuario) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.usuarioId, Number(bodega_id), fecha_aplicacion, 'Salida', Number(cantidad), `Aplicación en cultivo ${cultivos[0].tipo}`, req.body.usuario || 'Sistema']
        );
        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Insumo aplicado correctamente',
            data: { id: resultado.insertId, cultivo_id: Number(cultivo_id), bodega_id: Number(bodega_id), cantidad: Number(cantidad), fecha_aplicacion }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al aplicar insumo:', error);
        res.status(500).json({ success: false, message: 'Error del servidor: ' + error.message });
    } finally {
        connection.release();
    }
});

// ============= MANEJO DE RUTAS NO ENCONTRADAS =============
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Ruta no encontrada"
    });
});

// ============= INICIAR SERVIDOR =============
async function iniciarServidor() {
    try {
        await inicializarBaseDeDatos();

        app.listen(PORT, () => {
            console.log(`
            ╔═══════════════════════════════════════════════════╗
            ║   SERVICIO WEB DE AUTENTICACIÓN - AgroInventario  ║
            ║   Servidor escuchando en: http://localhost:${PORT}  ║
            ║   Endpoints disponibles:                          ║
            ║   - POST /api/auth/register (Registro)            ║
            ║   - POST /api/auth/login (Inicio sesión)          ║
            ║   - GET /api/cultivos (Consultar cultivos)       ║
            ║   - POST /api/cultivos (Crear cultivos)          ║
            ║   - GET/POST /api/bodega (Inventario)             ║
            ║   - DELETE /api/bodega/:id (Eliminar artículo)   ║
            ║   - GET/POST /api/animales (Registro)             ║
            ║   - DELETE /api/animales/:id (Eliminar animal)   ║
            ║   - GET/POST /api/insumos-cultivos                ║
            ║   - GET /api/kardex (Historial de movimientos)   ║
            ║   - GET/POST /api/trabajadores (Personal)        ║
            ║   - DELETE /api/trabajadores/:id                 ║
            ║   - GET /api/health (Estado del servicio)         ║
            ╚═══════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('No fue posible inicializar la base de datos:', error);
        process.exit(1);
    }
}

iniciarServidor();

// Manejar errores no capturados
process.on('unhandledRejection', (error) => {
    console.error('Error no manejado:', error);
});
