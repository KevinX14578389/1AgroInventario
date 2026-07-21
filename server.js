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
 * Autor: SENA
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
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agroinventario',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ============= RUTAS DEL SERVICIO WEB =============

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
 * ENDPOINT 3: GET /api/health
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
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════╗
    ║   SERVICIO WEB DE AUTENTICACIÓN - AgroInventario  ║
    ║   Servidor escuchando en: http://localhost:${PORT}  ║
    ║   Endpoints disponibles:                          ║
    ║   - POST /api/auth/register (Registro)            ║
    ║   - POST /api/auth/login (Inicio sesión)          ║
    ║   - GET /api/health (Estado del servicio)         ║
    ╚═══════════════════════════════════════════════════╝
    `);
});

// Manejar errores no capturados
process.on('unhandledRejection', (error) => {
    console.error('Error no manejado:', error);
});
