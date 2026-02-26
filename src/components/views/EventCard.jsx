import React from 'react';
import { Edit3, Trash2, Clock, Minus, Plus, MapPin, Image as ImageIcon, FileText } from 'lucide-react';
import { EVENT_COLORS, EVENT_ICONS } from '../../utils/constants';
import { formatDate, formatCurrency } from '../../utils/helpers';

export default function EventCard({ event, onEditEvent, onDeleteEvent, currency, onUpdateDuration, appendixItems, darkMode, getAttachmentUrl, highlighted }) {
    const colorClass = EVENT_COLORS[event.type] || EVENT_COLORS.other;

    const startMs = new Date(event.startTime).getTime();
    const endMs = event.endTime ? new Date(event.endTime).getTime() : startMs;
    const durationMins = Math.max(0, Math.round((endMs - startMs) / 60000));
    const hrs = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    const durationStr = hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`;

    return (
        <div
            className={`mb-8 relative group print:break-inside-avoid pdf-avoid-break transition-all ${highlighted ? 'clip-flash-active' : ''}`}
        >
            {/* Highlight flash animation style */}
            {highlighted && (
                <style>{`
                    @keyframes clipFlashRing {
                        0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.5); }
                        40% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.25); }
                        100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
                    }
                    .dark-theme @keyframes clipFlashRing {
                        0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.5); }
                        40% { box-shadow: 0 0 0 6px rgba(168, 85, 247, 0.25); }
                        100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
                    }
                    .clip-flash-active > div:nth-child(3) {
                        animation: clipFlashRing 0.8s ease-out;
                        border-color: rgb(99, 102, 241) !important;
                    }
                    .dark-theme .clip-flash-active > div:nth-child(3) {
                        border-color: rgb(168, 85, 247) !important;
                    }
                `}</style>
            )}
            {/* Timeline Dot */}
            <div title={new Date(event.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} className={`absolute left-[-1px] -translate-x-1/2 top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-[3px] sm:border-4 ${darkMode ? 'border-neutral-950' : 'border-white'} z-10 flex items-center justify-center ${colorClass} ${highlighted ? 'scale-125' : ''} transition-transform hover:scale-110 cursor-help`}>
                {React.cloneElement(EVENT_ICONS[event.type] || <FileText />, { className: "w-3 h-3 sm:w-4 sm:h-4" })}
            </div>

            <div className={`bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-6 ml-8 sm:ml-12 border shadow-sm hover:shadow-xl hover:border-indigo-200 dark:hover:border-purple-800 transition-all group-relative ${highlighted ? 'border-indigo-400 dark:border-purple-500 ring-2 ring-indigo-300/50 dark:ring-purple-500/30' : 'border-slate-200 dark:border-neutral-800'}`}>

                {/* Edit/Delete Buttons */}
                <div className="absolute top-2 right-2 sm:top-4 sm:right-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1 sm:gap-2 print:hidden">
                    <button onClick={() => onEditEvent(event)} className="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-purple-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-neutral-800 transition-colors">
                        <Edit3 size={14} className="sm:w-[16px] sm:h-[16px]" />
                    </button>
                    <button onClick={() => onDeleteEvent(event.id)} className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={14} className="sm:w-[16px] sm:h-[16px]" />
                    </button>
                </div>

                <div className="pl-4 sm:pl-4 pr-12 sm:pr-16">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-neutral-50 mb-2 leading-tight">{String(event.title || '')}</h3>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-500 dark:text-neutral-400 mb-3 sm:mb-4 font-medium">
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-neutral-800 px-2 sm:px-2.5 py-1 rounded-md border border-slate-100 dark:border-neutral-700">
                            <Clock size={12} className="text-indigo-500 dark:text-purple-400 sm:w-[14px] sm:h-[14px]" />
                            {formatDate(event.startTime)}
                            {event.endTime && <span className="hidden sm:inline"> - {new Date(event.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>

                        {/* Duration Changer */}
                        {event.endTime && (
                            <div className="flex items-center bg-slate-100 dark:bg-neutral-800 rounded-md border border-slate-200 dark:border-neutral-700 overflow-hidden print:hidden shrink-0">
                                <button onClick={() => onUpdateDuration(event.id, -15 * 60000)} className="px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 transition-colors" title="-15 mins">
                                    <Minus size={14} className="sm:w-[16px] sm:h-[16px]" />
                                </button>
                                <span className="px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-slate-700 dark:text-neutral-200 bg-white dark:bg-neutral-700 border-x border-slate-200 dark:border-neutral-600 select-none">
                                    {durationStr}
                                </span>
                                <button onClick={() => onUpdateDuration(event.id, 15 * 60000)} className="px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 transition-colors" title="+15 mins">
                                    <Plus size={14} className="sm:w-[16px] sm:h-[16px]" />
                                </button>
                            </div>
                        )}

                        {event.cost > 0 && (
                            <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 px-2 sm:px-2.5 py-1 rounded-md shrink-0">
                                {formatCurrency(event.cost, currency)}
                            </div>
                        )}
                    </div>

                    {event.notes && (
                        <div className="text-slate-600 dark:text-neutral-400 text-xs sm:text-sm mb-3 sm:mb-4 bg-slate-50 dark:bg-neutral-950 p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-neutral-800 leading-relaxed whitespace-pre-wrap">
                            {String(event.notes || '')}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 print:hidden">
                        {event.locationLink && (
                            <a
                                href={event.locationLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] sm:text-sm font-bold text-indigo-600 dark:text-purple-400 bg-indigo-50 dark:bg-purple-900/20 hover:bg-indigo-100 dark:hover:bg-purple-900/40 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-colors"
                            >
                                <MapPin size={14} className="sm:w-[16px] sm:h-[16px]" /> <span className="hidden sm:inline">View Map</span><span className="sm:hidden">Map</span>
                            </a>
                        )}
                        {Array.isArray(event.attachments) && event.attachments.map((att, i) => (
                            <a
                                key={i}
                                href={getAttachmentUrl ? getAttachmentUrl(att) : att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] sm:text-sm font-bold text-slate-700 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-colors max-w-[120px] sm:max-w-[250px]"
                            >
                                {att.type?.startsWith('image/') ? <ImageIcon size={14} className="shrink-0 sm:w-[16px] sm:h-[16px]" /> : <FileText size={14} className="shrink-0 sm:w-[16px] sm:h-[16px]" />}
                                <span className="truncate">{String(att.name || '')}</span>
                            </a>
                        ))}
                    </div>

                    {/* Print friendly attachments list & Appendix Linking */}
                    {((event.locationLink || (appendixItems && appendixItems.length > 0)) && (
                        <div className="hidden print:block mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
                            {event.locationLink && <div className="mb-1">📍 Map: {event.locationLink}</div>}
                            {appendixItems && appendixItems.length > 0 && (
                                <div className="space-y-1.5">
                                    {appendixItems.map((att, idx) => (
                                        <div key={idx} className="flex items-start gap-1">
                                            📎 {String(att.name || '')}
                                            <span className="text-indigo-600 font-bold ml-1">(See Appendix {att.refId})</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
