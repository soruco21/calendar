# Documentación Técnica Detallada - Agenda de Citas Dermatológicas

Este documento proporciona una especificación técnica detallada y exhaustiva del funcionamiento interno del sistema de **Agenda de Citas Dermatológicas**. Está diseñado para servir como manual técnico de referencia para desarrolladores, administradores de sistemas y auditorías de código.

---

## 📌 Guía para Convertir este Documento a PDF
Este documento ha sido escrito en formato **Markdown Extendido** de alta calidad. Para guardarlo o imprimirlo como un **PDF profesional**:
1. **Opción Recomendada (Navegador):** Abre este archivo `DOCUMENTACION.md` en cualquier visor de Markdown o editor (como VS Code, GitHub o un convertidor en línea de Markdown a HTML/PDF). Si estás en VS Code, usa la extensión **"Markdown PDF"** o abre la vista previa de Markdown, haz clic derecho y selecciona *Imprimir* -> *Guardar como PDF*.
2. **Opción de Comando (Pandoc):** Si tienes `pandoc` y `wkhtmltopdf` instalados, puedes ejecutar:
   ```bash
   pandoc DOCUMENTACION.md -o Documentacion_Agenda_Dermatologica.pdf --pdf-engine=wkhtmltopdf
   ```

---

## 📖 Índice General

1. **Visión General del Sistema y Arquitectura**
   - 1.1 Modelo Híbrido (Localhost + Producción en Cloudflare)
   - 1.2 Capa de Almacenamiento (KV de Cloudflare vs. LocalStorage)
2. **Diagrama de Flujo de Datos y Sincronización**
3. **Modelos de Datos y Tipado de TypeScript (`src/types.ts`)**
4. **Capa de Abstracción de Datos y API Client (`src/store.ts`)**
5. **Capa de Servidor (Doble Entorno)**
   - 5.1 Servidor de Desarrollo Express (`server.ts`)
   - 5.2 Serverless Worker de Producción (`src/worker.ts`)
6. **Interfaces de Usuario y Componentes React**
   - 6.1 Componente Calendario Interactivo (`src/components/Calendar.tsx`)
   - 6.2 Interfaz de Pacientes (`src/components/ClientInterface.tsx`)
   - 6.3 Interfaz del Administrador (`src/components/AdminInterface.tsx`)
7. **Configuración de Wrangler e Infraestructura (`wrangler.toml`)**
8. **Instrucciones de Despliegue y Pruebas en Cloudflare**

---

## 1. Visión General del Sistema y Arquitectura

El sistema es una **Aplicación de Página Única (SPA)** construida con **React (v19)**, **Vite (v6)**, y estilizada con **Tailwind CSS**. La arquitectura de backend está diseñada bajo un modelo de **Backend para Frontend (BFF)** con soporte dual para dos entornos de ejecución:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CAPA DE CLIENTE (React SPA)                    │
│   ┌────────────────────┐   ┌────────────────────────┐  ┌────────────┐   │
│   │ ClientInterface    │   │ AdminInterface         │  │ Calendar   │   │
│   └─────────┬──────────┘   └───────────┬────────────┘  └─────▲──────┘   │
│             │                          │                     │          │
│             └─────────────────┬────────┘                     │          │
│                               ▼                              │          │
│                    API Client (store.ts) ────────────────────┘          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CAPA DE BACKEND & PERSISTENCIA                     │
│                                                                         │
│  [Entorno de Desarrollo]                    [Entorno Cloudflare Pages]  │
│      Servidor Express (server.ts)                 Cloudflare Worker     │
│             │                                     (src/worker.ts)       │
│             ▼                                            │              │
│      Archivos JSON locales                               ▼              │
│   (appointments_db.json /                        KV Namespace de CF     │
│    blocked_slots_db.json)                          (DERM_STORE)         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Modelo Híbrido de Ejecución
Para permitir que la aplicación se desarrolle y pruebe localmente sin depender obligatoriamente de la red de Cloudflare en cada cambio, y que al mismo tiempo se compile perfectamente para el entorno Serverless de Cloudflare Pages, implementamos una estrategia de **Doble Driver**:
* **Desarrollo Local:** Ejecuta un servidor **Express** que almacena las citas y bloqueos en archivos locales JSON (`appointments_db.json` y `blocked_slots_db.json`).
* **Producción en Cloudflare:** Se compila un **Cloudflare Worker** integrado (`src/worker.ts`) que captura todas las peticiones bajo la ruta `/api/*` y utiliza el almacenamiento distribuido global **Cloudflare KV Namespace** bajo la variable vinculada `DERM_STORE`.

### 1.2 Capa de Resiliencia de Almacenamiento (KV vs. LocalStorage)
La capa de persistencia tiene un triple mecanismo de seguridad y resiliencia:
1. **Cloudflare KV (`DERM_STORE`):** El repositorio maestro oficial para entornos de producción. Garantiza que cuando un paciente en su celular reserva una cita, la información se guarde instantáneamente en el KV de Cloudflare y esté visible en tiempo real para el administrador en su computadora y para nuevos pacientes.
2. **API Local Express:** Utilizado únicamente en desarrollo para evitar latencias de red y permitir flujos de trabajo sin conexión (offline).
3. **Resguardo de LocalStorage (Fallback):** En caso de un fallo catastrófico de red o problemas de conexión temporal, el archivo `store.ts` captura el error y almacena la información de forma temporal en el `localStorage` del navegador del usuario. Esto previene la pérdida de datos y permite que la aplicación continúe operativa en modo degradado.

---

## 2. Diagrama de Flujo de Datos y Sincronización

A continuación se detalla cómo se gestiona y sincroniza la reserva de una cita y cómo se refleja instantáneamente para el resto de pacientes o para el administrador:

```
[Paciente A (Móvil)]                       [Servidor / Worker KV]               [Paciente B / Admin (Laptop)]
        │                                             │                                       │
        │─── 1. POST /api/appointments ──────────────>│                                       │
        │    (Reserva cita: 2026-07-22 @ 10:00)       │                                       │
        │                                             │                                       │
        │                                             │─── 2. Guarda en KV Namespace ────────>│
        │                                             │    (DERM_STORE["appointments"])       │
        │                                             │                                       │
        │<── 3. Retorna éxito {success: true} ────────│                                       │
        │                                             │                                       │
        │                                             │<── 4. GET /api/appointments ──────────│
        │                                             │    (Refresco periódico/al cargar)     │
        │                                             │                                       │
        │                                             │─── 5. Retorna listado de citas ──────>│
        │                                             │    (Incluye cita del Paciente A)      │
        │                                             │                                       │
        │                                             │                                       │─── 6. Calendario pinta
        │                                             │                                       │    el día 22 con punto
        │                                             │                                       │    azul (Ocupado)
```

1. **Paciente A** selecciona un día y una hora disponible en el calendario interactivo.
2. Presiona "Confirmar Cita", lo cual envía una petición `POST` HTTP a `/api/appointments` con el cuerpo de los datos del paciente (nombre, teléfono, fecha de nacimiento, fecha de la cita, hora).
3. El **Worker de Cloudflare** procesa la petición, lee el valor existente del KV bajo la clave `"appointments"`, deserializa el JSON, añade el nuevo registro, lo serializa de nuevo y lo almacena inmediatamente en el KV `DERM_STORE`.
4. El backend responde con un código de estado `200 OK`.
5. Cuando **Paciente B** o el **Administrador** abren la aplicación en su computadora o celular, el cliente React ejecuta una petición `GET` a `/api/appointments`.
6. El Worker responde con la lista actualizada directamente del KV de Cloudflare. El calendario calcula automáticamente que para el día `2026-07-22` todas las horas están reservadas o que hay citas agendadas, mostrando el indicador visual (punto azul/marca) de que ese día cuenta con reservaciones, impidiendo que se empalmen los horarios.

---

## 3. Modelos de Datos y Tipado de TypeScript (`src/types.ts`)

El sistema cuenta con un tipado estricto para evitar fallos de deserialización y garantizar que todos los módulos compartan el mismo contrato de datos.

```typescript
export interface Appointment {
  id: string;          // Identificador único (normalmente un timestamp o UUID)
  patientName: string; // Nombre completo del paciente
  patientDob: string;  // Fecha de nacimiento del paciente (YYYY-MM-DD)
  patientPhone: string;// Teléfono celular de contacto
  date: string;        // Fecha seleccionada para la cita (YYYY-MM-DD)
  time: string;        // Hora seleccionada para la cita (HH:mm)
}

export interface BlockedSlot {
  date: string;        // Fecha del bloqueo (YYYY-MM-DD)
  time: string | 'ALL';// Hora específica bloqueada o 'ALL' para bloquear el día completo
}

export interface User {
  name: string;        // Nombre del paciente en sesión de navegador
  dob: string;         // Fecha de nacimiento pre-guardada
  phone: string;       // Teléfono pre-guardado
}
```

---

## 4. Capa de Abstracción de Datos y API Client (`src/store.ts`)

Este archivo actúa como el adaptador o SDK de datos interno para el cliente React. Abstrae la comunicación HTTP y gestiona de manera transparente el fallback de almacenamiento local (`localStorage`) en caso de errores de red o desarrollo sin backend.

### Constantes Globales
* `APPOINTMENTS_KEY = 'derm_appointments'`: Clave de localStorage para citas.
* `BLOCKED_SLOTS_KEY = 'derm_blocked_slots'`: Clave de localStorage para bloqueos.
* `TIME_SLOTS`: Array de strings que define el horario laboral permitido del consultorio dermatológico:
  ```typescript
  ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
  ```

### Funciones Principales

#### `getAppointments(): Promise<Appointment[]>`
Realiza una llamada HTTP `GET` a `/api/appointments`.
* Si el servidor responde con éxito (`res.ok`), deserializa y retorna el listado de citas.
* Si hay un error de red o no existe backend, lee del `localStorage` local mediante la función auxiliar `getAppointmentsFromLocalStorage()`.

#### `saveAppointment(appointment: Appointment): Promise<void>`
Envía una cita al backend mediante un método `POST` HTTP a `/api/appointments`.
* Si es exitoso, la cita queda guardada permanentemente en la nube.
* Si falla, guarda la cita de forma local en el `localStorage` del navegador actual, permitiendo que la aplicación del usuario local no falle ("Graceful Degradation").

#### `getBlockedSlots(): Promise<BlockedSlot[]>`
Obtiene el listado de todos los bloqueos de fecha y hora que el administrador ha configurado.
* Envía un `GET` a `/api/blocked-slots`.
* Si falla, recurre a `localStorage` con la clave `derm_blocked_slots`.

#### `saveBlockedSlot(slot: BlockedSlot): Promise<void>`
Envía un nuevo bloqueo al backend (p. ej., bloquear el lunes completo o solo las 10:00 AM).
* Envía un `POST` HTTP a `/api/blocked-slots`.
* Si falla, lo añade al listado del `localStorage` local evitando duplicados con el comparador `some()`.

#### `removeBlockedSlot(date: string, time: string | 'ALL'): Promise<void>`
Elimina un bloqueo previamente establecido por el administrador.
* Envía una petición `DELETE` HTTP a la ruta `/api/blocked-slots` adjuntando los parámetros en la URL (Query Params): `?date=YYYY-MM-DD&time=HH:mm`.
* Si falla, filtra y remueve el bloqueo localmente de `localStorage`.

---

## 5. Capa de Servidor (Doble Entorno)

### 5.1 Servidor de Desarrollo Express (`server.ts`)
Este servidor local corre bajo Node.js utilizando `tsx` para interpretar TypeScript directamente. Sirve tanto para los endpoints de la API como para alojar el servidor de desarrollo de Vite.

* **Endpoints API:**
  * `GET /api/appointments`: Retorna el contenido del archivo `appointments_db.json`.
  * `POST /api/appointments`: Añade un objeto de cita validando que incluya los campos requeridos (`patientName`, `date`, `time`).
  * `GET /api/blocked-slots`: Retorna el archivo `blocked_slots_db.json`.
  * `POST /api/blocked-slots`: Añade un bloqueo al archivo JSON validando que no esté previamente registrado.
  * `DELETE /api/blocked-slots`: Lee los parámetros de búsqueda `date` y `time`, filtra el array de bloqueos y guarda los cambios de nuevo en el archivo.
* **Integración Vite:**
  * En entorno de desarrollo (`process.env.NODE_ENV !== 'production'`), monta el middleware de Vite en el servidor Express a través de la función `createViteServer()`. Esto permite la recarga del navegador en caliente.
  * En entorno de producción local, sirve estáticamente la carpeta `dist/` y redirige todas las rutas desconocidas al `index.html` para soportar el enrutamiento SPA de React.

### 5.2 Serverless Worker de Producción (`src/worker.ts`)
Este es el archivo principal que Cloudflare Pages ejecuta en la infraestructura de computación distribuida ("Edge Computing"). Sustituye por completo al servidor Express tradicional de Node.js, ofreciendo un tiempo de respuesta de milisegundos a nivel mundial.

#### Código Explicado Detalladamente:

```typescript
// Interfaz para declarar los objetos vinculados al entorno de Cloudflare Pages
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface Env {
  DERM_STORE: KVNamespace; // Vinculación directa con el KV del panel de Cloudflare
  ASSETS: {
    fetch: typeof fetch;     // Controlador interno de Cloudflare para servir archivos estáticos (HTML/JS/CSS)
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // 1. Manejo de Solicitudes CORS (Preflight):
    // Permite que navegadores remotos realicen peticiones de forma segura cruzando dominios
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // --- ENRUTADOR DE CITAS ---
    if (pathname === "/api/appointments") {
      // GET: Retorna las citas guardadas
      if (request.method === "GET") {
        const value = await env.DERM_STORE.get("appointments");
        return new Response(value || "[]", {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // POST: Guarda una nueva cita
      if (request.method === "POST") {
        try {
          const appointment: any = await request.json();
          // Validación de integridad de los datos
          if (!appointment || !appointment.patientName || !appointment.date || !appointment.time) {
            return new Response(JSON.stringify({ error: "Datos de la cita inválidos" }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
          }

          // Se leen las citas actuales, se deserializan, se inserta la nueva cita y se guarda
          const existingStr = (await env.DERM_STORE.get("appointments")) || "[]";
          const existing = JSON.parse(existingStr);
          existing.push(appointment);

          await env.DERM_STORE.put("appointments", JSON.stringify(existing));

          return new Response(JSON.stringify({ success: true, appointment }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        }
      }
    }

    // --- ENRUTADOR DE BLOQUEOS DE HORARIO ---
    if (pathname === "/api/blocked-slots") {
      // GET: Retorna los bloqueos configurados
      if (request.method === "GET") {
        const value = await env.DERM_STORE.get("blocked_slots");
        return new Response(value || "[]", {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // POST: Crea un nuevo bloqueo
      if (request.method === "POST") {
        try {
          const slot: any = await request.json();
          if (!slot || !slot.date || !slot.time) {
            return new Response(JSON.stringify({ error: "Datos de bloqueo inválidos" }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
          }

          const existingStr = (await env.DERM_STORE.get("blocked_slots")) || "[]";
          const existing = JSON.parse(existingStr);

          // Verifica duplicados para optimizar espacio en KV
          const alreadyBlocked = existing.some((s: any) => s.date === slot.date && s.time === slot.time);
          if (!alreadyBlocked) {
            existing.push(slot);
            await env.DERM_STORE.put("blocked_slots", JSON.stringify(existing));
          }

          return new Response(JSON.stringify({ success: true, slot }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        }
      }

      // DELETE: Remueve un bloqueo existente
      if (request.method === "DELETE") {
        try {
          const date = url.searchParams.get("date");
          const time = url.searchParams.get("time");

          if (!date || !time) {
            return new Response(JSON.stringify({ error: "Faltan parámetros de fecha o hora" }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
          }

          const existingStr = (await env.DERM_STORE.get("blocked_slots")) || "[]";
          let existing = JSON.parse(existingStr);
          existing = existing.filter((s: any) => !(s.date === date && s.time === time));

          await env.DERM_STORE.put("blocked_slots", JSON.stringify(existing));

          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        }
      }
    }

    // --- ENRUTADOR ESTATICO (Frontend Assets) ---
    // Si la ruta no corresponde a una API de datos, Cloudflare sirve el archivo HTML/JS/CSS compilado.
    try {
      let response = await env.ASSETS.fetch(request);
      // Soporte para React SPA router: Si el recurso no tiene extensión (p.ej. /admin) y da un 404,
      // sirve index.html para que React maneje la ruta en el cliente.
      if (response.status === 404 && !pathname.includes('.')) {
        const indexRequest = new Request(new URL('/index.html', request.url), request);
        response = await env.ASSETS.fetch(indexRequest);
      }
      return response;
    } catch (e: any) {
      return new Response("Not Found", { status: 404 });
    }
  },
};
```

---

## 6. Interfaces de Usuario y Componentes React

### 6.1 Componente Calendario Interactivo (`src/components/Calendar.tsx`)
El calendario utiliza la librería de fechas ligera `date-fns` para renderizar una cuadrícula mensual interactiva y fluida.

* **Detección Visual Dinámica:**
  * Se le pasan dos arrays clave: `blockedDays` (días completamente bloqueados por el administrador) y `bookedDays` (días que cuentan con citas ya reservadas por otros pacientes).
  * Evalúa el estado del día utilizando `format(date, 'yyyy-MM-dd')`.
  * **Indicadores Visuales en Celda (Dot Markers):**
    Añadimos un contenedor flotante en la parte inferior de cada celda del día:
    ```tsx
    {isCurrentMonth && !disabled && (
      <div className="absolute bottom-1 flex gap-0.5 justify-center">
        {isBlocked && (
          <span className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-red-500")} />
        )}
        {isBooked && !isBlocked && (
          <span className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-brand-500")} />
        )}
      </div>
    )}
    ```
    * **Punto Rojo:** Indica que el día está completamente bloqueado por el administrador.
    * **Punto Azul (Marca de la Marca):** Indica que el día ya tiene al menos una cita agendada por algún paciente, permitiendo que el resto de pacientes vean de inmediato el nivel de ocupación antes de seleccionar el día.

### 6.2 Interfaz de Pacientes (`src/components/ClientInterface.tsx`)
Este componente rige el proceso paso a paso de reserva para los pacientes.

1. **Estado Inicial:** El paciente registra su información de perfil (Nombre, Fecha de Nacimiento y Teléfono). Esta información queda persistida localmente para que el paciente no deba volver a escribirla si regresa más tarde.
2. **Selección de Fecha:** Muestra el `Calendar` con los marcadores de reservaciones previas.
3. **Cálculo de Disponibilidad de Horas:**
   Calcula en tiempo real qué horas ya están ocupadas o bloqueadas para el día seleccionado:
   ```typescript
   // Calcula días bloqueados completamente o con todos sus bloques horarios agotados
   const blockedDays = React.useMemo(() => {
     const dates = new Set<string>();
     appointments.forEach(a => dates.add(a.date));
     blockedSlots.forEach(s => dates.add(s.date));

     const result: string[] = [];
     dates.forEach(dateStr => {
       // Caso 1: Administrador bloqueó el día completo
       if (blockedSlots.some(s => s.date === dateStr && s.time === 'ALL')) {
         result.push(dateStr);
         return;
       }
       // Caso 2: Todos los horarios están ocupados o bloqueados de forma individual
       const allSlotsOccupied = TIME_SLOTS.every(time => {
         const isBlocked = blockedSlots.some(s => s.date === dateStr && s.time === time);
         const isBooked = appointments.some(a => a.date === dateStr && a.time === time);
         return isBlocked || isBooked;
       });

       if (allSlotsOccupied) {
         result.push(dateStr);
       }
     });
     return result;
   }, [appointments, blockedSlots]);
   ```
4. **Reserva en Tiempo Real:** Al confirmar la cita, el paciente ve una animación dinámica de éxito (controlada con `motion` de `motion/react`) y sus datos se envían a Cloudflare KV.

### 6.3 Interfaz del Administrador (`src/components/AdminInterface.tsx`)
Accesible mediante el enrutamiento por hash (`#karolt`), es el panel de control exclusivo del dermatólogo.

* **Seguridad Simple por Hash:** Al escribir la URL con el hash `#karolt`, la aplicación renderiza el panel de administración de forma inmediata, detectado reactivamente por un listener de `hashchange` en `App.tsx`.
* **Funciones Clave:**
  * **Agenda Diaria:** Lista cronológica de todas las citas agendadas por día seleccionado.
  * **Listado Completo de Pacientes:** Buscador dinámico de pacientes que permite ver su historial de consultas médicas y detalles de contacto.
  * **Bloqueador de Horarios Integrado:** Permite al administrador seleccionar un día del calendario y bloquear horas específicas (p. ej., "no atiendo a las 12:00 por almuerzo") o bloquear el día completo ("ALL") por vacaciones o congresos.
  * **Sincronización Inmediata:** Cada bloqueo o desbloqueo realiza peticiones directas a `/api/blocked-slots` las cuales actualizan el KV de Cloudflare de inmediato, asegurando que ningún paciente nuevo intente reservar en esos horarios protegidos.

---

## 7. Configuración de Wrangler e Infraestructura (`wrangler.toml`)

Este archivo define la topología de despliegue para **Cloudflare Pages**. Integra las configuraciones necesarias de compatibilidad de API y vincula el KV Namespace oficial del cliente.

```toml
# Archivo de configuración oficial para Cloudflare Pages
name = "calendary4"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist" # Directorio de archivos compilados del Frontend
main = "src/worker.ts"           # Entrada única para las funciones Serverless / API

[assets]
directory = "./dist"             # Asegura que Wrangler sirva la carpeta dist para assets estáticos

[[kv_namespaces]]
binding = "DERM_STORE"           # Nombre de la constante de entorno accesible en src/worker.ts
id = "6a18390febed4949afadd8eedf4c520f" # ID único de tu KV Namespace creado en Cloudflare
```

---

## 8. Instrucciones de Despliegue y Pruebas en Cloudflare

### Paso 1: Inicialización de la base en Cloudflare
Asegúrate de tener instalada la herramienta Wrangler en tu entorno de desarrollo local. Si utilizas la consola del terminal, ejecuta el inicio de sesión:
```bash
npx wrangler login
```

### Paso 2: Crear el KV Namespace Oficial
Crea el repositorio KV que almacenará las citas de tus pacientes de forma permanente ejecutando:
```bash
npx wrangler kv:namespace create DERM_STORE
```
El comando te devolverá una estructura que debes pegar en tu `wrangler.toml`. En tu caso, la configuración ya cuenta con el ID asignado `6a18390febed4949afadd8eedf4c520f`.

### Paso 3: Compilar y Desplegar
Para compilar la aplicación React y subirla junto con el Worker de enrutamiento API a Cloudflare Pages, ejecuta el comando de despliegue:
```bash
npm run build
npx wrangler pages deploy dist --branch=main
```
Esto creará una URL única (como `https://calendary5.ccclaco.workers.dev/` o similar en la red de Cloudflare Pages) donde el sistema estará operativo al 100%, sincronizando los dispositivos celulares y de computadoras a través del KV distribuido.

### Paso 4: ¿Cómo verificar que está guardando la información en tiempo real?
1. Ve al panel de control oficial de **Cloudflare** (https://dash.cloudflare.com/).
2. Haz clic en tu cuenta, y navega a la sección **Workers y Pages** -> **KV**.
3. Busca tu KV Namespace llamado **`DERM_STORE`** (con ID `6a18390febed4949afadd8eedf4c520f`).
4. Haz clic en la pestaña **"Parejas KV"** o **"KV Pairs"**.
5. Realiza una búsqueda vacía o presiona enter.
6. Verás aparecer dos claves maestras creadas automáticamente por la aplicación al agendar citas o bloqueos:
   * **`appointments`**: Al hacer clic en visualizar, verás el array JSON con todas las citas de tus pacientes con sus nombres, teléfonos y fechas.
   * **`blocked_slots`**: Verás la lista de bloques de horario bloqueados por el administrador.
7. Al entrar desde el celular de un paciente y reservar una cita, la clave `appointments` en el panel de Cloudflare se actualizará instantáneamente. Al recargar la aplicación en tu computadora, la cita aparecerá visible sin perder ningún dato.
