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
DROP TABLE IF EXISTS bodega;
DROP TABLE IF EXISTS cosechas;
DROP TABLE IF EXISTS animales;
DROP TABLE IF EXISTS insumos_cultivos;
DROP TABLE IF EXISTS kardex;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS usuarios;

CREATE TABLE trabajadores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    cedula VARCHAR(50) NOT NULL,
    cargo VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE salarios (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE labores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    cultivo_id INT NOT NULL,
    trabajador_id INT NOT NULL,
    fecha DATE NOT NULL,
    descripcion VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE password_reset_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_reset_user (user_id),
    INDEX idx_password_reset_expiration (expires_at)
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

CREATE TABLE bodega (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    cantidad DECIMAL(10,2) NOT NULL DEFAULT 0,
    unidad VARCHAR(50) NOT NULL,
    stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 0,
    fecha_vencimiento DATE NULL,
    costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE kardex (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    bodega_id INT NOT NULL,
    fecha DATE NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    cantidad DECIMAL(10,2) NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    usuario VARCHAR(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE animales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    cantidad INT NOT NULL,
    edad DECIMAL(10,2) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE insumos_cultivos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    cultivo_id INT NOT NULL,
    bodega_id INT NOT NULL,
    cantidad DECIMAL(10,2) NOT NULL,
    fecha_aplicacion DATE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cosechas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    cultivo_id INT NULL,
    producto VARCHAR(150) NOT NULL,
    kilos DECIMAL(10,2) NOT NULL,
    fecha DATE NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cosechas_cultivo FOREIGN KEY (cultivo_id) REFERENCES cultivos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear índices para búsquedas más rápidas
CREATE INDEX idx_email ON usuarios(email);
CREATE INDEX idx_cultivos_estado ON cultivos(estado);

-- No se insertan datos de prueba automáticamente.
-- Esta base de datos queda limpia y solo almacenará los cultivos que el usuario registre.
