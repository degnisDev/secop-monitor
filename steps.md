# Guía Paso a Paso: Construcción del Monitor SECOP II

Este documento registra los pasos y comandos ejecutados para crear el proyecto desde cero. Te servirá como guía de estudio o por si alguna vez necesitas recrearlo.

## 1. Limpieza y Configuración Inicial

Antes de inicializar el proyecto, probamos la viabilidad de la API de Socrata (SECOP II) mediante scripts sueltos de JavaScript (`fetch` a `/resource/`).
Tras validar que funcionaba, creamos un archivo para evitar que esos scripts y guías se suban al repositorio.

**Archivo `.gitignore` (creado manualmente):**
```text
guia.md
test-secop-filtros.js
```

## 2. Inicialización de Next.js

Generamos la base del proyecto utilizando el comando oficial de Next.js.
Nos aseguramos de que el nombre de la carpeta raíz no tuviera espacios ni mayúsculas (`secop2`).

**Comando ejecutado:**
```bash
npx create-next-app@latest ./
```

**Configuración seleccionada en la consola:**
- TypeScript: `No` (Usaremos JavaScript puro para mantenerlo sencillo)
- ESLint: `None` (No necesitamos formateador estricto para el MVP)
- Tailwind CSS: `Yes` (Estándar de estilos, útil para la UI posterior)
- src/ directory: `No` (Usaremos la estructura moderna en la raíz)
- App Router: `Yes` (El sistema de rutas más moderno de Next.js)
- React Compiler: `No` (Herramienta experimental, no requerida)
- AGENTS.md: `No` (Archivo de contexto de IA, no requerido)

*(Al finalizar, Next.js instaló las dependencias en `node_modules` y extendió nuestro `.gitignore` automáticamente).*

## Próximos Pasos (Pendientes)
3. Conectar y configurar base de datos (Supabase).
4. Crear la ruta de API (`app/api/monitor/route.js`).
5. Integrar notificaciones por WhatsApp (Twilio).
6. Automatizar la ejecución (GitHub Actions).
