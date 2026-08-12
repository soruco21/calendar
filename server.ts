import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

const APPOINTMENTS_FILE = path.join(process.cwd(), 'appointments_db.json');
const BLOCKED_SLOTS_FILE = path.join(process.cwd(), 'blocked_slots_db.json');
const SETTINGS_FILE = path.join(process.cwd(), 'settings_db.json');

// Helper to safely read files
function readJSONFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return defaultValue;
}

// Helper to safely write files
function writeJSONFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// API Routes
async function sendTelegramNotification(appointment: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("Notificaciones de Telegram no configuradas (TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID faltantes).");
    return;
  }

  // Formatear fecha: YYYY-MM-DD -> DD/MM/YYYY
  const [year, month, day] = appointment.date.split("-");
  const formattedDate = `${day}/${month}/${year}`;

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

app.get('/api/appointments', (req, res) => {
  const appointments = readJSONFile(APPOINTMENTS_FILE, []);
  res.json(appointments);
});

app.post('/api/appointments', (req, res) => {
  try {
    const appointment = req.body;
    if (!appointment || !appointment.patientName || !appointment.date || !appointment.time) {
      return res.status(400).json({ error: 'Datos de la cita inválidos' });
    }
    
    const appointments = readJSONFile<any[]>(APPOINTMENTS_FILE, []);
    appointments.push(appointment);
    writeJSONFile(APPOINTMENTS_FILE, appointments);
    
    // Enviar notificación sin bloquear la respuesta principal
    sendTelegramNotification(appointment).catch(err => {
      console.error("Error asíncrono en sendTelegramNotification:", err);
    });
    
    res.json({ success: true, appointment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/appointments', (req, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      return res.status(400).json({ error: 'Falta el id de la cita' });
    }
    
    let appointments = readJSONFile<any[]>(APPOINTMENTS_FILE, []);
    appointments = appointments.filter(a => a.id !== id);
    writeJSONFile(APPOINTMENTS_FILE, appointments);
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/blocked-slots', (req, res) => {
  const slots = readJSONFile(BLOCKED_SLOTS_FILE, []);
  res.json(slots);
});

app.post('/api/blocked-slots', (req, res) => {
  try {
    const slot = req.body;
    if (!slot || !slot.date || !slot.time) {
      return res.status(400).json({ error: 'Datos de bloqueo inválidos' });
    }
    
    const slots = readJSONFile<any[]>(BLOCKED_SLOTS_FILE, []);
    const alreadyBlocked = slots.some(s => s.date === slot.date && s.time === slot.time);
    if (!alreadyBlocked) {
      slots.push(slot);
      writeJSONFile(BLOCKED_SLOTS_FILE, slots);
    }
    
    res.json({ success: true, slot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/blocked-slots', (req, res) => {
  try {
    const date = req.query.date as string;
    const time = req.query.time as string;
    
    if (!date || !time) {
      return res.status(400).json({ error: 'Faltan parámetros de fecha o hora' });
    }
    
    let slots = readJSONFile<any[]>(BLOCKED_SLOTS_FILE, []);
    slots = slots.filter(s => !(s.date === date && s.time === time));
    writeJSONFile(BLOCKED_SLOTS_FILE, slots);
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', (req, res) => {
  const settings = readJSONFile(SETTINGS_FILE, { blockedDaysOfWeek: [], blockedHours: [], blockedSaturdayHours: [] });
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  try {
    const settings = req.body;
    if (!settings || !Array.isArray(settings.blockedDaysOfWeek) || !Array.isArray(settings.blockedHours)) {
      return res.status(400).json({ error: 'Datos de configuración inválidos' });
    }
    writeJSONFile(SETTINGS_FILE, settings);
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend / Vite setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
