import React, { useState, useEffect } from 'react';
import { User, Appointment, BlockedSlot, SystemSettings } from '../types';
import { Calendar } from './Calendar';
import { getAppointments, getBlockedSlots, saveAppointment, TIME_SLOTS, getSystemSettings } from '../store';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { LogOut, CheckCircle2, User as UserIcon, Calendar as CalendarIcon, Clock, MapPin, CreditCard, Info, X, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export function ClientInterface() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [dobText, setDobText] = useState('');
  const [dobError, setDobError] = useState('');
  const [phone, setPhone] = useState('');
  
  const datePickerRef = React.useRef<HTMLInputElement>(null);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ blockedDaysOfWeek: [], blockedHours: [], blockedSaturdayHours: [] });
  
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Days completely blocked or fully booked (no slots available)
  const blockedDays = React.useMemo(() => {
    const dates = new Set<string>();
    appointments.forEach(a => dates.add(a.date));
    blockedSlots.forEach(s => dates.add(s.date));

    const result: string[] = [];
    dates.forEach(dateStr => {
      // 1. If whole day is blocked by admin
      if (blockedSlots.some(s => s.date === dateStr && s.time === 'ALL')) {
        result.push(dateStr);
        return;
      }

      // 2. If all slots are either booked, blocked, or globally blocked
      const allSlotsOccupied = TIME_SLOTS.every(time => {
        const dateObj = parseISO(dateStr);
        const isSaturdayHourBlocked = dateObj.getDay() === 6 && (systemSettings.blockedSaturdayHours || []).includes(time);
        const isBlocked = blockedSlots.some(s => s.date === dateStr && s.time === time) || systemSettings.blockedHours.includes(time) || isSaturdayHourBlocked;
        const isBooked = appointments.some(a => a.date === dateStr && a.time === time);
        return isBlocked || isBooked;
      });

      if (allSlotsOccupied) {
        result.push(dateStr);
      }
    });
    return result;
  }, [appointments, blockedSlots, systemSettings]);

  // Days with at least one booking (reserved slot)
  const bookedDays = React.useMemo(() => {
    const dates = new Set<string>();
    appointments.forEach(a => dates.add(a.date));
    return Array.from(dates);
  }, [appointments]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      const apps = await getAppointments();
      const slots = await getBlockedSlots();
      const settings = await getSystemSettings();
      if (active) {
        setAppointments(apps);
        setBlockedSlots(slots);
        setSystemSettings(settings);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [bookingSuccess]);

  const handleDobTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDobError('');
    let val = e.target.value;
    
    // Only allow digits
    let clean = val.replace(/\D/g, '');
    if (clean.length > 8) {
      clean = clean.substring(0, 8);
    }
    
    let formatted = '';
    if (clean.length > 0) {
      formatted += clean.substring(0, 2);
    }
    if (clean.length > 2) {
      formatted += '/' + clean.substring(2, 4);
    }
    if (clean.length > 4) {
      formatted += '/' + clean.substring(4, 8);
    }
    
    setDobText(formatted);

    // If complete and valid, update the hidden dob state so it matches
    if (clean.length === 8) {
      const day = clean.substring(0, 2);
      const month = clean.substring(2, 4);
      const year = clean.substring(4, 8);
      const parsed = `${year}-${month}-${day}`;
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= new Date().getFullYear()) {
        setDob(parsed);
      }
    } else if (clean.length === 0) {
      setDob('');
    }
  };

  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDobError('');
    const dbVal = e.target.value; // YYYY-MM-DD
    if (dbVal) {
      setDob(dbVal);
      const parts = dbVal.split('-');
      if (parts.length === 3) {
        setDobText(`${parts[2]}/${parts[1]}/${parts[0]}`);
      }
    }
  };

  const triggerDatePicker = () => {
    if (datePickerRef.current) {
      if (typeof datePickerRef.current.showPicker === 'function') {
        try {
          datePickerRef.current.showPicker();
        } catch (err) {
          datePickerRef.current.click();
        }
      } else {
        datePickerRef.current.click();
      }
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate date format DD/MM/AAAA
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(dobText)) {
      setDobError('Formato incorrecto. Usa DD/MM/AAAA (ej. 25/08/1995)');
      return;
    }
    
    const parts = dobText.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    const dateObj = new Date(year, month - 1, day);
    const today = new Date();
    
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() + 1 !== month ||
      dateObj.getDate() !== day
    ) {
      setDobError('La fecha ingresada no es válida.');
      return;
    }
    
    if (year < 1900 || dateObj > today) {
      setDobError('Por favor, ingresa un año de nacimiento real.');
      return;
    }
    
    const parsedDob = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    if (name.trim() && parsedDob && phone.trim()) {
      setDob(parsedDob);
      setUser({ name, dob: parsedDob, phone });
    }
  };

  const handleBook = async () => {
    if (!user || !selectedDate || !selectedTime) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const newAppointment: Appointment = {
      id: Math.random().toString(36).substring(7),
      patientName: user.name,
      patientDob: user.dob,
      patientPhone: user.phone,
      date: dateStr,
      time: selectedTime
    };
    
    await saveAppointment(newAppointment);
    setBookingSuccess(true);
  };

  const resetBooking = () => {
    setBookingSuccess(false);
    setSelectedDate(null);
    setSelectedTime(null);
    setUser(null);
    setName('');
    setDob('');
    setDobText('');
    setDobError('');
    setPhone('');
  };

  // Login View
  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-stone-100 w-full max-w-md">
          <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <img src="/logo-sm.svg" alt="Isotipo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-center text-stone-800 mb-1">Reserva tu cita</h1>
          <p className="text-stone-500 text-xs sm:text-sm text-center mb-5 sm:mb-8">Completa tus datos para ver los horarios disponibles</p>
          
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-0.5 sm:mb-1">Nombre Completo</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors text-sm"
                placeholder="Ej. Ana García"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-0.5 sm:mb-1">Fecha de Nacimiento</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  value={dobText}
                  onChange={handleDobTextChange}
                  maxLength={10}
                  className={cn(
                    "w-full pl-3 sm:pl-4 pr-12 py-2 sm:py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors text-sm",
                    dobError && "border-red-300 focus:ring-red-500/20 focus:border-red-500"
                  )}
                  placeholder="DD/MM/AAAA"
                />
                <button
                  type="button"
                  onClick={triggerDatePicker}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors p-1.5 rounded-lg hover:bg-stone-50"
                  title="Abrir calendario"
                >
                  <CalendarIcon size={18} />
                </button>
                {/* Hidden native date input */}
                <input
                  type="date"
                  ref={datePickerRef}
                  value={dob}
                  onChange={handleDatePickerChange}
                  className="sr-only absolute pointer-events-none"
                  tabIndex={-1}
                />
              </div>
              {dobError ? (
                <p className="mt-1 text-xs text-red-500 font-medium">{dobError}</p>
              ) : (
                <p className="mt-1 text-[10px] sm:text-[11px] text-stone-400">Puedes escribirla (ej. 25/08/1995) o usar el calendario.</p>
              )}
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-0.5 sm:mb-1">Teléfono</label>
              <input 
                type="tel" 
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors text-sm"
                placeholder="Ej. 77712345"
              />
            </div>
            <button 
              type="submit"
              className="w-full py-2.5 sm:py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors mt-3 sm:mt-4 text-sm"
            >
              Continuar
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Booking Success View
  if (bookingSuccess) {
    const formatTimeTo12h = (timeStr: string | null) => {
      if (!timeStr) return '';
      const [hourStr, minuteStr] = timeStr.split(':');
      const hour = parseInt(hourStr, 10);
      const ampm = hour >= 12 ? 'p.m.' : 'a.m.';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minuteStr} ${ampm}`;
    };

    return (
      <div className="min-h-screen bg-stone-50 p-4 flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 w-full max-w-md text-center">
          <CheckCircle2 className="w-20 h-20 text-brand-500 mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-stone-800 mb-2">¡Cita Confirmada!</h2>
          
          <div className="text-stone-600 mb-8 bg-stone-50 p-6 rounded-2xl border border-stone-100">
            <p className="font-semibold text-stone-800 mb-4 text-center text-base">Detalles de tu reserva:</p>
            
            <div className="max-w-[320px] mx-auto space-y-3.5 text-left">
              <div className="flex justify-between items-center text-sm border-b border-stone-200/50 pb-2.5 gap-4">
                <span className="text-stone-500 font-medium">Servicio:</span>
                <span className="font-semibold text-stone-800 text-right">Consulta dermatológica</span>
              </div>
              
              <div className="flex justify-between items-center text-sm border-b border-stone-200/50 pb-2.5 gap-4">
                <span className="text-stone-500 font-medium">Fecha:</span>
                <span className="font-semibold text-stone-800 text-right">
                  {selectedDate && (() => {
                    const dateStr = format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es });
                    const dayName = format(selectedDate, "EEEE", { locale: es }).toLowerCase();
                    return `${dateStr} (${dayName})`;
                  })()}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm gap-4">
                <span className="text-stone-500 font-medium">Hora:</span>
                <span className="font-semibold text-stone-800 text-right">
                  {formatTimeTo12h(selectedTime)}
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={resetBooking}
            className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors"
          >
            Finalizar
          </button>
        </div>
      </div>
    );
  }

  // Helper to determine slot status
  const getSlotStatus = (dateStr: string, time: string) => {
    // Check if whole day is blocked
    if (blockedSlots.some(s => s.date === dateStr && s.time === 'ALL')) return 'blocked';
    // Check if specific time is blocked
    if (blockedSlots.some(s => s.date === dateStr && s.time === time)) return 'blocked';
    // Check if this slot is globally blocked
    if (systemSettings.blockedHours.includes(time)) return 'blocked';
    
    // Check if this is Saturday and the slot is blocked in Saturday-specific settings
    const dateObj = parseISO(dateStr);
    if (dateObj.getDay() === 6 && (systemSettings.blockedSaturdayHours || []).includes(time)) {
      return 'blocked';
    }

    // Check if already booked
    if (appointments.some(a => a.date === dateStr && a.time === time)) return 'booked';
    
    return 'available';
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 sm:h-10 flex items-center justify-center">
              <img src="/logo-sm.svg" alt="Logo" className="h-full w-auto object-contain sm:hidden" />
              <img src="/logo.svg" alt="Logo" className="h-full w-auto object-contain hidden sm:block" />
            </div>
            <span className="font-medium text-stone-800 hidden sm:block border-l border-stone-200 pl-3 text-sm">Hola, {user.name.split(' ')[0]}</span>
          </div>
          <button 
            onClick={() => setUser(null)}
            className="flex items-center gap-2 text-xs sm:text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            <LogOut size={15} />
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-3 sm:py-8">
        <div className="mb-3 sm:mb-8">
          <h1 className="text-lg sm:text-2xl font-semibold text-stone-800">Reserva tu cita</h1>
          <p className="text-stone-500 text-xs sm:text-sm mt-0.5">Selecciona la fecha y el horario que mejor se adapten a ti para tu consulta dermatológica</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-8 items-start">
          {/* Calendar Section */}
          <div className={cn("md:block", selectedDate ? "hidden" : "block")}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <section>
                <div className="flex items-center gap-2 mb-2 sm:mb-4 text-stone-700 text-xs sm:text-sm font-medium px-1">
                  <CalendarIcon size={16} className="text-brand-600" />
                  1. Selecciona una fecha
                </div>
                <Calendar 
                  selectedDate={selectedDate} 
                  onSelectDate={(date) => {
                    setSelectedDate(date);
                    setSelectedTime(null);
                  }} 
                  blockedDays={blockedDays}
                  bookedDays={bookedDays}
                  blockedDaysOfWeek={systemSettings.blockedDaysOfWeek}
                />
              </section>
            </motion.div>
          </div>

          {/* Time Selection Section */}
          <div className={cn("md:block", selectedDate ? "block" : "hidden")}>
            <motion.div
              key={selectedDate ? selectedDate.toISOString() : 'no-date'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <section>
                <div className="flex items-center justify-between mb-2 sm:mb-4 px-1 gap-4">
                  <div className="flex items-center gap-2 text-stone-700 text-xs sm:text-sm font-medium">
                    <Clock size={16} className="text-brand-600" />
                    2. Selecciona un horario disponible
                  </div>
                  {/* Button to return to Calendar on mobile */}
                  {selectedDate && (
                    <button
                      onClick={() => {
                        setSelectedDate(null);
                        setSelectedTime(null);
                      }}
                      className="md:hidden text-[11px] text-brand-700 font-medium hover:text-brand-800 flex items-center gap-1 bg-brand-50 hover:bg-brand-100 py-1 px-2.5 rounded-lg border border-brand-100 transition-colors shrink-0"
                    >
                      <ArrowLeft size={13} />
                      Volver
                    </button>
                  )}
                </div>
                
                {!selectedDate ? (
                  <div className="bg-white rounded-2xl border border-stone-100 p-8 text-center text-stone-400 text-xs sm:text-sm">
                    Selecciona un día en el calendario para ver los horarios disponibles.
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-stone-100 p-4 sm:p-6">
                    <h3 className="text-stone-800 text-sm sm:text-base font-medium mb-3 sm:mb-4">
                      {(() => {
                        const str = format(selectedDate, "EEEE d 'de' MMMM", { locale: es });
                        return str.charAt(0).toUpperCase() + str.slice(1);
                      })()}
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                      {TIME_SLOTS.map(time => {
                        const dateStr = format(selectedDate, 'yyyy-MM-dd');
                        const status = getSlotStatus(dateStr, time);
                        const isAvailable = status === 'available';
                        const isSelected = selectedTime === time;
                        
                        return (
                          <button
                            key={time}
                            disabled={!isAvailable}
                            onClick={() => setSelectedTime(time)}
                            className={cn(
                              "py-2 sm:py-3 px-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 border",
                              isAvailable && !isSelected && "bg-white border-stone-200 text-stone-700 hover:border-brand-500 hover:text-brand-700",
                              isSelected && "bg-brand-600 border-brand-600 text-white shadow-md shadow-brand-200",
                              !isAvailable && "bg-stone-50 border-stone-100 text-stone-400 cursor-not-allowed opacity-60"
                            )}
                          >
                            {time}
                            {!isAvailable && (
                              <span className="block text-[9px] font-normal mt-0.5 opacity-80">
                                Ocupado
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {selectedTime && (
                      <div className="mt-4 sm:mt-8 pt-3 sm:pt-6 border-t border-stone-100">
                        <button
                          onClick={handleBook}
                          className="w-full py-2.5 sm:py-3.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm sm:text-base font-medium rounded-lg sm:rounded-xl transition-all shadow-md shadow-brand-200/50 transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                          Confirmar mi cita
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </motion.div>
          </div>
        </div>

      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowInfoModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-stone-900 text-brand-400 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center z-40 border border-stone-700"
        aria-label="Información del consultorio"
      >
        <Info size={28} />
      </button>

      {/* Clinic Information Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-stone-900 px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Info className="text-brand-400" size={20} />
                <h2 className="text-lg font-medium">Información del Consultorio</h2>
              </div>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="text-stone-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-stone-800"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
              {/* Dirección */}
              <div className="flex gap-3">
                <div className="w-8 h-8 shrink-0 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                  <MapPin size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-800 text-sm mb-1">Dirección</h3>
                  <div className="text-stone-600 text-xs leading-relaxed">
                    <p className="font-medium text-stone-800">Centro Médico Niño Jesús</p>
                    <p>Av. Cañoto Nº 580, Rafael Peña. Piso 5, consultorio 512.</p>
                  </div>
                </div>
              </div>

              {/* Horarios */}
              <div className="flex gap-3 border-t border-stone-100 pt-4">
                <div className="w-8 h-8 shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-800 text-sm mb-1">Horarios</h3>
                  <div className="text-stone-600 text-xs leading-relaxed">
                    <p><span className="font-medium text-stone-800">Lun a Vie:</span> 09:00 - 12:00 m. | 15:00 - 20:00 hrs.</p>
                    <p><span className="font-medium text-stone-800">Sáb:</span> 09:00 - 12:00 m.</p>
                    <p className="mt-1 italic text-stone-500 text-[11px]">Se marca cita previamente para ser atendido.</p>
                  </div>
                </div>
              </div>

              {/* Costos */}
              <div className="flex gap-3 border-t border-stone-100 pt-4">
                <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CreditCard size={16} />
                </div>
                <div className="w-full">
                  <h3 className="font-semibold text-stone-800 text-sm mb-1">Costos y Pagos</h3>
                  <div className="text-stone-600 text-xs leading-relaxed space-y-2">
                    <div>
                      <p className="font-medium text-stone-800">Consulta: <span className="text-emerald-700 font-semibold">250 bs.</span></p>
                      <p className="font-medium text-stone-800">Reconsulta (control): <span className="text-stone-700 font-semibold">50 bs.</span></p>
                    </div>
                    <div className="p-2 bg-stone-50 rounded-lg border border-stone-100">
                      <p className="text-[10px] font-medium text-stone-600 mb-0.5">Métodos de pago:</p>
                      <p className="text-[10px] text-stone-500">Efectivo, Código QR o Transferencia bancaria.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
