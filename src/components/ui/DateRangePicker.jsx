import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DateRangePicker({ startDate, endDate, minDate, maxDate, initialMonth, onChange }) {
    const [currentMonth, setCurrentMonth] = useState(() => {
        if (initialMonth) return new Date(initialMonth);
        if (startDate) return new Date(startDate);
        if (minDate) return new Date(minDate);
        return new Date();
    });
    const [hoverDate, setHoverDate] = useState(null);

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const generateDays = () => {
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        return days;
    };

    const getFormatDate = (day) => {
        if (!day) return null;
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    };

    const isOutOfRange = (dayStr) => {
        if (!dayStr) return true;
        const d = new Date(dayStr);
        d.setHours(0, 0, 0, 0);
        if (minDate) {
            const min = new Date(minDate);
            min.setHours(0, 0, 0, 0);
            if (d < min) return true;
        }
        if (maxDate) {
            const max = new Date(maxDate);
            max.setHours(0, 0, 0, 0);
            if (d > max) return true;
        }
        return false;
    };

    const handleDayClick = (dayStr) => {
        if (!dayStr || isOutOfRange(dayStr)) return;
        if (!startDate || (startDate && endDate)) {
            onChange({ startDate: dayStr, endDate: '' });
        } else {
            if (new Date(dayStr) < new Date(startDate)) {
                onChange({ startDate: dayStr, endDate: startDate });
            } else {
                onChange({ startDate: startDate, endDate: dayStr });
            }
        }
    };

    const isSelected = (dayStr) => dayStr === startDate || dayStr === endDate;

    const isBetween = (dayStr) => {
        if (!dayStr || !startDate) return false;
        const date = new Date(dayStr);
        const start = new Date(startDate);

        if (endDate) {
            const end = new Date(endDate);
            return date > start && date < end;
        }

        if (hoverDate) {
            const hover = new Date(hoverDate);
            return (date > start && date < hover) || (date > hover && date < start);
        }
        return false;
    };

    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

    return (
        <div className="w-full select-none transition-colors px-1 sm:px-2 pb-2">
            <div className="flex justify-between items-center mb-6 sm:mb-8 px-2 sm:px-4">
                <button type="button" onClick={prevMonth} className="p-1 sm:p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-slate-800 dark:text-neutral-200"><ChevronLeft size={20} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2.5} /></button>
                <div className="font-extrabold text-lg sm:text-2xl text-slate-900 dark:text-neutral-50 tracking-tight">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</div>
                <button type="button" onClick={nextMonth} className="p-1 sm:p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-slate-800 dark:text-neutral-200"><ChevronRight size={20} className="sm:w-[24px] sm:h-[24px]" strokeWidth={2.5} /></button>
            </div>

            <div className="grid grid-cols-7 gap-y-2 sm:gap-y-3 text-center">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="font-bold text-slate-400 dark:text-neutral-400 text-xs sm:text-sm mb-2 sm:mb-4">{d}</div>
                ))}

                {generateDays().map((day, idx) => {
                    const dayStr = getFormatDate(day);
                    const selected = isSelected(dayStr);
                    const inRange = isBetween(dayStr);
                    const isStart = dayStr === startDate;
                    const isEnd = dayStr === endDate;
                    const outOfRange = isOutOfRange(dayStr);

                    return (
                        <div
                            key={idx}
                            className={`relative flex justify-center items-center h-10 sm:h-12 ${inRange ? 'bg-indigo-50 dark:bg-purple-500/25' : ''} ${isStart && endDate ? 'rounded-l-full bg-indigo-50 dark:bg-purple-500/25' : ''} ${isEnd ? 'rounded-r-full bg-indigo-50 dark:bg-purple-500/25' : ''}`}
                        >
                            {day ? (
                                <div
                                    onClick={() => handleDayClick(dayStr)}
                                    onMouseEnter={() => dayStr && setHoverDate(dayStr)}
                                    onMouseLeave={() => setHoverDate(null)}
                                    className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full text-sm sm:text-base font-bold transition-all duration-200
                    ${outOfRange ? 'opacity-30 cursor-not-allowed text-slate-500 dark:text-neutral-600' : 'cursor-pointer'}
                    ${selected && !outOfRange ? 'bg-indigo-600 dark:bg-purple-600 text-white shadow-md scale-100 z-10' : ''}
                    ${!selected && !outOfRange ? 'hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-800 dark:text-neutral-200' : ''}
                  `}
                                >
                                    {day}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
