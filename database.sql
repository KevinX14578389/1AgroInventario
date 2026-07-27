/**
 * ================================================
 * BASE DE DATOS - AGROINVENTARIO
 *
 * ================================================
 * 
 * Este archivo contiene el esquema de la base de datos
 * para el servicio web de autenticación
 */

-- Crear la base de datos (si no existe)
CREATE DATABASE IF NOT EXISTS agroinventario;

-- Seleccionar la base de datos
USE agroinventario;

-- Eliminar tablas si existen (para actualizaciones)
DROP TABLE IF EXISTS cultivos;
DROP TABLE IF EXISTS usuarios;

/**
 * Tabla: usuarios
 * Descripción: Almacena los datos de registro e inicio de sesión de los usuarios
 * 
 * Campos:
 * - id: Identificador único del usuario (PRIMARY KEY)
 * - nombre: Nombre completo del usuario
 * - email: Correo electrónico único del usuario
 * - contraseña: Contraseña encriptada (bcryptjs)
 * - fecha_registro: Fecha y hora del registro del usuario
 */
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    contraseña VARCHAR(255) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/**
 * Tabla: cultivos
 * Descripción: Gestiona los cultivos registrados por el sistema
 * 
 * Campos:
 * - id: Identificador único del cultivo
 * - nombre: Nombre del cultivo
 * - tipo: Tipo o clasificación del cultivo
 * - area: Área sembrada en hectáreas
 * - fecha_siembra: Fecha de siembra
 * - estado: Estado actual del cultivo
 * - fecha_registro: Fecha y hora del registro
 */
CREATE TABLE cultivos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    area DECIMAL(10,2) NOT NULL,
    fecha_siembra DATE NOT NULL,
    fecha_cosecha DATE NOT NULL,
    produccion_esperada DECIMAL(10,2) NOT NULL,
    estado VARCHAR(50) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear índices para búsquedas más rápidas
CREATE INDEX idx_email ON usuarios(email);
CREATE INDEX idx_cultivos_estado ON cultivos(estado);

-- No se insertan datos de prueba automáticamente.
-- Esta base de datos queda limpia y solo almacenará los cultivos que el usuario registre.
