export interface Appointment {
  id: string;
  patientName: string;
  patientDob: string;
  patientPhone: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}

export interface BlockedSlot {
  date: string; // YYYY-MM-DD
  time: string | 'ALL'; // HH:mm or 'ALL'
}

export interface User {
  name: string;
  dob: string;
  phone: string;
}

export interface SystemSettings {
  blockedDaysOfWeek: number[]; // 0 = Sunday, 1 = Monday, etc.
  blockedHours: string[]; // e.g. ["12:00", "13:00"]
  blockedSaturdayHours: string[]; // e.g. ["15:00", "16:00"] for Saturdays
}
