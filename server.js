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
require('dotenv').config();

// ============= CONFIGURACIÓN INICIAL =============
const app = express();
const PORT = process.env.PORT || 3000;

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

        // No se insertan datos de ejemplo automáticamente.
        // La base de datos queda limpia y solo se usarán los registros que ingrese el usuario.
    } finally {
        connection.release();
    }
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

    const { usuario_id, tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado } = cultivo;

    if (usuario_id === undefined || usuario_id === null || !Number.isInteger(Number(usuario_id)) || Number(usuario_id) <= 0) {
        errores.push('El campo usuario_id es obligatorio y debe ser un número entero positivo');
    }

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

/**
 * ENDPOINT 3: GET /api/cultivos
 * 
 * Descripción: Consulta todos los cultivos registrados en el sistema
 * Respuesta: Lista de cultivos
 */
app.get('/api/cultivos', async (req, res) => {
    try {
        const usuarioId = req.query.usuario_id ? Number(req.query.usuario_id) : null;
        const connection = await pool.getConnection();

        try {
            let cultivos;

            if (usuarioId !== null) {
                if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'El usuario_id debe ser un número entero positivo'
                    });
                }

                [cultivos] = await connection.query(
                    'SELECT id, usuario_id, tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado, fecha_registro FROM cultivos WHERE usuario_id = ? ORDER BY id DESC',
                    [usuarioId]
                );
            } else {
                [cultivos] = await connection.query(
                    'SELECT id, usuario_id, tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado, fecha_registro FROM cultivos ORDER BY id DESC'
                );
            }

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
                'SELECT id, usuario_id, tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado, fecha_registro FROM cultivos WHERE id = ?',
                [cultivoId]
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

        const { usuario_id, tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado } = req.body;
        const connection = await pool.getConnection();

        try {
            const [resultado] = await connection.query(
                'INSERT INTO cultivos (usuario_id, tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado, fecha_registro) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
                [Number(usuario_id), tipo.trim(), Number(area), fecha_siembra, fecha_cosecha, Number(produccion_esperada), estado.trim()]
            );

            return res.status(201).json({
                success: true,
                message: 'Cultivo registrado correctamente',
                data: {
                    id: resultado.insertId,
                    usuario_id: Number(usuario_id),
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

        const { usuario_id, tipo, area, fecha_siembra, fecha_cosecha, produccion_esperada, estado } = req.body;
        const connection = await pool.getConnection();

        try {
            const [resultado] = await connection.query(
                'UPDATE cultivos SET usuario_id = ?, tipo = ?, area = ?, fecha_siembra = ?, fecha_cosecha = ?, produccion_esperada = ?, estado = ? WHERE id = ?',
                [Number(usuario_id), tipo.trim(), Number(area), fecha_siembra, fecha_cosecha, Number(produccion_esperada), estado.trim(), cultivoId]
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
                'DELETE FROM cultivos WHERE id = ?',
                [cultivoId]
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

/**
 * ENDPOINT 8: GET /api/health
 * 
 * Descripción: Verifica el estado del servicio web
 * Respuesta: Estado de operación
 */
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: "Servicio web operativo"
    });
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
