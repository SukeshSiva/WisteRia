import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, DollarSign, Image as ImageIcon, FileText } from 'lucide-react';
import DateRangePicker from '../ui/DateRangePicker';
import { CURRENCIES } from '../../utils/constants';

export default function EventModal({ event, trip, currency, onClose, onSave, showDialog }) {
    const [data, setData] = useState(() => {
        const defaultState = { title: '', type: 'activity', cost: '', startTime: '', endTime: '', locationLink: '', notes: '', attachments: [] };
        if (event) {
            return { ...defaultState, ...event, cost: (event.cost && event.cost > 0) ? event.cost : '' };
        }
        return defaultState;
    });

    const [timeMode, setTimeMode] = useState('duration');
    const [duration, setDuration] = useState({ hours: 2, minutes: 0 });

    const fileInputRef = useRef(null);

    useEffect(() => {
        if (event && event.startTime && event.endTime) {
            const start = new Date(event.startTime);
            const end = new Date(event.endTime);
            const diffMs = end - start;
            if (diffMs > 0) {
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                setDuration({ hours, minutes });
            }
            setTimeMode('specific');
        }
    }, [event]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        let finalData = { ...data, cost: parseFloat(data.cost) || 0 };

        if (!finalData.startTime) {
            alert("Start time is required");
            return;
        }

        if (timeMode === 'duration') {
            const start = new Date(finalData.startTime);
            const endMs = start.getTime() + (duration.hours * 60 * 60 * 1000) + (duration.minutes * 60 * 1000);
            const end = new Date(endMs);
            finalData.endTime = new Date(end.getTime() - (end.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        }

        // Validate within 3 days of project dates
        if (trip && trip.startDate && trip.endDate) {
            const evStart = new Date(finalData.startTime).getTime();
            const evEnd = finalData.endTime ? new Date(finalData.endTime).getTime() : evStart;

            // Trip dates are YYYY-MM-DD. We parse them carefully in local time.
            let minAllowed = new Date(trip.startDate);
            minAllowed.setHours(0, 0, 0, 0);
            minAllowed = minAllowed.getTime() - (3 * 24 * 60 * 60 * 1000);

            let maxAllowed = new Date(trip.endDate);
            maxAllowed.setHours(23, 59, 59, 999);
            maxAllowed = maxAllowed.getTime() + (3 * 24 * 60 * 60 * 1000);

            if (evStart < minAllowed || evEnd > maxAllowed) {
                if (showDialog) {
                    await showDialog({
                        type: 'alert',
                        title: 'Date Out of Bounds',
                        message: 'Events cannot be scheduled more than 3 days outside of the project\'s start or end dates. Please adjust the time.'
                    });
                } else {
                    alert('Events cannot be scheduled more than 3 days outside of the project\'s start or end dates.');
                }
                return; // Stop submission, keep modal open
            }
        }

        onSave(finalData);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setData({
                ...data,
                attachments: [...(Array.isArray(data.attachments) ? data.attachments : []), { name: file.name, type: file.type, url: reader.result }]
            });
        };
        reader.readAsDataURL(file);
    };

    const removeAttachment = (index) => {
        const newAtt = [...(Array.isArray(data.attachments) ? data.attachments : [])];
        newAtt.splice(index, 1);
        setData({ ...data, attachments: newAtt });
    };

    const safeAttachments = Array.isArray(data?.attachments) ? data.attachments : [];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-neutral-900 rounded-[2rem] w-full max-w-2xl shadow-2xl my-auto overflow-hidden">
                <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-slate-100 dark:border-neutral-800 flex justify-between items-center bg-white/90 dark:bg-neutral-950/90 backdrop-blur z-10 transition-colors">
                    <h3 className="text-xl sm:text-2xl font-extrabold dark:text-white">{event ? 'Edit Event' : 'Add Event'}</h3>
                    <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"><X size={20} /></button>
                </div>
                <form
                    onSubmit={handleSubmit}
                    onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                            handleSubmit(e);
                        }
                    }}
                    className="p-6 sm:p-8 space-y-5 sm:space-y-6"
                >

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div className="sm:col-span-2 relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Event Title</label>
                            <input autoFocus required type="text" value={data.title || ''} onChange={e => setData({ ...data, title: e.target.value })} className="w-full outline-none text-base sm:text-lg font-bold text-slate-900 dark:text-neutral-50 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent" placeholder="e.g. Flight to JFK" />
                        </div>
                        <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Category</label>
                            <select value={data.type || 'activity'} onChange={e => setData({ ...data, type: e.target.value })} className="w-full outline-none text-sm sm:text-base font-bold text-slate-900 dark:text-neutral-50 bg-transparent cursor-pointer">
                                <option className="bg-white dark:bg-neutral-900" value="flight">✈️ Flight</option>
                                <option className="bg-white dark:bg-neutral-900" value="lodging">🏨 Hotel / Stay</option>
                                <option className="bg-white dark:bg-neutral-900" value="food">🍽️ Food</option>
                                <option className="bg-white dark:bg-neutral-900" value="coffee">☕ Coffee / Dessert</option>
                                <option className="bg-white dark:bg-neutral-900" value="walking">🚶 Walking</option>
                                <option className="bg-white dark:bg-neutral-900" value="rest">🛋️ Rest</option>
                                <option className="bg-white dark:bg-neutral-900" value="activity">🗺️ Activity</option>
                                <option className="bg-white dark:bg-neutral-900" value="bus">🚌 Bus</option>
                                <option className="bg-white dark:bg-neutral-900" value="train">🚂 Train</option>
                                <option className="bg-white dark:bg-neutral-900" value="other">📄 Other</option>
                            </select>
                        </div>
                    </div>

                    {/* Time & Duration Section */}
                    <div className="border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-1 bg-slate-100/50 dark:bg-neutral-800/50 transition-colors">
                        <div className="flex bg-slate-200/50 dark:bg-neutral-900/50 rounded-xl p-1 mb-3">
                            <button
                                type="button"
                                onClick={() => setTimeMode('duration')}
                                className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${timeMode === 'duration' ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700'}`}
                            >
                                Duration Timer
                            </button>
                            <button
                                type="button"
                                onClick={() => setTimeMode('specific')}
                                className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${timeMode === 'specific' ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700'}`}
                            >
                                Specific Times
                            </button>
                        </div>

                        {/* Sleek Custom DateRangePicker Integration */}
                        <div className="bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 mb-2 shadow-sm">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 sm:mb-4 flex items-center gap-1 px-2"><Calendar size={12} /> Select Date(s)</label>
                            <DateRangePicker
                                minDate={trip?.startDate}
                                maxDate={trip?.endDate}
                                initialMonth={trip?.startDate}
                                startDate={data.startTime ? data.startTime.split('T')[0] : ''}
                                endDate={(timeMode === 'specific' && data.endTime) ? data.endTime.split('T')[0] : ''}
                                onChange={(dates) => {
                                    const currentStartTime = data.startTime && data.startTime.includes('T') ? data.startTime.split('T')[1] : '09:00';
                                    const currentEndTime = data.endTime && data.endTime.includes('T') ? data.endTime.split('T')[1] : '10:00';
                                    let newStart = data.startTime;
                                    let newEnd = data.endTime;

                                    if (dates.startDate) {
                                        newStart = `${dates.startDate}T${currentStartTime}`;
                                    }
                                    if (timeMode === 'specific') {
                                        if (dates.endDate) {
                                            newEnd = `${dates.endDate}T${currentEndTime}`;
                                        } else if (dates.startDate && dates.startDate !== (data.startTime ? data.startTime.split('T')[0] : '')) {
                                            newEnd = ''; // Reset end date on new start date pick
                                        }
                                    } else {
                                        newEnd = ''; // Duration mode only needs start date
                                    }
                                    setData({ ...data, startTime: newStart, endTime: newEnd });
                                }}
                            />
                        </div>

                        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="relative bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1"><Clock size={12} /> Start Time</label>
                                <input
                                    required
                                    type="time"
                                    value={data.startTime && data.startTime.includes('T') ? data.startTime.split('T')[1].slice(0, 5) : ''}
                                    onChange={e => {
                                        const datePart = data.startTime ? data.startTime.split('T')[0] : (trip?.startDate || new Date().toISOString().split('T')[0]);
                                        setData({ ...data, startTime: `${datePart}T${e.target.value}` });
                                    }}
                                    className="w-full outline-none text-sm font-bold text-slate-900 dark:text-neutral-50 bg-transparent"
                                />
                            </div>

                            {timeMode === 'duration' ? (
                                <div className="relative bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">⏱️ Duration</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 flex-1 border-r border-slate-100 dark:border-neutral-800 pr-2">
                                            <input type="number" min="0" value={duration.hours} onChange={e => setDuration({ ...duration, hours: parseInt(e.target.value) || 0 })} className="w-full outline-none text-sm font-bold text-slate-900 dark:text-neutral-50 bg-transparent text-right" placeholder="0" />
                                            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-neutral-500">hr</span>
                                        </div>
                                        <div className="flex items-center gap-1 flex-1 pl-1">
                                            <input type="number" min="0" max="59" value={duration.minutes} onChange={e => setDuration({ ...duration, minutes: parseInt(e.target.value) || 0 })} className="w-full outline-none text-sm font-bold text-slate-900 dark:text-neutral-50 bg-transparent text-right" placeholder="0" />
                                            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-neutral-500">min</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1"><Clock size={12} /> End Time</label>
                                    <input
                                        type="time"
                                        value={data.endTime && data.endTime.includes('T') ? data.endTime.split('T')[1].slice(0, 5) : ''}
                                        onChange={e => {
                                            const datePart = data.endTime ? data.endTime.split('T')[0] : (data.startTime ? data.startTime.split('T')[0] : (trip?.startDate || new Date().toISOString().split('T')[0]));
                                            setData({ ...data, endTime: `${datePart}T${e.target.value}` });
                                        }}
                                        className="w-full outline-none text-sm font-bold text-slate-900 dark:text-neutral-50 bg-transparent"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/20 transition-all bg-white dark:bg-neutral-950 max-w-xs">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Estimated Cost ({currency})</label>
                        <div className="flex items-center text-base sm:text-lg font-bold text-slate-900 dark:text-neutral-50">
                            <span className="text-slate-400 dark:text-neutral-600 mr-2">{String(CURRENCIES.find(c => c.code === currency)?.symbol || '$')}</span>
                            <input type="number" min="0" step="0.01" value={data.cost} onChange={e => setData({ ...data, cost: e.target.value })} className="w-full outline-none bg-transparent" placeholder="0.00" />
                        </div>
                    </div>

                    <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Location Link (URL)</label>
                        <input type="url" value={data.locationLink || ''} onChange={e => setData({ ...data, locationLink: e.target.value })} className="w-full outline-none text-sm sm:text-base font-medium text-slate-900 dark:text-neutral-200 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent" placeholder="e.g. Google Maps URL..." />
                    </div>

                    <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Notes & Booking Refs</label>
                        <textarea value={data.notes || ''} onChange={e => setData({ ...data, notes: e.target.value })} className="w-full outline-none text-sm sm:text-base font-medium text-slate-900 dark:text-neutral-200 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent min-h-[60px] sm:min-h-[80px] resize-y" placeholder="Confirmation numbers, terminal, meeting points..." />
                    </div>

                    {/* Attachments Section */}
                    <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-neutral-800 transition-colors">
                        <div className="flex justify-between items-center mb-3">
                            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-neutral-300">Attachments</label>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-[10px] sm:text-xs text-indigo-700 dark:text-purple-300 bg-indigo-100 dark:bg-purple-900/20 hover:bg-indigo-200 dark:hover:bg-purple-900/40 px-2 sm:px-3 py-1.5 rounded-lg font-bold transition-colors"
                            >
                                + Add File
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,.pdf" />
                        </div>

                        {safeAttachments.length > 0 ? (
                            <div className="space-y-2">
                                {safeAttachments.map((att, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white dark:bg-neutral-950 p-2 sm:p-3 rounded-xl border border-slate-200 dark:border-neutral-800 text-xs sm:text-sm shadow-sm">
                                        <span className="flex items-center gap-2 sm:gap-3 truncate text-slate-700 dark:text-neutral-300 font-medium">
                                            {att?.type?.startsWith('image/') ? <ImageIcon size={14} className="text-indigo-500 dark:text-purple-400 shrink-0" /> : <FileText size={14} className="text-indigo-500 dark:text-purple-400 shrink-0" />}
                                            <span className="truncate max-w-[150px] sm:max-w-[250px]">{String(att?.name || '')}</span>
                                        </span>
                                        <button type="button" onClick={() => removeAttachment(i)} className="text-red-400 hover:text-red-600 p-1 bg-red-50 dark:bg-red-900/20 rounded-md transition-colors"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-3 sm:py-4 border-2 border-dashed border-slate-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-950 transition-colors">
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-700 font-medium">No files attached.</p>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 sm:pt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <button type="button" onClick={onClose} className="flex-1 px-6 py-3 sm:py-3.5 border-2 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-400 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors">Cancel</button>
                        <button type="submit" className="flex-1 px-6 py-3 sm:py-3.5 bg-indigo-600 dark:bg-purple-600 text-white rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-purple-700 transition-colors shadow-lg shadow-indigo-600/30">Save Event</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
