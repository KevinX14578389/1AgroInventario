# Documentación de la API - Módulo Cultivos

## Descripción general
Este servicio expone operaciones REST para gestionar cultivos dentro del proyecto AgroInventario. El módulo permite registrar, consultar, actualizar y eliminar cultivos según las necesidades del software.

## Base URL
http://localhost:3000

## Endpoints disponibles

### 1. Consultar todos los cultivos
- Método: GET
- Ruta: /api/cultivos
- Descripción: Devuelve la lista de cultivos registrados.

Respuesta exitosa:
```json
{
  "success": true,
  "message": "Cultivos consultados correctamente",
  "data": []
}
```

### 2. Consultar un cultivo por ID
- Método: GET
- Ruta: /api/cultivos/:id
- Descripción: Retorna los datos de un cultivo específico.

Ejemplo:
```http
GET http://localhost:3000/api/cultivos/1
```

### 3. Registrar un cultivo
- Método: POST
- Ruta: /api/cultivos
- Descripción: Crea un nuevo cultivo.
- Requiere autenticación: enviar el token en `Authorization: Bearer <token>`.
- El propietario se determina a partir del token; no se debe enviar `usuario_id` en el cuerpo.

Cuerpo esperado:
```json
{
  "tipo": "Cereal",
  "area": 12.5,
  "fecha_siembra": "2026-05-10",
  "fecha_cosecha": "2026-09-10",
  "produccion_esperada": 6500.00,
  "estado": "En crecimiento"
}
```

Respuesta exitosa:
```json
{
  "success": true,
  "message": "Cultivo registrado correctamente",
  "data": {
    "id": 1,
    "nombre": "Maíz",
    "tipo": "Cereal",
    "area": 12.5,
    "fecha_siembra": "2026-05-10",
    "estado": "En crecimiento"
  }
}
```

### 4. Actualizar un cultivo
- Método: PUT
- Ruta: /api/cultivos/:id
- Descripción: Modifica los datos de un cultivo existente.

### 5. Eliminar un cultivo
- Método: DELETE
- Ruta: /api/cultivos/:id
- Descripción: Elimina un cultivo del sistema.

## Características del módulo
- Validación de datos obligatorios.
- Formato de fecha YYYY-MM-DD.
- Respuestas JSON estandarizadas.
- Manejo de errores con mensajes claros.

## Notas de implementación
- Se utiliza MySQL como motor de base de datos.
- El proyecto está versionado con Git.
- El servidor se ejecuta con Node.js y Express.
