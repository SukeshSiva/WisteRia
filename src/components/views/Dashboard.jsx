import React, { useState, useMemo } from 'react';
import { Sparkles, CalendarDays, MapPin, MoreVertical, Trash2, Archive, LayoutGrid, List, Calendar as CalendarIcon, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Clock, Search, X } from 'lucide-react';

export default function Dashboard({ userName, trips, onOpenTrip, onNewTrip, onDeleteTrip, onArchiveTrip, showDialog }) {
    const [viewMode, setViewMode] = useState('grid');
    const [showArchived, setShowArchived] = useState(false);
    const [menuOpen, setMenuOpen] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />;
    };

    const displayedTrips = useMemo(() => {
        return trips
            .filter(t => !!t.archived === showArchived)
            .filter(t => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                const matchesDate = (dateStr) => {
                    if (!dateStr) return false;
                    const d = new Date(dateStr);
                    if (isNaN(d)) return false;
                    const formats = [
                        d.toLocaleDateString(),
                        d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
                        d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
                        d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                        d.toLocaleDateString(undefined, { month: 'long' }),
                        d.toLocaleDateString(undefined, { month: 'short' }),
                        d.getFullYear().toString(),
                    ];
                    return formats.some(f => f.toLowerCase().includes(query));
                };
                return (t.title?.toLowerCase().includes(query)) ||
                    (t.destination?.toLowerCase().includes(query)) ||
                    matchesDate(t.startDate) ||
                    matchesDate(t.endDate) ||
                    matchesDate(t.createdAt);
            })
            .sort((a, b) => {
                let valA = a[sortConfig.key] || '';
                let valB = b[sortConfig.key] || '';

                if (sortConfig.key === 'createdAt' || sortConfig.key === 'startDate') {
                    valA = valA ? new Date(valA).getTime() : 0;
                    valB = valB ? new Date(valB).getTime() : 0;
                } else {
                    valA = String(valA).toLowerCase();
                    valB = String(valB).toLowerCase();
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
    }, [trips, showArchived, searchQuery, sortConfig]);

    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startOffset = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const days = [];
        for (let i = 0; i < startOffset; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
        while (days.length % 7 !== 0) days.push(null);

        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

        return (
            <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-neutral-800 animate-in fade-in">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex gap-2 items-center">
                        <select
                            value={month}
                            onChange={(e) => setCurrentMonth(new Date(year, parseInt(e.target.value), 1))}
                            className="text-xl sm:text-2xl h-10 font-extrabold text-slate-900 dark:text-white bg-transparent outline-none cursor-pointer appearance-none hover:text-indigo-600 dark:hover:text-purple-400 transition-colors"
                        >
                            {Array.from({ length: 12 }, (_, i) => {
                                const mDate = new Date(2000, i, 1);
                                return <option key={i} value={i} className="text-base text-slate-900">{mDate.toLocaleString('default', { month: 'long' })}</option>;
                            })}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setCurrentMonth(new Date(parseInt(e.target.value), month, 1))}
                            className="text-xl sm:text-2xl h-10 font-extrabold text-slate-900 dark:text-white bg-transparent outline-none cursor-pointer appearance-none hover:text-indigo-600 dark:hover:text-purple-400 transition-colors"
                        >
                            {years.map(y => <option key={y} value={y} className="text-base text-slate-900">{y}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2 bg-slate-100 dark:bg-neutral-800 rounded-xl p-1">
                        <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700 rounded-lg transition-all shadow-sm">
                            <ChevronLeft size={20} />
                        </button>
                        <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700 rounded-lg transition-all shadow-sm">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="bg-slate-50 dark:bg-neutral-950 p-2 sm:p-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">{d}</div>
                    ))}
                    {days.map((date, idx) => {
                        if (!date) return <div key={`empty-${idx}`} className="bg-slate-50/50 dark:bg-neutral-950/50 min-h-[100px] sm:min-h-[140px]" />;

                        const dayTrips = displayedTrips.filter(t => {
                            if (!t.startDate || !t.endDate) return false;
                            const s = new Date(t.startDate); s.setHours(0, 0, 0, 0);
                            const e = new Date(t.endDate); e.setHours(23, 59, 59, 999);
                            const mid = new Date(date); mid.setHours(12, 0, 0, 0);
                            return mid >= s && mid <= e;
                        });

                        return (
                            <div key={date.toISOString()} className="bg-white dark:bg-neutral-900 p-2 min-h-[100px] sm:min-h-[140px] border-t border-slate-200 dark:border-neutral-800 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                                <div className={`text-right text-xs sm:text-sm font-bold mb-1 ${date.toDateString() === new Date().toDateString() ? 'text-indigo-600 dark:text-purple-400' : 'text-slate-400 dark:text-neutral-500'}`}>
                                    {date.getDate()}
                                </div>
                                <div className="flex flex-col gap-1.5 mt-2 relative">
                                    {dayTrips.map(t => {
                                        const s = new Date(t.startDate); s.setHours(0, 0, 0, 0);
                                        const e = new Date(t.endDate); e.setHours(23, 59, 59, 999);
                                        const isStart = date.toDateString() === s.toDateString();
                                        const isEnd = date.toDateString() === e.toDateString();

                                        const showTitle = isStart || date.getDay() === 0;

                                        return (
                                            <div
                                                key={t.id}
                                                onClick={() => onOpenTrip(t.id)}
                                                className={`bg-indigo-100 dark:bg-purple-900/40 text-indigo-700 dark:text-purple-300 text-[10px] sm:text-xs font-bold px-2 py-1.5 truncate cursor-pointer hover:bg-indigo-200 dark:hover:bg-purple-800/60 transition-colors ${isStart ? 'rounded-l-lg ml-1' : '-ml-2 pl-3'
                                                    } ${isEnd ? 'rounded-r-lg mr-1' : '-mr-2 pr-3'
                                                    }`}
                                            >
                                                {showTitle ? t.title : '\u00A0'}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" onClick={() => setMenuOpen(null)}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-6">
                <div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-2">
                        {userName ? `Welcome, ${userName}` : 'Your Journeys'}
                    </h1>
                    <p className="text-slate-500 dark:text-neutral-400 text-lg font-medium delay-100 animate-in fade-in">
                        {displayedTrips.length} {displayedTrips.length === 1 ? 'project' : 'projects'} {showArchived ? 'archived' : 'planned'}
                    </p>
                </div>
                <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-purple-400 w-5 h-5 transition-colors duration-300" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-64 pl-12 pr-10 py-3.5 sm:py-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-purple-500 shadow-sm transition-all duration-300 font-medium"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
                            >
                                <div className="p-1 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                                    <X size={16} />
                                </div>
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onNewTrip}
                        className="w-full sm:w-auto bg-indigo-600 dark:bg-purple-600 hover:bg-indigo-700 dark:hover:bg-purple-700 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-xl shadow-indigo-600/20 dark:shadow-purple-600/20 shrink-0"
                    >
                        <Sparkles size={20} />
                        Create Project
                    </button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-neutral-800 pb-4">
                <div className="flex bg-slate-100 dark:bg-neutral-800/50 p-1 rounded-xl">
                    <button
                        onClick={() => setShowArchived(false)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!showArchived ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300'}`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => setShowArchived(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${showArchived ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300'}`}
                    >
                        Archived
                    </button>
                </div>
                <div className="flex bg-slate-100 dark:bg-neutral-800/50 p-1 rounded-xl hidden sm:flex">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300'}`}
                        title="Grid View"
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300'}`}
                        title="List View"
                    >
                        <List size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('calendar')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300'}`}
                        title="Calendar View"
                    >
                        <CalendarIcon size={18} />
                    </button>
                </div>
            </div>

            {displayedTrips.length === 0 ? (
                <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-12 sm:p-20 text-center border-2 border-dashed border-slate-200 dark:border-neutral-800 animate-in zoom-in-95 duration-700 transition-colors">
                    <div className="bg-slate-50 dark:bg-neutral-950 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner transition-colors">
                        <CalendarDays className="w-10 h-10 text-indigo-400 dark:text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3">
                        {searchQuery ? 'No matching projects' : (showArchived ? 'No archived trips' : 'No trips yet')}
                    </h3>
                    <p className="text-slate-500 dark:text-neutral-400 max-w-sm mx-auto font-medium text-lg leading-relaxed">
                        {searchQuery ? "Try adjusting your search terms." : (showArchived ? "When you archive a project, it will appear here." : "Ready for your next adventure? Create a project to start planning your itinerary.")}
                    </p>
                </div>
            ) : viewMode === 'calendar' ? (
                renderCalendar()
            ) : (
                <div className="w-full">

                    {/* List View Table Headers */}
                    {viewMode === 'list' && (
                        <div className="flex items-center px-4 sm:px-6 py-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-neutral-800">
                            <div className="flex-1 cursor-pointer hover:text-slate-600 dark:hover:text-neutral-200 flex items-center" onClick={() => handleSort('title')}>
                                Project Name <SortIcon columnKey="title" />
                            </div>
                            <div className="flex-1 cursor-pointer hover:text-slate-600 dark:hover:text-neutral-200 flex items-center hidden sm:flex" onClick={() => handleSort('destination')}>
                                Destination <SortIcon columnKey="destination" />
                            </div>
                            <div className="w-40 shrink-0 cursor-pointer hover:text-slate-600 dark:hover:text-neutral-200 flex items-center pl-4" onClick={() => handleSort('startDate')}>
                                Dates <SortIcon columnKey="startDate" />
                            </div>
                            <div className="w-32 shrink-0 cursor-pointer hover:text-slate-600 dark:hover:text-neutral-200 flex items-center hidden md:flex" onClick={() => handleSort('createdAt')}>
                                Created <SortIcon columnKey="createdAt" />
                            </div>
                            <div className="w-12 shrink-0"></div>
                        </div>
                    )}

                    <div className={viewMode === 'list' ? 'flex flex-col gap-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8'}>
                        {displayedTrips.map((trip, idx) => (
                            <div
                                key={trip.id}
                                onClick={() => onOpenTrip(trip.id)}
                                className={`group bg-white dark:bg-neutral-900 rounded-[2rem] shadow-sm hover:shadow-2xl border border-slate-200 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-purple-600/50 cursor-pointer transition-all duration-300 animate-in fade-in zoom-in-95 flex ${viewMode === 'grid' ? 'flex-col p-6 sm:p-8 h-full' : 'flex-row items-center p-3 sm:p-4 rounded-2xl'}`}
                                style={{ animationDelay: `${idx * 20}ms` }}
                            >
                                <div className={`${viewMode === 'grid' ? 'flex-1' : 'flex-1 flex flex-row items-center min-w-0 pr-4'}`}>
                                    <div className={`${viewMode === 'grid' ? 'flex items-start justify-between mb-4 sm:mb-6' : 'shrink-0 mr-4'}`}>
                                        <div className="bg-indigo-50 dark:bg-purple-900/20 text-indigo-600 dark:text-purple-400 p-3 rounded-2xl group-hover:bg-indigo-600 dark:group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                                            <MapPin size={viewMode === 'grid' ? 24 : 18} />
                                        </div>
                                        {viewMode === 'grid' && (
                                            <div className="relative" onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === trip.id ? null : trip.id); }}>
                                                <button className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-purple-400 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors">
                                                    <MoreVertical size={20} />
                                                </button>
                                                {menuOpen === trip.id && (
                                                    <div className="absolute top-10 right-0 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-slate-200 dark:border-neutral-700 p-2 z-20 w-40 flex flex-col gap-1">
                                                        <button onClick={(e) => { e.stopPropagation(); onArchiveTrip(trip.id, !trip.archived); setMenuOpen(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 rounded-lg transition-colors"><Archive size={16} /> {trip.archived ? 'Unarchive' : 'Archive'}</button>
                                                        <button onClick={async (e) => { e.stopPropagation(); const confirmed = await showDialog({ type: 'confirm', title: 'Delete Project', message: 'Are you sure you want to completely delete this project? This cannot be undone.', confirmText: 'Delete', danger: true }); if (confirmed) onDeleteTrip(trip.id); setMenuOpen(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /> Delete</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className={viewMode === 'list' ? 'flex-1 min-w-0 pr-4 flex flex-row items-center' : ''}>
                                        <div className={viewMode === 'list' ? 'flex-1 min-w-0' : ''}>
                                            <h3 className={`font-black text-slate-900 dark:text-white leading-tight group-hover:text-indigo-600 dark:group-hover:text-purple-400 transition-colors ${viewMode === 'grid' ? 'text-xl sm:text-2xl mb-2 line-clamp-2' : 'col-span-1 text-base truncate'}`}>
                                                {String(trip.title || '')}
                                            </h3>
                                        </div>
                                        {viewMode === 'list' && (
                                            <div className="flex-1 min-w-0 hidden sm:block text-slate-500 dark:text-neutral-400 font-medium truncate text-sm">
                                                {String(trip.destination || '')}
                                            </div>
                                        )}
                                        {viewMode === 'grid' && (
                                            <p className="text-slate-500 dark:text-neutral-400 font-medium line-clamp-1 text-sm sm:text-base mb-6">
                                                {String(trip.destination || '')}
                                            </p>
                                        )}
                                    </div>

                                    {viewMode === 'list' && (
                                        <div className="shrink-0 flex items-center gap-4 text-sm text-slate-500 dark:text-neutral-400 pr-2">
                                            <div className="flex items-center gap-1.5 w-40 border-l border-slate-200 dark:border-neutral-800 pl-4 font-bold">
                                                <CalendarDays size={14} className="shrink-0 text-slate-400" />
                                                <span className="truncate">{trip.startDate ? new Date(trip.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No dates'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 w-32 border-l border-slate-200 dark:border-neutral-800 pl-4 font-bold hidden md:flex text-xs">
                                                <Clock size={14} className="shrink-0 text-slate-400" />
                                                <span className="truncate">{trip.createdAt ? new Date(trip.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}</span>
                                            </div>
                                            <div className="relative w-8 flex justify-end" onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === trip.id ? null : trip.id); }}>
                                                <button className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-purple-400 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors">
                                                    <MoreVertical size={18} />
                                                </button>
                                                {menuOpen === trip.id && (
                                                    <div className="absolute top-8 right-0 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-slate-200 dark:border-neutral-700 p-2 z-20 w-40 flex flex-col gap-1">
                                                        <button onClick={(e) => { e.stopPropagation(); onArchiveTrip(trip.id, !trip.archived); setMenuOpen(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 rounded-lg transition-colors"><Archive size={16} /> {trip.archived ? 'Unarchive' : 'Archive'}</button>
                                                        <button onClick={async (e) => { e.stopPropagation(); const confirmed = await showDialog({ type: 'confirm', title: 'Delete Project', message: 'Are you sure you want to completely delete this project? This cannot be undone.', confirmText: 'Delete', danger: true }); if (confirmed) onDeleteTrip(trip.id); setMenuOpen(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /> Delete</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {viewMode === 'grid' && (
                                    <div className="pt-6 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-400 dark:text-neutral-500 transition-colors mt-auto">
                                        <div className="flex items-center gap-2">
                                            <CalendarDays size={16} />
                                            {trip.startDate ? new Date(trip.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No dates'}
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all text-indigo-600 dark:text-purple-400 flex items-center gap-1">
                                            Open <Sparkles size={14} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
