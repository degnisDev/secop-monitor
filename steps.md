# Guía Paso a Paso: Construcción del Monitor SECOP II

Este documento registra TODO lo que hemos hecho, comandos, credenciales y decisiones.
Si dejas el proyecto meses sin tocarlo, lee esto y estarás al día en 5 minutos.

> ⚠️ Este archivo está en `.gitignore` y NO se sube a GitHub (contiene referencias a credenciales).

---

## 1. Limpieza y Configuración Inicial

Probamos la viabilidad de la API de Socrata (SECOP II) con scripts sueltos de JavaScript (`fetch` a `/resource/`).
Tras validar que funcionaba, los eliminamos (excepto `test-secop-filtros.js` como referencia de estudio).

**Archivo `.gitignore` (creado manualmente, luego Next.js lo extendió):**
```text
guia.md
steps.md
test-secop-filtros.js
```

---

## 2. Inicialización de Next.js

La carpeta del proyecto debe llamarse en minúsculas y sin espacios (`secop2`), porque `package.json` no acepta mayúsculas ni caracteres especiales.

**Comando ejecutado:**
```bash
npx create-next-app@latest ./
```

**Configuración seleccionada:**
| Opción | Valor | Motivo |
|--------|-------|--------|
| TypeScript | No | JavaScript puro, más sencillo para aprender |
| ESLint | None | No requerido para el MVP |
| Tailwind CSS | Yes | Estándar de estilos, útil para la UI posterior |
| src/ directory | No | Estructura moderna en la raíz |
| App Router | Yes | Sistema de rutas más moderno de Next.js |
| React Compiler | No | Herramienta experimental, no requerida |
| AGENTS.md | No | Archivo de contexto IA, no requerido |

**Comando para levantar el servidor en desarrollo:**
```bash
npm run dev
```
Luego visitar: `http://localhost:3000`

---

## 3. Base de Datos (Supabase)

Usamos **Supabase** (PostgreSQL en la nube, gratis) para guardar qué licitaciones ya fueron notificadas y evitar duplicados.

### 3.1 Crear proyecto en Supabase
1. Ir a [supabase.com](https://supabase.com/) → Login → **New Project**
2. Nombre: `monitor-secop` (o el que quieras)
3. Elegir región cercana (East US)

### 3.2 Obtener credenciales
- Ir a **Project Settings** → **API**
- Copiar:
  - **Project URL** → Va en `NEXT_PUBLIC_SUPABASE_URL`
  - **Publishable key** (la que empieza con `sb_publishable_...`) → Va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3.3 Crear la tabla
En **SQL Editor** de Supabase, ejecutar:
```sql
CREATE TABLE licitaciones_notificadas (
  secop_id TEXT PRIMARY KEY,
  fecha_notificacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
Cuando pregunte sobre RLS, seleccionar **"Run without RLS"**.

### 3.4 Instalar librería de Supabase en el proyecto
```bash
npm install @supabase/supabase-js
```

---

## 4. Ruta API - El Corazón del Proyecto

Archivo creado: `app/api/monitor/route.js`

Este archivo es el "cerebro" del bot. Cuando alguien (o el Cron) visita `http://localhost:3000/api/monitor`, sucede lo siguiente:

1. **Consulta Socrata** → Busca licitaciones recientes con palabras clave (evento, logística, tarima, carpa)
2. **Consulta Supabase** → Verifica si cada licitación ya fue notificada
3. **Guarda en Supabase** → Las nuevas se registran inmediatamente para evitar duplicados
4. **(Pendiente)** → Enviar WhatsApp por cada licitación nueva via Twilio

**Para probar:** Visitar `http://localhost:3000/api/monitor` con el servidor corriendo.
- Primera vez: Devuelve las licitaciones nuevas y las guarda en BD.
- Segunda vez (F5): Devuelve `totalNuevas: 0` porque ya están en BD. ¡Antiduplicados funcionando!

---

## 5. Notificaciones WhatsApp (Twilio) — EN PROGRESO

### 5.1 Cuenta de Twilio
1. Crear cuenta gratis en [twilio.com](https://www.twilio.com/) (te dan $15.50 USD de crédito, NO hay que pagar nada)
2. Buscar **"WhatsApp Sandbox"** en el panel
3. Enviar el mensaje "join palabra-clave" desde tu celular al número de Twilio
4. Puedes conectar hasta 10 números al Sandbox

### 5.2 Credenciales de Twilio
- **Account SID** → Dashboard principal (empieza con `AC`)
- **Auth Token** → Al lado del SID, clic en "Show"
- **WhatsApp From** → El número del Sandbox de Twilio

---

## Credenciales del Proyecto (archivo `.env.local`)

El archivo `.env.local` vive en la raíz del proyecto (al lado de `package.json`) y **NUNCA se sube a GitHub** (ya está en `.gitignore`).

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xnnovfszwmtfatnssttv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=(tu publishable key de Supabase)

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=+1XXXXXXXXXX
WHATSAPP_TO=+573XXXXXXXXX,+573XXXXXXXXX
```

> Si tienes múltiples números de WhatsApp destino, van separados por coma en `WHATSAPP_TO`.

---

## Próximos Pasos (Pendientes)
6. Escribir el código de envío de WhatsApp con Twilio en `route.js`
7. Automatizar la ejecución con GitHub Actions (Cron cada 1 hora)
8. Deploy a Vercel
9. Dashboard web (Fase 2)
