import React, { useState, useRef, useMemo } from 'react';
import {
  Plus, Edit3, Trash2, ChevronLeft, MapPin, CalendarDays,
  Map, Bus, Clock, LayoutList, BedDouble, FileText, Sparkles, X, Save, Download, Paperclip, Users, GitBranch, GitMerge, Anchor,
  Footprints, Sofa, Plane, Coffee, Train, Utensils, Search, ArrowUp, Target
} from 'lucide-react';
import EventCard from './EventCard';
import TimelineView from './TimelineView';
import VersionGraph from './VersionGraph';
import { EVENT_COLORS, EVENT_ICONS, CURRENCIES } from '../../utils/constants';
import { formatCurrency } from '../../utils/helpers';

export default function TripView({
  trip,
  currency,
  onBack,
  onEditTrip,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onMagicAdd,
  onUpdateDuration,
  onReorderList,
  onMoveEventToTime,
  onRestoreEvent,
  isExporting,
  darkMode,
  // Versioning & AI
  onChangeVersion,
  onCreateVersion,
  onRenameVersion,
  onDeleteVersion,
  onMergeVersions,
  onSetRoot,
  onAIEdit,
  onUniversalMagic,
  isAIEditing,
  getAttachmentUrl,
  showDialog
}) {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'edit' | 'cost'
  const displayMode = isExporting ? 'list' : viewMode;

  const [zoomLevel, setZoomLevel] = useState(60);
  const [insertIndex, setInsertIndex] = useState(null);
  const [inlineEditId, setInlineEditId] = useState(null);
  const [aiPromptText, setAiPromptText] = useState('');

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const universalFileInputRef = useRef(null);
  const [showGraph, setShowGraph] = useState(false);
  const [graphMergeMode, setGraphMergeMode] = useState(false);
  const [inlineMagicText, setInlineMagicText] = useState({});
  const [clipFlash, setClipFlash] = useState(false);
  const clipFlashTimerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleNodeVersionChange = (versionId) => {
    onChangeVersion(versionId);
    // Trigger a flash on all UI clips (event cards) to indicate node was selected
    if (clipFlashTimerRef.current) clearTimeout(clipFlashTimerRef.current);
    setClipFlash(true);
    clipFlashTimerRef.current = setTimeout(() => setClipFlash(false), 900);
  };

  const activeVersion = useMemo(() => trip?.versions?.find(v => v.id === trip.activeVersionId) || trip?.versions?.[0], [trip?.versions, trip?.activeVersionId]);

  const sortedEvents = useMemo(() => Array.isArray(activeVersion?.events)
    ? [...activeVersion.events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    : [], [activeVersion?.events]);

  const allAppendixItems = useMemo(() => {
    const items = [];
    let appendixIndex = 1;
    sortedEvents.forEach(event => {
      if (Array.isArray(event.attachments) && event.attachments.length > 0) {
        event.attachments.forEach(att => {
          items.push({ ...att, eventTitle: event.title, eventId: event.id, refId: appendixIndex++ });
        });
      }
    });
    return items;
  }, [sortedEvents]);

  const groupedEvents = useMemo(() => sortedEvents.reduce((acc, event) => {
    if (!event.startTime) return acc;
    const dateStr = new Date(event.startTime).toDateString();
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(event);
    return acc;
  }, {}), [sortedEvents]);

  // Generate ALL dates in the trip range for list view
  const allTripDates = useMemo(() => {
    const start = trip?.startDate ? new Date(trip.startDate) : null;
    const end = trip?.endDate ? new Date(trip.endDate) : null;
    if (!start || !end) return Object.keys(groupedEvents); // fallback
    const dates = [];
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    const endD = new Date(end);
    endD.setHours(23, 59, 59, 999);
    while (d <= endD) {
      dates.push(new Date(d).toDateString());
      d.setDate(d.getDate() + 1);
    }
    // Also include any event dates outside the trip range
    Object.keys(groupedEvents).forEach(dateStr => {
      if (!dates.includes(dateStr)) dates.push(dateStr);
    });
    return dates;
  }, [trip?.startDate, trip?.endDate, groupedEvents]);

  const costByCategory = useMemo(() => sortedEvents.reduce((acc, event) => {
    const cost = Number(event.cost) || 0;
    acc[event.type] = (acc[event.type] || 0) + cost;
    acc.total = (acc.total || 0) + cost;
    return acc;
  }, { total: 0 }), [sortedEvents]);

  const { earliestStart, latestEnd, totalMinutes, finalStart, tripDays } = useMemo(() => {
    const tripStart = new Date(trip?.startDate || new Date());
    tripStart.setHours(0, 0, 0, 0);
    let early = tripStart.getTime();
    let late = new Date(trip?.endDate || new Date()).getTime();

    sortedEvents.forEach(e => {
      const s = new Date(e.startTime).getTime();
      if (s < early) early = s;
      const endT = e.endTime ? new Date(e.endTime).getTime() : s + 3600000;
      if (endT > late) late = endT;
    });

    const fs = new Date(early); fs.setHours(0, 0, 0, 0);
    const fe = new Date(late); fe.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.round((fe - fs) / (1000 * 60 * 60 * 24)) + 1);
    const totalMins = days * 24 * 60;

    return { earliestStart: early, latestEnd: late, totalMinutes: totalMins, finalStart: fs, tripDays: days };
  }, [trip?.startDate, trip?.endDate, sortedEvents]);

  const handleAIRequest = () => {
    onAIEdit(aiPromptText);
    setAiPromptText('');
  };

  const jumpToToday = () => {
    const todayStr = new Date().toDateString();
    const el = document.getElementById(`date-${todayStr.replace(/\s+/g, '-')}`);
    if (el) {
      const yOffset = -80;
      const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      showDialog({ type: 'alert', title: 'Not in Trip', message: "Today's date is not within this trip." });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderTimelineEvent = (event, idx, arrayToCompare, isHighlighted = false) => {
    const startMs = new Date(event.startTime).getTime();
    const endMs = event.endTime ? new Date(event.endTime).getTime() : startMs + 3600000;
    const offsetMs = new Date(endMs).getTimezoneOffset() * 60000;
    const gapStartTime = new Date(endMs - offsetMs).toISOString().slice(0, 16);

    let gapMs = 0;
    let freeTimeDurStr = '';

    if (idx < arrayToCompare.length - 1) {
      const nextEvent = arrayToCompare[idx + 1];
      gapMs = new Date(nextEvent.startTime).getTime() - endMs;
    } else {
      // Last event: calculate gap to end of the day (midnight) or trip end, whichever is earlier
      const eventDay = new Date(event.startTime);
      eventDay.setHours(23, 59, 59, 999);
      const tripEndMs = trip?.endDate ? new Date(trip.endDate).setHours(23, 59, 59, 999) : eventDay.getTime();
      gapMs = Math.min(eventDay.getTime(), tripEndMs) - endMs;
    }

    if (gapMs > 0 && !searchQuery.trim()) {
      const hrs = Math.floor(gapMs / 3600000);
      const mins = Math.floor((gapMs % 3600000) / 60000);
      if (hrs > 0 || mins > 0) {
        freeTimeDurStr = hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`;
      }
    }

    const eventAppendixItems = allAppendixItems.filter(a => a.eventId === event.id);

    return (
      <React.Fragment key={event.id}>
        <EventCard
          event={event}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
          currency={currency}
          onUpdateDuration={onUpdateDuration}
          appendixItems={eventAppendixItems}
          darkMode={darkMode}
          getAttachmentUrl={getAttachmentUrl}
          highlighted={isHighlighted}
        />

        {freeTimeDurStr && (
          <div className="relative mb-8 -mt-4 print:hidden group/free pdf-avoid-break">
            <div className="absolute left-[-1px] -translate-x-1/2 top-4 w-5 h-5 rounded-full border-2 border-white dark:border-neutral-900 flex items-center justify-center bg-slate-200 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 z-10 group-hover/free:bg-purple-600 group-hover/free:border-purple-600 group-hover/free:text-white transition-colors">
              <Clock size={10} />
            </div>
            <div className="ml-8 sm:ml-12 bg-slate-50/50 dark:bg-neutral-900/50 border-2 border-slate-200 dark:border-neutral-800 border-dashed rounded-2xl p-3 flex flex-col justify-center hover:bg-indigo-50/50 dark:hover:bg-purple-900/10 hover:border-indigo-300 dark:hover:border-purple-600 transition-colors cursor-pointer"
              onClick={() => setInsertIndex(insertIndex === event.id ? null : event.id)}>
              <div className="flex justify-between items-center w-full">
                <span className="text-sm font-bold text-slate-500 group-hover/free:text-indigo-600 dark:group-hover/free:text-purple-400 flex items-center gap-2">
                  {freeTimeDurStr} Free Time
                </span>
                <span className="text-xs font-bold text-indigo-600 dark:text-purple-400 opacity-0 group-hover/free:opacity-100 flex items-center gap-1">
                  <Plus size={14} /> Fill time
                </span>
              </div>

              {insertIndex === event.id && (
                <div className="mt-3 animate-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={inlineMagicText[event.id] || ''}
                        onChange={e => setInlineMagicText(prev => ({ ...prev, [event.id]: e.target.value }))}
                        placeholder="e.g. Coffee break, sightseeing..."
                        className="w-full bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-purple-500 focus:border-transparent"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && inlineMagicText[event.id]?.trim()) {
                            if (onUniversalMagic) onUniversalMagic(inlineMagicText[event.id] + ` (at ${gapStartTime})`);
                            setInlineMagicText(prev => ({ ...prev, [event.id]: '' }));
                            setInsertIndex(null);
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={() => {
                        const text = inlineMagicText[event.id]?.trim();
                        if (text && onUniversalMagic) {
                          onUniversalMagic(text + ` (at ${gapStartTime})`);
                        } else {
                          onMagicAdd(gapStartTime);
                        }
                        setInlineMagicText(prev => ({ ...prev, [event.id]: '' }));
                        setInsertIndex(null);
                      }}
                      className="shrink-0 bg-indigo-600 dark:bg-purple-600 text-white p-2 rounded-xl hover:bg-indigo-700 dark:hover:bg-purple-700 transition-colors shadow-sm"
                      title="AI Magic"
                    >
                      <Sparkles size={16} />
                    </button>
                    <button
                      onClick={() => {
                        onAddEvent({ startTime: gapStartTime });
                        setInsertIndex(null);
                      }}
                      className="shrink-0 bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 p-2 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
                      title="Add manually"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-600 uppercase tracking-wider">Quick:</span>
                    <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Rest', type: 'rest', startTime: gapStartTime }); }} className="text-[10px] font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-2 py-1 rounded-lg transition-colors"><Sofa size={10} /> Rest</button>
                    <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Travel', type: 'bus', startTime: gapStartTime }); }} className="text-[10px] font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-2 py-1 rounded-lg transition-colors"><Bus size={10} /> Travel</button>
                    <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Walk around', type: 'walking', startTime: gapStartTime }); }} className="text-[10px] font-bold flex items-center gap-1 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40 px-2 py-1 rounded-lg transition-colors"><Footprints size={10} /> Walk</button>
                    <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Shopping', type: 'activity', startTime: gapStartTime }); }} className="text-[10px] font-bold flex items-center gap-1 bg-indigo-50 dark:bg-purple-900/20 text-indigo-600 dark:text-purple-400 hover:bg-indigo-100 dark:hover:bg-purple-900/40 px-2 py-1 rounded-lg transition-colors"><MapPin size={10} /> Shop</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 print:hidden">
        <button onClick={onBack} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-neutral-50 transition-colors font-medium">
          <ChevronLeft size={16} /> Back to Projects
        </button>

        <div className="flex items-center bg-white dark:bg-neutral-900 rounded-2xl p-1.5 border border-slate-200 dark:border-neutral-800 shadow-sm flex-wrap gap-1.5">
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-neutral-800 py-1.5 px-3 rounded-xl border border-slate-100 dark:border-neutral-700">
            <select
              value={trip.activeVersionId}
              onChange={e => onChangeVersion(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 dark:text-neutral-300 outline-none cursor-pointer border-none min-w-[120px]"
            >
              {trip.versions?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <div className="w-px h-4 bg-slate-300 dark:bg-neutral-600 mx-1"></div>
            <button onClick={() => onRenameVersion(trip.activeVersionId)} className="text-slate-400 hover:text-indigo-600 dark:hover:text-purple-400 transition-colors p-1" title="Rename Version"><Edit3 size={14} /></button>
            <button onClick={() => onDeleteVersion(trip.activeVersionId)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1" title="Delete Version"><Trash2 size={14} /></button>
          </div>
          <button onClick={async () => {
            const name = await showDialog({
              type: 'prompt',
              title: 'Fork Version',
              message: 'Enter a name for the new version (leave blank for automatic name):',
              defaultValue: '',
              placeholder: 'Version name',
              confirmText: 'Create'
            });
            if (name === null) return; // cancelled
            onCreateVersion(name || undefined);
          }} className="bg-indigo-50 dark:bg-purple-900/20 px-3 py-2 rounded-xl text-indigo-600 dark:text-purple-400 hover:bg-indigo-100 dark:hover:bg-purple-900/40 transition-colors shrink-0 flex items-center gap-1.5 border border-indigo-100 dark:border-purple-800" title="Save as New Version">
            <Save size={16} /> <span className="text-xs font-bold hidden sm:inline px-1">Fork</span>
          </button>
          <button
            onClick={() => setShowGraph(!showGraph)}
            className={`px-3 py-2 rounded-xl transition-colors shrink-0 flex items-center gap-1.5 border ${showGraph ? 'bg-indigo-600 dark:bg-purple-600 text-white border-indigo-600 dark:border-purple-600' : 'bg-slate-50 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 border-slate-200 dark:border-neutral-700'}`}
            title="Version Graph"
          >
            <GitBranch size={16} /> <span className="text-xs font-bold hidden sm:inline px-1">Graph</span>
          </button>
        </div>
      </div >

      {/* Version Graph Panel */}
      {
        showGraph && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300 print:hidden">
            <VersionGraph
              versions={trip.versions}
              activeVersionId={trip.activeVersionId}
              externalMergeMode={graphMergeMode}
              onExternalMergeModeChange={setGraphMergeMode}
              onChangeVersion={handleNodeVersionChange}
              onCreateVersion={onCreateVersion}
              onRenameVersion={onRenameVersion}
              onDeleteVersion={onDeleteVersion}
              onMergeVersions={onMergeVersions}
              onSetRoot={onSetRoot}
              showDialog={showDialog}
            />
          </div>
        )
      }

      <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-6 sm:p-8 border border-slate-200 dark:border-neutral-800 shadow-sm mb-6 print:border-none print:shadow-none print:p-0 print:mb-6 relative group pdf-avoid-break transition-colors duration-300">
        <button
          onClick={onEditTrip}
          className="absolute top-6 sm:top-8 right-6 sm:right-8 text-slate-400 hover:text-indigo-600 dark:hover:text-purple-400 bg-slate-50 dark:bg-neutral-800 hover:bg-slate-50 p-2 rounded-xl transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 print:hidden"
          title="Edit Project Details"
        >
          <Edit3 size={20} />
        </button>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-neutral-50 mb-4 pr-12 break-words leading-tight">{String(trip?.title || '')}</h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-slate-600">
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-purple-900/20 text-indigo-700 dark:text-purple-300 px-3 sm:px-4 py-2 rounded-xl text-sm sm:text-base w-full sm:w-auto">
            <MapPin size={18} className="shrink-0" />
            <span className="font-bold truncate">{String(trip?.destination || '')}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 px-3 sm:px-4 py-2 rounded-xl text-sm sm:text-base w-full sm:w-auto">
            <CalendarDays size={18} className="text-slate-500 dark:text-neutral-400 shrink-0" />
            <span className="font-medium truncate text-slate-600 dark:text-neutral-300">
              {trip?.startDate ? new Date(trip.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}
              {' to '}
              {trip?.endDate ? new Date(trip.endDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: '2-digit' }) : ''}
            </span>
          </div>
          {costByCategory.total > 0 && (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 sm:px-4 py-2 rounded-xl text-sm sm:text-base w-full sm:w-auto cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => setViewMode('cost')} title="View detailed cost breakdown">
              <span className="font-black text-emerald-700 dark:text-emerald-400">
                {formatCurrency(costByCategory.total, currency)}
              </span>
              <span className="text-emerald-600/70 dark:text-emerald-500/70 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Spent</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8 items-stretch print:hidden">
        <div className="flex-1 bg-indigo-50 dark:bg-purple-900/10 border border-indigo-100 dark:border-purple-900/30 rounded-[1.5rem] p-4 flex flex-col shadow-sm transition-colors duration-300">
          <textarea
            rows={4}
            value={aiPromptText}
            onChange={e => setAiPromptText(e.target.value)}
            disabled={isAIEditing}
            placeholder="Paste a map link, describe itinerary changes, or upload a ticket/receipt..."
            className={`w-full bg-transparent border-none outline-none text-sm sm:text-base font-bold resize-none min-h-[80px] ${isAIEditing ? 'text-slate-400 dark:text-neutral-500 cursor-not-allowed placeholder:text-slate-300 dark:placeholder:text-neutral-600' : 'text-slate-700 dark:text-neutral-100 placeholder:text-indigo-300 dark:placeholder:text-purple-300/40'}`}
          />

          {previewUrl && (
            <div className="relative inline-block mt-2 max-w-[120px] bg-slate-100 rounded-lg p-2 border border-slate-200">
              {selectedFile?.type === 'application/pdf' ? (
                <div className="flex flex-col items-center justify-center text-slate-500 h-16 px-2 w-full truncate">
                  <FileText size={24} className="text-indigo-400 mb-1" />
                  <span className="text-[10px] truncate max-w-full">{selectedFile.name}</span>
                </div>
              ) : (
                <img src={previewUrl} alt="Preview" className={`h-16 rounded-lg object-cover ${isAIEditing ? 'opacity-50 grayscale' : ''}`} />
              )}
              <button disabled={isAIEditing} onClick={() => { setPreviewUrl(''); setSelectedFile(null); }} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-full p-1 shadow-md disabled:opacity-50"><X size={12} /></button>
            </div>
          )}

          <div className="flex justify-between items-end mt-4">
            <div>
              <input ref={universalFileInputRef} type="file" disabled={isAIEditing} className="hidden" accept="image/*,.pdf" value="" onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
                  showDialog({ type: 'alert', title: 'Invalid File', message: 'Please upload an image file or PDF.' });
                  return;
                }

                setSelectedFile(file);
                const reader = new FileReader();
                reader.onloadend = () => setPreviewUrl(reader.result);
                reader.readAsDataURL(file);
              }} />
              <button disabled={isAIEditing} onClick={() => universalFileInputRef.current?.click()} className="flex items-center gap-2 text-indigo-600 dark:text-purple-400 hover:bg-indigo-100 dark:hover:bg-purple-900/30 px-3 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Paperclip size={18} /> <span className="hidden sm:inline">Upload Files</span>
              </button>
            </div>
            <button
              onClick={async () => {
                try {
                  if (onUniversalMagic) {
                    await onUniversalMagic(aiPromptText, selectedFile, previewUrl);
                  } else if (onAIEdit) {
                    await onAIEdit(aiPromptText);
                  }
                  // Clear prompt ONLY upon successful execution
                  setAiPromptText('');
                  setSelectedFile(null);
                  setPreviewUrl('');
                } catch (e) {
                  console.error("AI processing failed", e);
                }
              }}
              disabled={isAIEditing || (!aiPromptText.trim() && !selectedFile)}
              className="bg-indigo-600 dark:bg-purple-600 hover:bg-indigo-700 dark:hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-extrabold transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isAIEditing ? <><span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-4 h-4"></span> Processing...</> : <><Sparkles size={18} /> Process</>}
            </button>
          </div>
        </div>

        <button
          onClick={() => onAddEvent(null)}
          className="w-full sm:w-48 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white rounded-[1.5rem] flex flex-col items-center justify-center gap-2 font-bold shadow-sm transition-all hover:scale-[1.02] p-6 shrink-0"
        >
          <Plus size={32} className="text-indigo-600 dark:text-purple-400" />
          <span className="text-center text-sm">Manual Add</span>
        </button>
      </div>

      <div className="w-full relative">
        <div className="flex flex-wrap justify-center sm:justify-start items-center mb-8 print:hidden w-full gap-4 relative">
          <div className="bg-white dark:bg-neutral-900 p-2 rounded-2xl flex items-center flex-nowrap gap-2 max-w-full overflow-x-auto shadow-sm border border-slate-200 dark:border-neutral-800 scrollbar-hide z-10 w-full sm:w-auto">
            <button
              onClick={() => setViewMode('list')}
              className={`flex-none flex justify-center items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${displayMode === 'list' ? 'bg-indigo-50 dark:bg-purple-900/20 text-indigo-700 dark:text-purple-300' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-100 hover:bg-slate-50 dark:hover:bg-neutral-800/50'}`}
            ><LayoutList size={16} /> <span>Live List</span></button>
            <div className="w-px h-6 bg-slate-200 dark:bg-neutral-800 mx-1 flex-none"></div>
            <button
              onClick={() => setViewMode(viewMode === 'edit' ? 'list' : 'edit')}
              className={`flex-none flex justify-center items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${displayMode === 'edit' ? 'bg-indigo-600 dark:bg-purple-600 text-white shadow-md' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-100 hover:bg-slate-50 dark:hover:bg-neutral-800/50'}`}
            ><Edit3 size={16} /> {displayMode === 'edit' ? 'Exit Edit' : <span>Timeline</span>}</button>
            <div className="w-px h-6 bg-slate-200 dark:bg-neutral-800 mx-1 flex-none"></div>
            <button
              onClick={() => setViewMode('cost')}
              className={`flex-none flex justify-center items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${displayMode === 'cost' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-100 hover:bg-slate-50 dark:hover:bg-neutral-800/50'}`}
            ><span className="text-base font-black px-1">{CURRENCIES.find(c => c.code === currency)?.symbol || '$'}</span> <span>Cost</span></button>
          </div>

          {(displayMode === 'list' || displayMode === 'edit') && (
            <div className="flex-1 min-w-[200px] max-w-md relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="text-slate-400 group-focus-within:text-indigo-500 dark:group-focus-within:text-purple-400 w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-300" />
              </div>
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-10 py-2.5 sm:py-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-purple-500 shadow-sm transition-all duration-300 font-medium text-sm sm:text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
                >
                  <div className="p-1 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                    <X size={14} className="sm:w-4 sm:h-4" />
                  </div>
                </button>
              )}
            </div>
          )}

          {displayMode === 'edit' && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-neutral-800 p-1 rounded-2xl shadow-inner shrink-0 z-0">
              <button onClick={() => setZoomLevel(z => Math.max(30, z - 15))} className="p-2 hover:bg-white dark:hover:bg-neutral-700 rounded-xl text-slate-600 dark:text-neutral-400">-</button>
              <span className="text-xs font-bold w-12 text-center text-slate-500 select-none">{Math.round((zoomLevel / 60) * 100)}%</span>
              <button onClick={() => setZoomLevel(z => Math.min(240, z + 15))} className="p-2 hover:bg-white dark:hover:bg-neutral-700 rounded-xl text-slate-600 dark:text-neutral-400">+</button>
            </div>
          )}
        </div>

        {sortedEvents.length === 0 && displayMode !== 'edit' ? (
          <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-neutral-900 dark:to-neutral-900/50 rounded-[2rem] p-12 text-center border-2 border-dashed border-indigo-200 dark:border-neutral-800 print:hidden transition-all shadow-sm flex flex-col items-center justify-center min-h-[400px]">
            <div className="bg-indigo-100 dark:bg-purple-900/30 p-4 rounded-full mb-6">
              <Sparkles className="w-12 h-12 text-indigo-500 dark:text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-neutral-200 mb-2">Let's build your itinerary!</h3>
            <p className="text-slate-500 dark:text-neutral-400 font-medium mb-8 max-w-md mx-auto">Your trip is currently empty. Start by adding your first event manually or use the AI magic box above to plan your days.</p>
            <button onClick={() => onAddEvent(null)} className="bg-indigo-600 dark:bg-purple-600 hover:bg-indigo-700 dark:hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center gap-2">
              <Plus size={20} /> Add First Event
            </button>
          </div>
        ) : displayMode === 'edit' ? (
          <TimelineView
            sortedEvents={sortedEvents}
            trip={trip}
            currency={currency}
            darkMode={darkMode}
            zoomLevel={zoomLevel}
            finalStart={finalStart}
            tripDays={tripDays}
            totalMinutes={totalMinutes}
            searchQuery={searchQuery}
            onAddEvent={onAddEvent}
            onEditEvent={onEditEvent}
            onDeleteEvent={onDeleteEvent}
            onMoveEventToTime={onMoveEventToTime}
            onRestoreEvent={onRestoreEvent}
            onUpdateDuration={onUpdateDuration}
            onMagicAdd={onMagicAdd}
            onUniversalMagic={onUniversalMagic}
          />
        ) : displayMode === 'list' ? (
          <div className="space-y-10">
            {allTripDates.map((dateStr, index) => {
              const dayEvents = groupedEvents[dateStr] || [];
              const q = searchQuery.toLowerCase().trim();
              const visibleEvents = q ? dayEvents.filter(e =>
                (e.title || '').toLowerCase().includes(q) ||
                (e.type || '').toLowerCase().includes(q) ||
                (e.description || '').toLowerCase().includes(q)
              ) : dayEvents;

              if (q && visibleEvents.length === 0) return null;

              const hasEvents = dayEvents.length > 0;
              const dateObj = new Date(dateStr);
              const offsetMs = dateObj.getTimezoneOffset() * 60000;

              return (
                <div key={dateStr} id={`date-${dateStr.replace(/\s+/g, '-')}`} className="print:break-inside-avoid pdf-avoid-break">
                  <div className="flex items-center gap-4 mb-6 sticky top-16 bg-slate-50/90 dark:bg-neutral-950/90 backdrop-blur py-2 z-20 print:static">
                    <div className={`text-white text-xs sm:text-sm font-bold px-3 py-1 rounded-lg ${hasEvents ? 'bg-indigo-600 dark:bg-purple-600' : 'bg-slate-400 dark:bg-neutral-600'}`}>Day {index + 1}</div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-neutral-50 flex items-center gap-2"><CalendarDays size={20} className={hasEvents ? 'text-indigo-400' : 'text-slate-300 dark:text-neutral-600'} />{dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                    <div className="h-px bg-slate-200 dark:bg-neutral-800 flex-1 hidden sm:block"></div>
                  </div>

                  {!hasEvents && !q ? (
                    /* Full free day */
                    <div className="relative border-l-2 border-slate-200 dark:border-neutral-800 ml-4 sm:ml-8 pt-2 pb-4 transition-colors duration-300">
                      <div className="relative mb-4 print:hidden group/free pdf-avoid-break">
                        <div className="absolute left-[-1px] -translate-x-1/2 top-4 w-5 h-5 rounded-full border-2 border-white dark:border-neutral-900 flex items-center justify-center bg-slate-200 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 z-10 group-hover/free:bg-purple-600 group-hover/free:border-purple-600 group-hover/free:text-white transition-colors">
                          <Clock size={10} />
                        </div>
                        <div className="ml-8 sm:ml-12 bg-slate-50/50 dark:bg-neutral-900/50 border-2 border-slate-200 dark:border-neutral-800 border-dashed rounded-2xl p-4 flex flex-col justify-center hover:bg-indigo-50/50 dark:hover:bg-purple-900/10 hover:border-indigo-300 dark:hover:border-purple-600 transition-colors cursor-pointer"
                          onClick={() => setInsertIndex(insertIndex === `free-${dateStr}` ? null : `free-${dateStr}`)}>
                          <div className="flex justify-between items-center w-full">
                            <span className="text-sm font-bold text-slate-400 dark:text-neutral-500 group-hover/free:text-indigo-600 dark:group-hover/free:text-purple-400 flex items-center gap-2">
                              <Clock size={14} /> Free Day — No events planned
                            </span>
                            <span className="text-xs font-bold text-indigo-600 dark:text-purple-400 opacity-0 group-hover/free:opacity-100 flex items-center gap-1">
                              <Plus size={14} /> Add event
                            </span>
                          </div>
                          {insertIndex === `free-${dateStr}` && (
                            <div className="mt-3 animate-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 relative">
                                  <input
                                    type="text"
                                    value={inlineMagicText[`free-${dateStr}`] || ''}
                                    onChange={e => setInlineMagicText(prev => ({ ...prev, [`free-${dateStr}`]: e.target.value }))}
                                    placeholder="e.g. Visit local museum, lunch at café..."
                                    className="w-full bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-purple-500 focus:border-transparent"
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && inlineMagicText[`free-${dateStr}`]?.trim()) {
                                        const t = new Date(dateObj.getTime() + 9 * 3600000 - offsetMs).toISOString().slice(0, 16);
                                        if (onUniversalMagic) onUniversalMagic(inlineMagicText[`free-${dateStr}`] + ` (at ${t})`);
                                        setInlineMagicText(prev => ({ ...prev, [`free-${dateStr}`]: '' }));
                                        setInsertIndex(null);
                                      }
                                    }}
                                    autoFocus
                                  />
                                </div>
                                <button
                                  onClick={() => {
                                    const t = new Date(dateObj.getTime() + 9 * 3600000 - offsetMs).toISOString().slice(0, 16);
                                    const text = inlineMagicText[`free-${dateStr}`]?.trim();
                                    if (text && onUniversalMagic) {
                                      onUniversalMagic(text + ` (at ${t})`);
                                    } else {
                                      onMagicAdd(t);
                                    }
                                    setInlineMagicText(prev => ({ ...prev, [`free-${dateStr}`]: '' }));
                                    setInsertIndex(null);
                                  }}
                                  className="shrink-0 bg-indigo-600 dark:bg-purple-600 text-white p-2 rounded-xl hover:bg-indigo-700 dark:hover:bg-purple-700 transition-colors shadow-sm"
                                  title="AI Magic"
                                >
                                  <Sparkles size={16} />
                                </button>
                                <button
                                  onClick={() => {
                                    const t = new Date(dateObj.getTime() + 9 * 3600000 - offsetMs).toISOString().slice(0, 16);
                                    onAddEvent({ startTime: t });
                                    setInsertIndex(null);
                                  }}
                                  className="shrink-0 bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 p-2 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
                                  title="Add manually"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                              <div className="flex items-center flex-wrap gap-1.5 mt-2">
                                <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-600 uppercase tracking-wider">Quick:</span>
                                {(() => {
                                  const t = new Date(dateObj.getTime() + 9 * 3600000 - offsetMs).toISOString().slice(0, 16); return (<>
                                    <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Rest', type: 'rest', startTime: t }); }} className="text-[10px] font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-2 py-1 rounded-lg transition-colors"><Sofa size={10} /> Rest</button>
                                    <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Travel', type: 'bus', startTime: t }); }} className="text-[10px] font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-2 py-1 rounded-lg transition-colors"><Bus size={10} /> Travel</button>
                                    <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Walk around', type: 'walking', startTime: t }); }} className="text-[10px] font-bold flex items-center gap-1 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40 px-2 py-1 rounded-lg transition-colors"><Footprints size={10} /> Walk</button>
                                    <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Shopping', type: 'activity', startTime: t }); }} className="text-[10px] font-bold flex items-center gap-1 bg-indigo-50 dark:bg-purple-900/20 text-indigo-600 dark:text-purple-400 hover:bg-indigo-100 dark:hover:bg-purple-900/40 px-2 py-1 rounded-lg transition-colors"><MapPin size={10} /> Shop</button>
                                  </>);
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-slate-200 dark:border-neutral-800 ml-4 sm:ml-8 pt-2 pb-4 transition-colors duration-300">
                      {(() => {
                        const firstEvent = dayEvents[0];
                        const dayStart = new Date(dateStr);
                        dayStart.setHours(0, 0, 0, 0);
                        const firstStartMs = new Date(firstEvent.startTime).getTime();
                        const preGapMs = firstStartMs - dayStart.getTime();
                        if (preGapMs > 0) {
                          const hrs = Math.floor(preGapMs / 3600000);
                          const mins = Math.floor((preGapMs % 3600000) / 60000);
                          const durStr = hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`;
                          const preGapStartTime = new Date(dayStart.getTime() - offsetMs).toISOString().slice(0, 16);
                          const preId = `pre-${dateStr}`;
                          return (
                            <div className="relative mb-8 print:hidden group/free pdf-avoid-break">
                              <div className="absolute left-[-1px] -translate-x-1/2 top-4 w-5 h-5 rounded-full border-2 border-white dark:border-neutral-900 flex items-center justify-center bg-slate-200 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 z-10 group-hover/free:bg-purple-600 group-hover/free:border-purple-600 group-hover/free:text-white transition-colors">
                                <Clock size={10} />
                              </div>
                              <div className="ml-8 sm:ml-12 bg-slate-50/50 dark:bg-neutral-900/50 border-2 border-slate-200 dark:border-neutral-800 border-dashed rounded-2xl p-3 flex flex-col justify-center hover:bg-indigo-50/50 dark:hover:bg-purple-900/10 hover:border-indigo-300 dark:hover:border-purple-600 transition-colors cursor-pointer"
                                onClick={() => setInsertIndex(insertIndex === preId ? null : preId)}>
                                <div className="flex justify-between items-center w-full">
                                  <span className="text-sm font-bold text-slate-500 group-hover/free:text-indigo-600 dark:group-hover/free:text-purple-400 flex items-center gap-2">
                                    {durStr} Free Time
                                  </span>
                                  <span className="text-xs font-bold text-indigo-600 dark:text-purple-400 opacity-0 group-hover/free:opacity-100 flex items-center gap-1">
                                    <Plus size={14} /> Fill time
                                  </span>
                                </div>
                                {insertIndex === preId && (
                                  <div className="mt-3 animate-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 relative">
                                        <input
                                          type="text"
                                          value={inlineMagicText[preId] || ''}
                                          onChange={e => setInlineMagicText(prev => ({ ...prev, [preId]: e.target.value }))}
                                          placeholder="e.g. Morning jog, breakfast..."
                                          className="w-full bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-purple-500 focus:border-transparent"
                                          onKeyDown={e => {
                                            if (e.key === 'Enter' && inlineMagicText[preId]?.trim()) {
                                              if (onUniversalMagic) onUniversalMagic(inlineMagicText[preId] + ` (at ${preGapStartTime})`);
                                              setInlineMagicText(prev => ({ ...prev, [preId]: '' }));
                                              setInsertIndex(null);
                                            }
                                          }}
                                          autoFocus
                                        />
                                      </div>
                                      <button
                                        onClick={() => {
                                          const text = inlineMagicText[preId]?.trim();
                                          if (text && onUniversalMagic) {
                                            onUniversalMagic(text + ` (at ${preGapStartTime})`);
                                          } else {
                                            onMagicAdd(preGapStartTime);
                                          }
                                          setInlineMagicText(prev => ({ ...prev, [preId]: '' }));
                                          setInsertIndex(null);
                                        }}
                                        className="shrink-0 bg-indigo-600 dark:bg-purple-600 text-white p-2 rounded-xl hover:bg-indigo-700 dark:hover:bg-purple-700 transition-colors shadow-sm"
                                        title="AI Magic"
                                      >
                                        <Sparkles size={16} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          onAddEvent({ startTime: preGapStartTime });
                                          setInsertIndex(null);
                                        }}
                                        className="shrink-0 bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 p-2 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
                                        title="Add manually"
                                      >
                                        <Plus size={16} />
                                      </button>
                                    </div>
                                    <div className="flex items-center flex-wrap gap-1.5 mt-2">
                                      <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-600 uppercase tracking-wider">Quick:</span>
                                      <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Rest', type: 'rest', startTime: preGapStartTime }); }} className="text-[10px] font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-2 py-1 rounded-lg transition-colors"><Sofa size={10} /> Rest</button>
                                      <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Travel', type: 'bus', startTime: preGapStartTime }); }} className="text-[10px] font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-2 py-1 rounded-lg transition-colors"><Bus size={10} /> Travel</button>
                                      <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Walk around', type: 'walking', startTime: preGapStartTime }); }} className="text-[10px] font-bold flex items-center gap-1 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40 px-2 py-1 rounded-lg transition-colors"><Footprints size={10} /> Walk</button>
                                      <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Shopping', type: 'activity', startTime: preGapStartTime }); }} className="text-[10px] font-bold flex items-center gap-1 bg-indigo-50 dark:bg-purple-900/20 text-indigo-600 dark:text-purple-400 hover:bg-indigo-100 dark:hover:bg-purple-900/40 px-2 py-1 rounded-lg transition-colors"><MapPin size={10} /> Shop</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {visibleEvents.map((event, idx) => renderTimelineEvent(event, idx, dayEvents, clipFlash))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : displayMode === 'cost' ? (
          <div className="w-full max-w-5xl mx-auto pt-4 animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-neutral-800 transition-colors duration-300">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 pb-6 border-b border-slate-100 dark:border-neutral-800">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3 text-slate-900 dark:text-neutral-50"><span className="text-emerald-500 text-3xl">{CURRENCIES.find(c => c.code === currency)?.symbol || '$'}</span> Budget & Expenses</h2>
                  <p className="text-slate-500 dark:text-neutral-400 font-medium text-sm mt-1 flex items-center gap-2">
                    Based on {trip?.headcount || 1} {trip?.headcount === 1 ? 'person' : 'people'}
                  </p>
                </div>
              </div>

              {/* Top Level Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                {/* Overall Budget Card */}
                <div className="bg-slate-50 dark:bg-neutral-950 p-6 rounded-3xl border border-slate-200 dark:border-neutral-800 relative overflow-hidden group transition-colors duration-300">
                  <div className="absolute top-[-20%] right-[-10%] p-4 opacity-10 group-hover:opacity-20 transition-opacity flex items-center justify-center">
                    <span className="text-[12rem] text-emerald-500 font-black leading-none">{CURRENCIES.find(c => c.code === currency)?.symbol || '$'}</span>
                  </div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-sm font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Overall Trip</p>
                        <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                          {formatCurrency(costByCategory.total, currency)}
                        </h3>
                        <p className="text-sm font-bold text-slate-400 mt-1">spent of {formatCurrency((trip?.budget || 0) * (trip?.headcount || 1), currency)} total</p>
                      </div>
                    </div>

                    {/* Progress Bar Overall */}
                    {(() => {
                      const overallTotal = (trip?.budget || 0) * (trip?.headcount || 1);
                      const overallSpent = costByCategory.total;
                      const overallPct = overallTotal > 0 ? Math.min((overallSpent / overallTotal) * 100, 100) : 0;
                      const isOverBudget = overallTotal > 0 && overallSpent > overallTotal;

                      return (
                        <div className="mt-4">
                          <div className="flex justify-between text-xs font-bold mb-2">
                            <span className={isOverBudget ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}>
                              {isOverBudget ? 'Over Budget!' : `${(100 - overallPct).toFixed(1)}% Remaining`}
                            </span>
                            <span className="text-slate-500">{overallPct.toFixed(1)}% Used</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-neutral-800 rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${isOverBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
                              style={{ width: `${overallPct}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Per Person Card */}
                <div className="bg-slate-50 dark:bg-neutral-950 p-6 rounded-3xl border border-slate-200 dark:border-neutral-800 relative overflow-hidden group transition-colors duration-300">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Users className="w-24 h-24 text-indigo-500" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-sm font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Per Person</p>
                        <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                          {formatCurrency(costByCategory.total / (trip?.headcount || 1), currency)}
                        </h3>
                        <p className="text-sm font-bold text-slate-400 mt-1">spent of {formatCurrency(trip?.budget || 0, currency)} limit</p>
                      </div>
                    </div>

                    {/* Progress Bar Per Person */}
                    {(() => {
                      const ppBudget = trip?.budget || 0;
                      const ppSpent = costByCategory.total / (trip?.headcount || 1);
                      const ppPct = ppBudget > 0 ? Math.min((ppSpent / ppBudget) * 100, 100) : 0;
                      const isOverBudget = ppBudget > 0 && ppSpent > ppBudget;

                      return (
                        <div className="mt-4">
                          <div className="flex justify-between text-xs font-bold mb-2">
                            <span className={isOverBudget ? "text-red-500" : "text-indigo-600 dark:text-indigo-400"}>
                              {isOverBudget ? 'Over Budget!' : `${(100 - ppPct).toFixed(1)}% Remaining`}
                            </span>
                            <span className="text-slate-500">{ppPct.toFixed(1)}% Used</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-neutral-800 rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${isOverBudget ? 'bg-red-500' : 'bg-indigo-500'}`}
                              style={{ width: `${ppPct}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="bg-slate-50 dark:bg-neutral-950 p-6 rounded-3xl border border-slate-200 dark:border-neutral-800 overflow-hidden group transition-colors duration-300">
                <h3 className="text-xl font-bold text-slate-800 dark:text-neutral-200 mb-6 flex items-center gap-2">
                  <LayoutList className="w-5 h-5 text-slate-400" /> Expense Analysis
                </h3>

                {costByCategory.total === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-500 dark:text-neutral-400 font-medium">No expenses recorded yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                    {['flight', 'lodging', 'activity', 'food', 'coffee', 'bus', 'train', 'walking', 'rest', 'other']
                      .filter(type => costByCategory[type] > 0)
                      .sort((a, b) => costByCategory[b] - costByCategory[a]) // Sort by highest cost
                      .map(type => {
                        const cost = costByCategory[type];
                        const pctOfTotalSpent = ((cost / costByCategory.total) * 100).toFixed(1);

                        // Map type to icons and colors
                        const typeInfo = {
                          flight: { icon: Plane, color: 'bg-sky-500' },
                          lodging: { icon: BedDouble, color: 'bg-purple-500' },
                          activity: { icon: Map, color: 'bg-pink-500' },
                          food: { icon: Utensils, color: 'bg-orange-500' },
                          coffee: { icon: Coffee, color: 'bg-yellow-600' },
                          bus: { icon: Bus, color: 'bg-emerald-500' },
                          train: { icon: Train, color: 'bg-teal-500' },
                          walking: { icon: Footprints, color: 'bg-teal-400' },
                          rest: { icon: Sofa, color: 'bg-amber-500' },
                          other: { icon: FileText, color: 'bg-slate-500' },
                        }[type] || { color: 'bg-indigo-500' };

                        return (
                          <div key={type} className="group">
                            <div className="flex justify-between items-end mb-2">
                              <div>
                                <span className="text-sm font-bold text-slate-700 dark:text-neutral-300 capitalize flex items-center gap-2">
                                  {typeInfo.icon && <typeInfo.icon size={14} className="text-slate-400" />}
                                  {type}
                                </span>
                                <span className="text-xs font-bold text-slate-400 ml-1">({pctOfTotalSpent}% of expenses)</span>
                              </div>
                              <span className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(cost, currency)}</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${typeInfo.color} group-hover:opacity-80 transition-opacity`}
                                style={{ width: `${pctOfTotalSpent}%` }}
                              ></div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {
        allAppendixItems.length > 0 && (
          <div className="hidden print:block mt-12 w-full">
            {allAppendixItems.map((item, index) => (
              <div key={index} className="pdf-page-break pt-8 w-full border-t border-slate-300">
                <h2 className="text-2xl font-bold">Appendix {item.refId} ({item.eventTitle})</h2>
                <p className="mb-4 text-slate-500"><Paperclip size={16} /> {item.name}</p>
                {item.type?.startsWith('image/') && getAttachmentUrl ? (
                  <img src={getAttachmentUrl(item)} alt="" className="max-w-full max-h-[850px]" />
                ) : (
                  <div className="p-10 border-2 border-dashed bg-slate-50 text-center"><FileText size={48} className="mx-auto text-slate-400 mb-2" /> <p>{item.name}</p></div>
                )}
              </div>
            ))}
          </div>
        )
      }

      {/* Quick Navigation Floating Buttons */}
      {displayMode === 'list' && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50 animate-in slide-in-from-bottom flex-col-reverse group/nav print:hidden">
          <button onClick={scrollToTop} className="bg-indigo-600 dark:bg-purple-600 text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform" title="Scroll to Top">
            <ArrowUp size={20} />
          </button>
          <button onClick={jumpToToday} className="bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 p-3 rounded-full shadow-lg border border-slate-200 dark:border-neutral-700 hover:scale-110 transition-transform mb-auto opacity-0 translate-y-4 group-hover/nav:opacity-100 group-hover/nav:translate-y-0" title="Jump to Today">
            <Target size={20} className="text-indigo-600 dark:text-purple-400" />
          </button>
        </div>
      )}
    </div>
  );
}
