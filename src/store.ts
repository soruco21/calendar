import { Appointment, BlockedSlot, SystemSettings } from './types';

const APPOINTMENTS_KEY = 'derm_appointments';
const BLOCKED_SLOTS_KEY = 'derm_blocked_slots';
const SETTINGS_KEY = 'derm_settings';

export const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
];

// Helper functions for localStorage fallback
const getAppointmentsFromLocalStorage = (): Appointment[] => {
  const data = localStorage.getItem(APPOINTMENTS_KEY);
  return data ? JSON.parse(data) : [];
};

const getBlockedSlotsFromLocalStorage = (): BlockedSlot[] => {
  const data = localStorage.getItem(BLOCKED_SLOTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getAppointments = async (): Promise<Appointment[]> => {
  try {
    const res = await fetch('/api/appointments');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Fallback to localStorage on network or CORS errors in development
  }
  return getAppointmentsFromLocalStorage();
};

export const saveAppointment = async (appointment: Appointment): Promise<void> => {
  try {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment),
    });
    if (res.ok) {
      return;
    }
  } catch (e) {
    // Fallback
  }
  const apps = getAppointmentsFromLocalStorage();
  apps.push(appointment);
  localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(apps));
};

export const deleteAppointment = async (id: string): Promise<void> => {
  try {
    const res = await fetch(`/api/appointments?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return;
    }
  } catch (e) {
    // Fallback
  }
  let apps = getAppointmentsFromLocalStorage();
  apps = apps.filter(a => a.id !== id);
  localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(apps));
};

export const getBlockedSlots = async (): Promise<BlockedSlot[]> => {
  try {
    const res = await fetch('/api/blocked-slots');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Fallback
  }
  return getBlockedSlotsFromLocalStorage();
};

export const saveBlockedSlot = async (slot: BlockedSlot): Promise<void> => {
  try {
    const res = await fetch('/api/blocked-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slot),
    });
    if (res.ok) {
      return;
    }
  } catch (e) {
    // Fallback
  }
  const slots = getBlockedSlotsFromLocalStorage();
  if (!slots.some(s => s.date === slot.date && s.time === slot.time)) {
    slots.push(slot);
    localStorage.setItem(BLOCKED_SLOTS_KEY, JSON.stringify(slots));
  }
};

export const removeBlockedSlot = async (date: string, time: string | 'ALL'): Promise<void> => {
  try {
    const res = await fetch(`/api/blocked-slots?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return;
    }
  } catch (e) {
    // Fallback
  }
  let slots = getBlockedSlotsFromLocalStorage();
  slots = slots.filter(s => !(s.date === date && s.time === time));
  localStorage.setItem(BLOCKED_SLOTS_KEY, JSON.stringify(slots));
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const settings = await res.json();
      return {
        blockedDaysOfWeek: settings.blockedDaysOfWeek || [],
        blockedHours: settings.blockedHours || [],
        blockedSaturdayHours: settings.blockedSaturdayHours || [],
      };
    }
  } catch (e) {
    // Fallback
  }
  const data = localStorage.getItem(SETTINGS_KEY);
  if (data) {
    const settings = JSON.parse(data);
    return {
      blockedDaysOfWeek: settings.blockedDaysOfWeek || [],
      blockedHours: settings.blockedHours || [],
      blockedSaturdayHours: settings.blockedSaturdayHours || [],
    };
  }
  return { blockedDaysOfWeek: [], blockedHours: [], blockedSaturdayHours: [] };
};

export const saveSystemSettings = async (settings: SystemSettings): Promise<void> => {
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      return;
    }
  } catch (e) {
    // Fallback
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};


