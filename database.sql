/**
 * ================================================
 * BASE DE DATOS - AGROINVENTARIO
 * Evidencia: GA7-220501096-AA5-EV01
 * ================================================
 * 
 * Este archivo contiene el esquema de la base de datos
 * para el servicio web de autenticación
 */

-- Crear la base de datos (si no existe)
CREATE DATABASE IF NOT EXISTS agroinventario;

-- Seleccionar la base de datos
USE agroinventario;

-- Eliminar tabla si existe (para actualizaciones)
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

-- Crear índice en email para búsquedas más rápidas
CREATE INDEX idx_email ON usuarios(email);

-- Insertar datos de prueba (opcional)
-- Las contraseñas están encriptadas con bcryptjs
INSERT INTO usuarios (nombre, email, contraseña) VALUES 
('Juan Pérez', 'juan@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36jbMFm1');
-- Contraseña de prueba: "password123"
