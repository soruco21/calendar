import { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface CalendarProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  blockedDays?: string[];
  bookedDays?: string[];
  blockedDaysOfWeek?: number[];
}

export function Calendar({ selectedDate, onSelectDate, blockedDays = [], bookedDays = [], blockedDaysOfWeek = [] }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth))
  });

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-stone-100 p-3 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-stone-800 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 sm:p-2 rounded-full hover:bg-stone-100 text-stone-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 sm:p-2 rounded-full hover:bg-stone-100 text-stone-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-1 sm:mb-2">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
          <div key={day} className="text-[10px] sm:text-xs font-medium text-stone-400 py-1 sm:py-2">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((date, i) => {
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isDateToday = isToday(date);
          const isPast = date < new Date(new Date().setHours(0,0,0,0));
          const dateString = format(date, 'yyyy-MM-dd');
          const isBlocked = blockedDays.includes(dateString);
          const isBooked = bookedDays.includes(dateString);
          const isDayOfWeekBlocked = blockedDaysOfWeek.includes(date.getDay());

          const disabled = !isCurrentMonth || isPast || isDayOfWeekBlocked;

          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onSelectDate(date)}
              className={cn(
                "h-8 sm:h-10 w-8 sm:w-10 rounded-full flex flex-col items-center justify-center text-xs sm:text-sm transition-all duration-200 mx-auto relative",
                !isCurrentMonth && "text-stone-300 opacity-50",
                isCurrentMonth && !disabled && !isSelected && !isBlocked && "text-stone-700 hover:bg-brand-50 hover:text-brand-700",
                isCurrentMonth && !disabled && !isSelected && isBlocked && "text-red-600 hover:bg-red-50 hover:text-red-700 font-medium",
                isSelected && !isBlocked && "bg-brand-600 text-white shadow-md shadow-brand-200",
                isSelected && isBlocked && "bg-red-600 text-white shadow-md shadow-red-200",
                isDateToday && !isSelected && !isBlocked && "font-bold text-brand-600 border border-brand-200",
                isDateToday && !isSelected && isBlocked && "font-bold text-red-600 border border-red-200",
                disabled && isCurrentMonth && "text-stone-300 cursor-not-allowed bg-stone-50"
              )}
            >
              <span className={cn(
                "font-medium",
                isSelected && "text-white"
              )}>
                {format(date, 'd')}
              </span>
              
              {isCurrentMonth && !disabled && (
                <div className="absolute bottom-0.5 flex gap-0.5 justify-center">
                  {isBlocked && (
                    <span className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-red-500")} />
                  )}
                  {isBooked && !isBlocked && (
                    <span className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-brand-500")} />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
