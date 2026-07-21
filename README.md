# 🌾 AgroInventario - Servicio Web de Autenticación

**Evidencia:** GA7-220501096-AA5-EV01  
**Componente:** Construcción API - Diseño y desarrollo de servicios web  
**Institución:** SENA

---

## 📋 Descripción del Proyecto

Este proyecto implementa un **servicio web completo de autenticación** (registro e inicio de sesión) para la aplicación AgroInventario. El servicio incluye:

✅ **Registro de usuarios** con validación de datos  
✅ **Inicio de sesión** con autenticación segura  
✅ **Contraseñas encriptadas** con bcryptjs  
✅ **API REST** bien documentada  
✅ **Código comentado** en español  
✅ **Base de datos MySQL** integrada  

---

## 🚀 Instalación Rápida

### Paso 1: Instalar Node.js
Descarga e instala Node.js desde: https://nodejs.org/

### Paso 2: Instalar MySQL
Descarga e instala MySQL desde: https://dev.mysql.com/downloads/mysql/

### Paso 3: Configurar la Base de Datos

1. Abre MySQL Workbench o línea de comandos
2. Crea la base de datos ejecutando:
```bash
mysql -u root -p < database.sql
```

3. Si MySQL tiene contraseña, actualiza el archivo `.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=agroinventario
```

### Paso 4: Instalar Dependencias
En la carpeta del proyecto, abre una terminal y ejecuta:
```bash
npm install
```

### Paso 5: Iniciar el Servidor
```bash
npm start
```

Verás un mensaje como:
```
╔═══════════════════════════════════════════════════╗
║   SERVICIO WEB DE AUTENTICACIÓN - AgroInventario  ║
║   Servidor escuchando en: http://localhost:3000   ║
╚═══════════════════════════════════════════════════╝
```

### Paso 6: Abrir en el Navegador
Abre el archivo `index.html` en tu navegador (o usa un servidor local)

---

## 📁 Estructura de Archivos

```
agroinventario/
├── server.js                    # 🔧 Servidor backend (API REST)
├── package.json                 # 📦 Dependencias del proyecto
├── .env                         # ⚙️ Variables de configuración
├── database.sql                 # 🗄️ Esquema de base de datos
├── DOCUMENTACION_API.md         # 📖 Documentación detallada de API
├── README.md                    # 📄 Este archivo
├── index.html                   # 🌐 Interfaz web
├── script.js                    # 💻 Lógica del frontend (actualizado)
├── style.css                    # 🎨 Estilos CSS
├── video/                       # 🎬 Videos
└── node_modules/                # 📚 Dependencias instaladas
```

---

## 🔑 Credenciales de Prueba

Después de ejecutar `database.sql`, puedes probar con:

- **Email:** `juan@example.com`
- **Contraseña:** `password123`

---

## 📡 Endpoints de la API

### 1. Registro de Usuario
```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "contraseña": "MiContraseña123"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "message": "¡Registro exitoso! Ahora puedes iniciar sesión."
}
```

### 2. Inicio de Sesión
```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "juan@example.com",
  "contraseña": "MiContraseña123"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "¡Autenticación satisfactoria!",
  "usuario": {
    "id": 1,
    "nombre": "Juan Pérez",
    "email": "juan@example.com"
  }
}
```

### 3. Verificar Estado
```http
GET http://localhost:3000/api/health
```

---

## 📝 Características del Código

### ✅ Comentarios Extensos
Todo el código está comentado en español explicando:
- Qué hace cada función
- Parámetros esperados
- Tipos de respuesta
- Validaciones

### ✅ Validaciones Completas
- Email válido
- Contraseña mínimo 6 caracteres
- Campos no vacíos
- Email único (no duplicados)

### ✅ Seguridad
- Contraseñas encriptadas con bcryptjs
- CORS habilitado
- Manejo de errores
- Validación de entrada

### ✅ Respuestas JSON Estructuradas
```json
{
  "success": boolean,
  "message": "string",
  "usuario": { /* datos opcionales */ }
}
```

---

## 🛠️ Tecnologías Utilizadas

| Tecnología | Versión | Propósito |
|-----------|---------|----------|
| **Node.js** | 16+ | Runtime de JavaScript |
| **Express.js** | 4.18.2 | Framework web |
| **MySQL** | 8.0+ | Base de datos |
| **bcryptjs** | 2.4.3 | Encriptación de contraseñas |
| **CORS** | 2.8.5 | Control de acceso |
| **dotenv** | 16.0.3 | Variables de entorno |

---

## 📚 Archivos Clave Comentados

### **server.js**
- Configuración del servidor Express
- Rutas de autenticación (register, login)
- Conexión a MySQL
- Validaciones de datos
- Manejo de errores

### **script.js (actualizado)**
- Funciones de registro con conexión al API
- Funciones de login con conexión al API
- Manejo de respuestas del servidor
- Gestión de sesión del usuario

### **database.sql**
- Creación de base de datos
- Tabla `usuarios` con campos:
  - `id` (PRIMARY KEY)
  - `nombre` (VARCHAR)
  - `email` (UNIQUE)
  - `contraseña` (encriptada)
  - `fecha_registro` (TIMESTAMP)

---

## 🧪 Pruebas Manuales

### Usando Postman o Thunder Client

1. **Registrar usuario:**
   - URL: `POST http://localhost:3000/api/auth/register`
   - Body JSON:
   ```json
   {
     "nombre": "Test User",
     "email": "test@example.com",
     "contraseña": "test123456"
   }
   ```

2. **Iniciar sesión:**
   - URL: `POST http://localhost:3000/api/auth/login`
   - Body JSON:
   ```json
   {
     "email": "test@example.com",
     "contraseña": "test123456"
   }
   ```

---

## ❓ Solución de Problemas

### ❌ "Error de conexión: No se pudo conectar al servicio web"
**Solución:** Verifica que el servidor esté corriendo:
```bash
npm start
```

### ❌ "Cannot connect to MySQL database"
**Solución:** 
1. Verifica que MySQL esté corriendo
2. Verifica credenciales en `.env`
3. Verifica que la base de datos fue creada:
```bash
mysql -u root -p -e "SHOW DATABASES;"
```

### ❌ "Port 3000 already in use"
**Solución:** Cambia el puerto en `.env`:
```
PORT=3001
```

---

## 📖 Documentación Completa

Para más detalles sobre los endpoints, validaciones y ejemplos, consulta:  
📄 [DOCUMENTACION_API.md](DOCUMENTACION_API.md)

---

## 💡 Mejoras Futuras (Opcional)

Para un proyecto de producción, considera:

1. **Implementar JWT (JSON Web Tokens)**
   ```bash
   npm install jsonwebtoken
   ```

2. **Agregar recuperación de contraseña**
   - Email verification
   - Reset token

3. **Implementar Rate Limiting**
   - Limitar intentos de login

4. **Logs de seguridad**
   - Registrar intentos fallidos
   - Auditoría de cambios

5. **HTTPS**
   - Certificados SSL/TLS

---

## 📞 Soporte

### Documentación Oficial
- **Express.js:** https://expressjs.com/
- **MySQL:** https://dev.mysql.com/doc/
- **bcryptjs:** https://www.npmjs.com/package/bcryptjs
- **Node.js:** https://nodejs.org/docs/

### Componente Formativo
Revisa el material del componente "Construcción API" en el SENA para conceptos adicionales.

---

## ✅ Checklist de Entrega

- [x] Servicio web de registro funcional
- [x] Servicio web de login funcional
- [x] Validación de datos
- [x] Respuestas JSON apropiadas
- [x] Código comentado en español
- [x] Base de datos MySQL
- [x] Documentación completa
- [x] Integración con frontend
- [x] Manejo de errores
- [x] Contraseñas encriptadas

---

**Evidencia:** GA7-220501096-AA5-EV01  
**Fecha:** Julio 2026  
**Autor:** SENA - Programa de Formación
