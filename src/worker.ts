interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface Env {
  DERM_STORE: KVNamespace;
  ASSETS: {
    fetch: typeof fetch;
  };
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

function formatSpanishDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    
    const date = new Date(Date.UTC(year, month, day));
    
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    
    const days = [
      'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'
    ];
    
    const dayName = days[date.getUTCDay()];
    const monthName = months[date.getUTCMonth()];
    
    return `${day} de ${monthName} de ${year} (${dayName})`;
  } catch (e) {
    return dateStr;
  }
}

async function sendTelegramNotification(appointment: any, botToken?: string, chatId?: string) {
  if (!botToken || !chatId) {
    console.log("Notificaciones de Telegram no configuradas (TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID faltantes).");
    return;
  }

  const formattedDate = formatSpanishDate(appointment.date);

  const message = `🩺 *¡Nueva Cita Dermatológica!*

👤 *Paciente:* ${appointment.patientName}
📅 *F. Nacimiento:* ${appointment.patientDob}
📞 *Teléfono:* ${appointment.patientPhone}
📆 *Fecha de Cita:* ${formattedDate}
🕒 *Hora:* ${appointment.time}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      console.error("Error al enviar notificación a Telegram:", await response.text());
    } else {
      console.log("Notificación de Telegram enviada con éxito.");
    }
  } catch (error) {
    console.error("Error al enviar notificación de Telegram:", error);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // API Routes
    if (pathname === "/api/appointments") {
      if (request.method === "GET") {
        const value = await env.DERM_STORE.get("appointments");
        return new Response(value || "[]", {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      if (request.method === "POST") {
        try {
          const appointment: any = await request.json();
          if (!appointment || !appointment.patientName || !appointment.date || !appointment.time) {
            return new Response(JSON.stringify({ error: "Datos de la cita inválidos" }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
          }

          const existingStr = (await env.DERM_STORE.get("appointments")) || "[]";
          const existing = JSON.parse(existingStr);
          existing.push(appointment);

          await env.DERM_STORE.put("appointments", JSON.stringify(existing));

          // Enviar notificación por Telegram de forma asíncrona usando ctx.waitUntil
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(sendTelegramNotification(appointment, env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID));
          } else {
            sendTelegramNotification(appointment, env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID).catch(err => {
              console.error("Error asíncrono en worker sendTelegramNotification:", err);
            });
          }

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

      if (request.method === "DELETE") {
        try {
          const id = url.searchParams.get("id");
          if (!id) {
            return new Response(JSON.stringify({ error: "Falta el id de la cita" }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
          }

          const existingStr = (await env.DERM_STORE.get("appointments")) || "[]";
          let existing = JSON.parse(existingStr);
          existing = existing.filter((a: any) => a.id !== id);

          await env.DERM_STORE.put("appointments", JSON.stringify(existing));

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

    if (pathname === "/api/blocked-slots") {
      if (request.method === "GET") {
        const value = await env.DERM_STORE.get("blocked_slots");
        return new Response(value || "[]", {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

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

    if (pathname === "/api/settings") {
      if (request.method === "GET") {
        const value = await env.DERM_STORE.get("settings");
        return new Response(value || '{"blockedDaysOfWeek":[],"blockedHours":[]}', {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      if (request.method === "POST") {
        try {
          const settings: any = await request.json();
          if (!settings || !Array.isArray(settings.blockedDaysOfWeek) || !Array.isArray(settings.blockedHours)) {
            return new Response(JSON.stringify({ error: "Datos de configuración inválidos" }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
          }

          await env.DERM_STORE.put("settings", JSON.stringify(settings));

          return new Response(JSON.stringify({ success: true, settings }), {
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

    // Default: Fallback to serving static assets
    try {
      let response = await env.ASSETS.fetch(request);
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
