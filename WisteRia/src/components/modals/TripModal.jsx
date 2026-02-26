import React, { useState } from 'react';
import { X, Users, Calendar } from 'lucide-react';
import { generateId } from '../../utils/helpers';
import { CURRENCIES } from '../../utils/constants';
import DateRangePicker from '../ui/DateRangePicker';

export default function TripModal({ initialData, onClose, onSave }) {
    const [data, setData] = useState(() => {
        const defaultState = { title: '', destination: '', startDate: '', endDate: '', currency: 'USD' };
        return initialData ? { ...defaultState, ...initialData } : defaultState;
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!data.startDate || !data.endDate) {
            alert("Please select a date range for your trip.");
            return;
        }
        onSave(data);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-neutral-900 rounded-[2rem] w-full max-w-xl shadow-2xl my-auto overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-slate-100 dark:border-neutral-800 flex justify-between items-center bg-slate-50/50 dark:bg-neutral-950/50 transition-colors duration-300">
                    <h3 className="text-xl sm:text-2xl font-extrabold dark:text-white">Trip Details</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">

                    <div className="space-y-4">
                        <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Project Name</label>
                            <input required type="text" value={data.title || ''} onChange={e => setData({ ...data, title: e.target.value })} className="w-full outline-none text-base sm:text-lg font-bold text-slate-900 dark:text-neutral-50 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent" placeholder="e.g. Summer Eurotrip" />
                        </div>

                        <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Destination</label>
                            <input required type="text" value={data.destination || ''} onChange={e => setData({ ...data, destination: e.target.value })} className="w-full outline-none text-base sm:text-lg font-bold text-slate-900 dark:text-neutral-50 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent" placeholder="e.g. Paris, France" />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Budget Per Person</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <span className="text-slate-400 font-bold">{CURRENCIES.find(c => c.code === (data.currency || 'USD'))?.symbol || '$'}</span>
                                    </div>
                                    <input type="number" min="0" value={data.budget || ''} onChange={e => setData({ ...data, budget: Number(e.target.value) || '' })} className="w-full outline-none text-base font-bold text-slate-900 dark:text-neutral-50 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent pl-8" placeholder="0" />
                                </div>
                            </div>
                            <div className="flex-1 relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Number of People</label>
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-slate-400" />
                                    <input type="number" min="1" value={data.headcount || ''} onChange={e => setData({ ...data, headcount: Number(e.target.value) || '' })} className="w-full outline-none text-base font-bold text-slate-900 dark:text-neutral-50 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent" placeholder="1" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-2 sm:p-4 bg-white dark:bg-neutral-950 overflow-hidden transition-colors">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 sm:mb-4 flex items-center gap-1 px-2"><Calendar size={12} /> Select Dates</label>
                        <DateRangePicker
                            startDate={data.startDate || ''}
                            endDate={data.endDate || ''}
                            onChange={(dates) => setData({ ...data, ...dates })}
                        />
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <button type="button" onClick={onClose} className="flex-1 px-6 py-3 sm:py-3.5 border-2 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-400 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors">Cancel</button>
                        <button type="submit" className="flex-1 px-6 py-3 sm:py-3.5 bg-indigo-600 dark:bg-purple-600 text-white rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-purple-700 transition-colors shadow-lg shadow-indigo-600/30">
                            {initialData ? 'Save Changes' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
