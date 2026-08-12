import React, { useState, useEffect } from 'react';
import { Appointment, BlockedSlot, SystemSettings } from '../types';
import { Calendar } from './Calendar';
import { getAppointments, getBlockedSlots, saveBlockedSlot, removeBlockedSlot, TIME_SLOTS, getSystemSettings, saveSystemSettings, deleteAppointment } from '../store';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { LogOut, Shield, CalendarDays, Users, Ban, Trash2, Settings, Lock, CheckCircle2, Clock, Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

function calculateAge(dobString: string): string {
  if (!dobString) return '';
  const parts = dobString.split('-');
  if (parts.length !== 3) return '';
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);
  
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const m = today.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return `${age} años`;
}

export function AdminInterface({ onLogout }: { onLogout: () => void }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [activeTab, setActiveTab] = useState<'appointments' | 'calendar' | 'settings'>('appointments');
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ blockedDaysOfWeek: [], blockedHours: [], blockedSaturdayHours: [] });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [deletingApp, setDeletingApp] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deletingApp) return;
    setIsDeleting(true);
    try {
      await deleteAppointment(deletingApp.id);
      setDeletingApp(null);
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredAndSortedAppointments = React.useMemo(() => {
    let result = [...appointments];
    
    // Filter by search term
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(app => 
        app.patientName.toLowerCase().includes(term) ||
        app.patientPhone.toLowerCase().includes(term) ||
        app.date.toLowerCase().includes(term)
      );
    }
    
    // Sort by date and time
    result.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`).getTime();
      const dateB = new Date(`${b.date}T${b.time}`).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    
    return result;
  }, [appointments, searchTerm, sortOrder]);

  const bookedDays = React.useMemo(() => {
    const dates = new Set<string>();
    appointments.forEach(a => dates.add(a.date));
    return Array.from(dates);
  }, [appointments]);

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);

  const loadData = async () => {
    // Sort appointments by date and time
    const fetchedApps = await getAppointments();
    const apps = [...fetchedApps].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });
    setAppointments(apps);
    const fetchedSlots = await getBlockedSlots();
    setBlockedSlots(fetchedSlots);
    const settings = await getSystemSettings();
    setSystemSettings(settings);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate auth
    if (username === 'karol' && password === '1234') {
      setIsLoggedIn(true);
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const toggleBlockTime = async (dateStr: string, time: string | 'ALL') => {
    const isBlocked = blockedSlots.some(s => s.date === dateStr && s.time === time);
    if (isBlocked) {
      await removeBlockedSlot(dateStr, time);
    } else {
      await saveBlockedSlot({ date: dateStr, time });
    }
    await loadData();
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
          <div className="w-16 h-16 bg-stone-100 text-stone-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-semibold text-center text-stone-800 mb-8">Acceso Administrativo</h1>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Usuario</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-500/20 focus:border-stone-500 transition-colors bg-stone-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-500/20 focus:border-stone-500 transition-colors bg-stone-50"
              />
            </div>
            
            {loginError && (
              <p className="text-red-500 text-sm font-medium text-center">Credenciales incorrectas.</p>
            )}

            <button 
              type="submit"
              className="w-full py-3 px-4 bg-stone-800 hover:bg-stone-900 text-white font-medium rounded-xl transition-colors mt-4"
            >
              Iniciar Sesión
            </button>
          </form>
          <div className="mt-6 text-center">
             <button onClick={onLogout} className="text-sm text-stone-400 hover:text-stone-600">
               Volver al inicio
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-stone-900 text-stone-300 md:min-h-screen flex flex-col">
        <div className="p-6 pb-2 border-b border-stone-800 hidden md:block">
          <div className="flex items-center gap-3 text-white mb-2">
            <div className="h-8 md:h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden px-1 md:px-2">
              <img src="/logo-sm.svg" alt="Logo" className="h-full w-auto object-contain md:hidden p-1" />
              <img src="/logo.svg" alt="Logo" className="h-full w-auto object-contain hidden md:block py-2" />
            </div>
            <span className="font-semibold text-lg">Admin Panel</span>
          </div>
          <p className="text-xs text-stone-500">Gestión de Consultorio</p>
        </div>
        
        <nav className="flex-1 p-2 md:p-4 gap-1.5 flex flex-row md:flex-col overflow-x-auto md:overflow-visible md:space-y-2">
          <button 
            onClick={() => setActiveTab('appointments')}
            className={cn(
              "flex items-center gap-1.5 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === 'appointments' ? "bg-stone-800 text-white" : "hover:bg-stone-800 hover:text-white"
            )}
          >
            <Users size={16} className="md:w-[18px] md:h-[18px]" />
            Citas Agendadas
          </button>
          <button 
            onClick={() => setActiveTab('calendar')}
            className={cn(
              "flex items-center gap-1.5 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === 'calendar' ? "bg-stone-800 text-white" : "hover:bg-stone-800 hover:text-white"
            )}
          >
            <CalendarDays size={16} className="md:w-[18px] md:h-[18px]" />
            Control de Agenda
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex items-center gap-1.5 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === 'settings' ? "bg-stone-800 text-white" : "hover:bg-stone-800 hover:text-white"
            )}
          >
            <Settings size={16} className="md:w-[18px] md:h-[18px]" />
            Configuración de Agenda
          </button>
        </nav>
        
        <div className="p-4 border-t border-stone-800 hidden md:block">
          <button 
            onClick={() => setIsLoggedIn(false)}
            className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg text-sm text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto max-h-screen">
        <header className="flex justify-between items-center mb-4 sm:mb-8 md:hidden">
           <h2 className="text-base sm:text-xl font-semibold text-stone-800">
             {activeTab === 'appointments' ? 'Citas Agendadas' : activeTab === 'calendar' ? 'Control de Agenda' : 'Configuración de Agenda'}
           </h2>
           <button 
            onClick={() => setIsLoggedIn(false)}
            className="text-stone-500 hover:text-stone-700"
          >
            <LogOut size={18} />
          </button>
        </header>

        {activeTab === 'appointments' && (
          <div className="max-w-5xl">
            <h2 className="text-2xl font-semibold text-stone-800 mb-6 hidden md:block">Próximas Citas</h2>

            {/* Buscador y Organizador */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4 md:mb-6 items-stretch sm:items-center justify-between">
              {/* Buscador */}
              <div className="relative flex-1 max-w-md">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Buscar por nombre, teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 md:py-2.5 bg-white border border-stone-200 rounded-lg md:rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-stone-500/15 focus:border-stone-500 transition-colors placeholder:text-stone-400 text-stone-800 shadow-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600 text-[10px] md:text-xs font-medium"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Organizador */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-stone-500 whitespace-nowrap hidden sm:inline">Ordenar por fecha:</span>
                <div className="inline-flex rounded-lg md:rounded-xl border border-stone-200 bg-white p-0.5 md:p-1 shadow-sm w-full sm:w-auto">
                  <button
                    onClick={() => setSortOrder('asc')}
                    className={cn(
                      "flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-xs font-medium transition-all",
                      sortOrder === 'asc'
                        ? "bg-stone-100 text-stone-800"
                        : "text-stone-500 hover:text-stone-800"
                    )}
                  >
                    <ChevronUp size={12} className="md:w-[14px] md:h-[14px]" />
                    Próximas primero
                  </button>
                  <button
                    onClick={() => setSortOrder('desc')}
                    className={cn(
                      "flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-xs font-medium transition-all",
                      sortOrder === 'desc'
                        ? "bg-stone-100 text-stone-800"
                        : "text-stone-500 hover:text-stone-800"
                    )}
                  >
                    <ChevronDown size={12} className="md:w-[14px] md:h-[14px]" />
                    Últimas primero
                  </button>
                </div>
              </div>
            </div>
            
            <div className="md:hidden space-y-2.5">
              {appointments.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400 bg-white rounded-xl shadow-sm border border-stone-200">
                  No hay citas agendadas actualmente.
                </div>
              ) : filteredAndSortedAppointments.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400 bg-white rounded-xl shadow-sm border border-stone-200">
                  No se encontraron citas que coincidan con la búsqueda.
                </div>
              ) : (
                filteredAndSortedAppointments.map(app => (
                  <div key={app.id} className="bg-white p-3.5 rounded-xl shadow-sm border border-stone-200/80">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-stone-800 text-sm">{app.patientName}</h3>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-100/50">
                          {app.time}
                        </span>
                        <button
                          onClick={() => setDeletingApp(app)}
                          className="p-1.5 text-stone-400 hover:text-red-600 transition-colors rounded-lg hover:bg-stone-50"
                          title="Eliminar cita"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                      <div className="text-stone-500">
                        <span className="font-medium text-stone-700 block text-[10px] uppercase tracking-wider mb-0.5">F. Nacimiento</span> 
                        {app.patientDob} <span className="text-stone-400 font-normal">({calculateAge(app.patientDob)})</span>
                      </div>
                      <div className="text-stone-500">
                        <span className="font-medium text-stone-700 block text-[10px] uppercase tracking-wider mb-0.5">Teléfono</span> 
                        {app.patientPhone}
                      </div>
                      <div className="text-stone-700 col-span-2 capitalize pt-1 mt-1 border-t border-stone-100">
                        <span className="font-semibold text-stone-500 block text-[10px] uppercase tracking-wider normal-case mb-0.5">Fecha de Cita</span> 
                        {format(parseISO(app.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 text-sm border-b border-stone-200">
                      <th className="p-4 font-medium whitespace-nowrap">Paciente</th>
                      <th className="p-4 font-medium whitespace-nowrap">Teléfono</th>
                      <th className="p-4 font-medium whitespace-nowrap">F. Nacimiento</th>
                      <th className="p-4 font-medium whitespace-nowrap">Fecha de Cita</th>
                      <th className="p-4 font-medium whitespace-nowrap">Hora</th>
                      <th className="p-4 font-medium whitespace-nowrap text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {appointments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-stone-400">
                          No hay citas agendadas actualmente.
                        </td>
                      </tr>
                    ) : filteredAndSortedAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-stone-400">
                          No se encontraron citas que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filteredAndSortedAppointments.map(app => (
                        <tr key={app.id} className="hover:bg-stone-50 transition-colors">
                          <td className="p-4 font-medium text-stone-800 whitespace-nowrap">{app.patientName}</td>
                          <td className="p-4 text-stone-600 text-sm whitespace-nowrap">{app.patientPhone}</td>
                          <td className="p-4 text-stone-500 text-sm whitespace-nowrap">
                            {app.patientDob} <span className="text-stone-400 font-normal">({calculateAge(app.patientDob)})</span>
                          </td>
                          <td className="p-4 text-stone-700 capitalize whitespace-nowrap">
                            {format(parseISO(app.date), "EEE, d MMM yyyy", { locale: es })}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-brand-50 text-brand-700 border border-brand-100">
                              {app.time}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => setDeletingApp(app)}
                              className="inline-flex items-center justify-center p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar cita"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="max-w-5xl">
            <div className="mb-4 md:mb-6">
              <h2 className="text-2xl font-semibold text-stone-800 hidden md:block">Control de Agenda</h2>
              <p className="text-stone-500 text-xs sm:text-sm mt-0.5">Bloquea días enteros o franjas horarias para evitar que los pacientes agenden citas.</p>
            </div>
            
            <div className="grid lg:grid-cols-[330px_1fr] gap-4 md:gap-8 items-start">
              <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border border-stone-200 shadow-sm">
                <Calendar 
                  selectedDate={selectedDate} 
                  onSelectDate={setSelectedDate}
                  blockedDays={blockedSlots.filter(s => s.time === 'ALL').map(s => s.date)}
                  bookedDays={bookedDays}
                />
              </div>

              {selectedDate ? (
                <div className="bg-white rounded-xl md:rounded-2xl border border-stone-200 shadow-sm p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-4 md:mb-6 md:pb-6 border-b border-stone-100 gap-3">
                    <div>
                      <h3 className="text-base md:text-lg font-semibold text-stone-800">
                        {(() => {
                           const str = format(selectedDate, "EEEE d 'de' MMMM", { locale: es });
                           return str.charAt(0).toUpperCase() + str.slice(1);
                        })()}
                      </h3>
                      <p className="text-xs md:text-sm text-stone-500">Gestiona la disponibilidad para este día.</p>
                    </div>
                    
                    {/* Block Whole Day Button */}
                    <button
                      onClick={() => toggleBlockTime(format(selectedDate, 'yyyy-MM-dd'), 'ALL')}
                      className={cn(
                        "flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors border",
                        blockedSlots.some(s => s.date === format(selectedDate, 'yyyy-MM-dd') && s.time === 'ALL')
                          ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                          : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                      )}
                    >
                      <Ban size={14} className="md:w-4 md:h-4" />
                      {blockedSlots.some(s => s.date === format(selectedDate, 'yyyy-MM-dd') && s.time === 'ALL')
                        ? "Desbloquear Día Completo"
                        : "Bloquear Día Completo"}
                    </button>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs md:text-sm font-semibold uppercase tracking-wider text-stone-500">Franjas Horarias</h4>
                    
                    {blockedSlots.some(s => s.date === format(selectedDate, 'yyyy-MM-dd') && s.time === 'ALL') ? (
                      <div className="p-6 md:p-8 text-center text-xs md:text-sm text-red-500 bg-red-50 rounded-lg md:rounded-xl border border-red-100">
                        <Ban className="mx-auto mb-2 opacity-50" size={28} />
                        Este día está completamente bloqueado.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {TIME_SLOTS.map(time => {
                          const dateStr = format(selectedDate, 'yyyy-MM-dd');
                          const bookedAppointment = appointments.find(a => a.date === dateStr && a.time === time);
                          const isBlocked = blockedSlots.some(s => s.date === dateStr && s.time === time);
                          
                          if (bookedAppointment) {
                            return (
                              <div key={time} className="py-2 px-1.5 rounded-lg text-xs font-semibold border border-brand-200 bg-brand-50 text-brand-700 flex flex-col items-center justify-center relative opacity-80 cursor-not-allowed text-center">
                                {time}
                                <span className="text-[9px] mt-0.5 text-brand-600 truncate w-full px-1" title={bookedAppointment.patientName}>
                                  {bookedAppointment.patientName}
                                </span>
                              </div>
                            );
                          }
                          
                          return (
                            <button
                              key={time}
                              onClick={() => toggleBlockTime(dateStr, time)}
                              className={cn(
                                "py-2 sm:py-2.5 px-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border flex flex-col items-center justify-center",
                                isBlocked 
                                  ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100" 
                                  : "bg-white border-stone-200 text-stone-700 hover:border-stone-300"
                              )}
                            >
                              {time}
                              <span className="text-[9px] mt-0.5 font-normal opacity-70">
                                {isBlocked ? 'Bloqueado' : 'Disponible'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-stone-50 rounded-xl md:rounded-2xl border border-stone-200 p-6 md:p-12 text-center flex flex-col items-center justify-center text-stone-400">
                  <CalendarDays size={36} className="mb-3 opacity-20" />
                  <p className="text-xs md:text-sm">Selecciona un día en el calendario para gestionar su disponibilidad.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl">
            <div className="mb-4 md:mb-6">
              <h2 className="text-2xl font-semibold text-stone-800 hidden md:block">Configuración de Agenda</h2>
              <p className="text-stone-500 text-xs sm:text-sm mt-0.5">Define reglas globales para inhabilitar días de la semana y horarios específicos para siempre.</p>
            </div>

            <div className="bg-white rounded-xl md:rounded-2xl border border-stone-200 shadow-sm p-4 md:p-6 space-y-6 md:space-y-8">
              {/* Bloqueo de Días de la Semana */}
              <div className="space-y-3">
                <h3 className="text-sm md:text-base font-semibold text-stone-800 flex items-center gap-2">
                  <CalendarDays size={18} className="text-brand-600 md:w-5 md:h-5" />
                  Días de la semana bloqueados (Cerrados)
                </h3>
                <p className="text-xs md:text-sm text-stone-500">
                  Los días seleccionados no estarán disponibles para reservar citas en ningún mes.
                </p>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Domingo', value: 0 },
                    { label: 'Lunes', value: 1 },
                    { label: 'Martes', value: 2 },
                    { label: 'Miércoles', value: 3 },
                    { label: 'Jueves', value: 4 },
                    { label: 'Viernes', value: 5 },
                    { label: 'Sábado', value: 6 }
                  ].map(day => {
                    const isSelected = systemSettings.blockedDaysOfWeek.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          const updatedDays = isSelected
                            ? systemSettings.blockedDaysOfWeek.filter(v => v !== day.value)
                            : [...systemSettings.blockedDaysOfWeek, day.value];
                          setSystemSettings({
                            ...systemSettings,
                            blockedDaysOfWeek: updatedDays
                          });
                        }}
                        className={cn(
                          "py-2 px-2.5 rounded-lg text-xs font-semibold transition-all duration-200 border flex items-center gap-1.5 justify-center",
                          isSelected
                            ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100 font-bold"
                            : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                        )}
                      >
                        <Lock size={12} className={cn("shrink-0 transition-opacity duration-200", isSelected ? "opacity-100 text-red-500" : "opacity-0 w-0 h-0")} />
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bloqueo de Horarios Permanentes */}
              <div className="space-y-3 border-t border-stone-100 pt-5">
                <h3 className="text-sm md:text-base font-semibold text-stone-800 flex items-center gap-2">
                  <Clock size={18} className="text-brand-600 md:w-5 md:h-5" />
                  Horarios permanentemente bloqueados
                </h3>
                <p className="text-xs md:text-sm text-stone-500">
                  Las horas seleccionadas no estarán disponibles para agendar citas en ningún día del calendario.
                </p>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {TIME_SLOTS.map(time => {
                    const isSelected = systemSettings.blockedHours.includes(time);
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => {
                          const updatedHours = isSelected
                            ? systemSettings.blockedHours.filter(h => h !== time)
                            : [...systemSettings.blockedHours, time];
                          setSystemSettings({
                            ...systemSettings,
                            blockedHours: updatedHours
                          });
                        }}
                        className={cn(
                          "py-2 px-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border flex items-center gap-1.5 justify-center",
                          isSelected
                            ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100 font-bold"
                            : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                        )}
                      >
                        <Lock size={11} className={cn("shrink-0 transition-opacity duration-200", isSelected ? "opacity-100 text-red-500" : "opacity-0 w-0 h-0")} />
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Configuración de Horarios para los Sábados */}
              <div className="space-y-3 border-t border-stone-100 pt-5">
                <h3 className="text-sm md:text-base font-semibold text-stone-800 flex items-center gap-2">
                  <Clock size={18} className="text-brand-600 md:w-5 md:h-5" />
                  Horarios bloqueados los Sábados
                </h3>
                <p className="text-xs md:text-sm text-stone-500">
                  Las horas seleccionadas aquí no estarán disponibles para agendar citas únicamente los días Sábados.
                </p>
                {systemSettings.blockedDaysOfWeek.includes(6) && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100/70 p-2.5 rounded-lg">
                    Nota: El sábado está marcado como cerrado en "Días de la semana bloqueados", por lo que no se podrán agendar citas ese día de todas formas.
                  </p>
                )}
                
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {TIME_SLOTS.map(time => {
                    const isSelected = (systemSettings.blockedSaturdayHours || []).includes(time);
                    return (
                      <button
                        key={`sat-${time}`}
                        type="button"
                        onClick={() => {
                          const currentBlockedSat = systemSettings.blockedSaturdayHours || [];
                          const updatedHours = isSelected
                            ? currentBlockedSat.filter(h => h !== time)
                            : [...currentBlockedSat, time];
                          setSystemSettings({
                            ...systemSettings,
                            blockedSaturdayHours: updatedHours
                          });
                        }}
                        className={cn(
                          "py-2 px-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border flex items-center gap-1.5 justify-center",
                          isSelected
                            ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100 font-bold"
                            : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                        )}
                      >
                        <Lock size={11} className={cn("shrink-0 transition-opacity duration-200", isSelected ? "opacity-100 text-red-500" : "opacity-0 w-0 h-0")} />
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Guardar Button & Feedback */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 border-t border-stone-100 pt-5 justify-end">
                {saveStatus === 'saved' && (
                  <span className="text-emerald-600 text-xs md:text-sm font-medium flex items-center justify-center gap-1.5 animate-in fade-in duration-200">
                    <CheckCircle2 size={14} className="md:w-4 md:h-4" />
                    ¡Configuración guardada!
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-red-500 text-xs md:text-sm font-medium text-center">
                    Error al guardar la configuración.
                  </span>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    setSaveStatus('saving');
                    try {
                      await saveSystemSettings(systemSettings);
                      setSaveStatus('saved');
                      setTimeout(() => setSaveStatus('idle'), 3000);
                    } catch (e) {
                      setSaveStatus('error');
                    }
                  }}
                  disabled={saveStatus === 'saving'}
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  {saveStatus === 'saving' ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {deletingApp && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-100 max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-stone-800 mb-2">¿Eliminar esta cita?</h3>
            <p className="text-sm text-stone-500 mb-4">
              ¿Estás seguro de que deseas eliminar permanentemente la cita de <strong className="text-stone-800 font-semibold">{deletingApp.patientName}</strong> el día <strong className="text-stone-800 font-semibold">{format(parseISO(deletingApp.date), "EEEE, d 'de' MMMM", { locale: es })}</strong> a las <strong className="text-stone-800 font-semibold">{deletingApp.time}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletingApp(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-stone-600 hover:bg-stone-50 border border-stone-200 rounded-lg text-xs md:text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs md:text-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
