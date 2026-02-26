import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Plus, Edit3, Trash2, CalendarDays, Sparkles, AlertTriangle, Move, Package, GripVertical, ArrowUp, Target } from 'lucide-react';
import { EVENT_COLORS } from '../../utils/constants';
import { formatCurrency } from '../../utils/helpers';

const SNAP = 5; // minutes
const GUTTER = 64; // px

function snap(m) { return Math.round(m / SNAP) * SNAP; }
function timeStr(m) { return `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

function evStart(ev, origin) {
    const s = new Date(ev.startTime), d = new Date(s); d.setHours(0, 0, 0, 0);
    let off = Math.round((d - origin) / 86400000); if (off < 0) off = 0;
    return off * 1440 + s.getHours() * 60 + s.getMinutes();
}
function evDur(ev) {
    const s = new Date(ev.startTime).getTime();
    return Math.round(((ev.endTime ? new Date(ev.endTime).getTime() : s + 3600000) - s) / 60000);
}
function toISO(mins, origin) {
    const d = new Date(origin);
    d.setDate(d.getDate() + Math.floor(mins / 1440));
    d.setHours(Math.floor((mins % 1440) / 60), (mins % 1440) % 60, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** Compute canvas-relative Y in pixels from a viewport clientY */
function canvasY(clientY, canvasRef) {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? clientY - r.top : 0; // getBoundingClientRect already accounts for scroll
}

export default function TimelineView({
    sortedEvents, trip, currency, darkMode,
    zoomLevel, finalStart, tripDays, totalMinutes, searchQuery,
    onAddEvent, onEditEvent, onDeleteEvent,
    onMoveEventToTime, onUpdateDuration, onRestoreEvent,
    onUniversalMagic,
}) {
    const scrollRef = useRef(null);
    const canvasRef = useRef(null);
    const shelfRef = useRef(null);

    // Resize preview state — local only, committed on pointerup
    const [resizePreview, setResizePreview] = useState(null);
    const resizeRef = useRef(null);

    // Universal pointer-based drag state
    // source: 'event' | 'shelf-new' | 'shelf-return'
    const moveRef = useRef(null);
    const [movePreview, setMovePreview] = useState(null); // { eventId?, startMins, durMins, title?, type?, source }
    const [shelfHover, setShelfHover] = useState(false);

    // Shelf
    const [shelfSlots, setShelfSlots] = useState([null, null, null]);

    // Collision modal
    const [collision, setCollision] = useState(null);
    const [beyondWarn, setBeyondWarn] = useState(false);
    const [inlineAddStartMins, setInlineAddStartMins] = useState(null);
    const [inlineMagicText, setInlineMagicText] = useState('');

    const ppmin = zoomLevel / 60;
    const canvasH = tripDays * zoomLevel * 24;

    // Build block data
    const blocks = useMemo(() => sortedEvents.map(ev => ({
        ...ev, _s: evStart(ev, finalStart), _d: evDur(ev),
    })), [sortedEvents, finalStart]);

    // Helper: check if pointer is over the shelf
    const isOverShelf = (clientX, clientY) => {
        const sRect = shelfRef.current?.getBoundingClientRect();
        return sRect && clientX >= sRect.left && clientX <= sRect.right &&
            clientY >= sRect.top && clientY <= sRect.bottom;
    };

    // ====== RESIZE (pointer-based, local preview) ======
    const onResizeDown = useCallback((e, id, edge) => {
        e.preventDefault(); e.stopPropagation();
        const b = blocks.find(x => x.id === id);
        if (!b) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        resizeRef.current = { eventId: id, edge, startY: e.clientY, origStart: b._s, origDur: b._d };
        setResizePreview({ eventId: id, startMins: b._s, durMins: b._d });
    }, [blocks]);

    const onResizeMove = useCallback((e) => {
        const r = resizeRef.current;
        if (!r) return;
        const delta = snap(Math.round((e.clientY - r.startY) / ppmin));
        let newStart = r.origStart, newDur = r.origDur;
        if (r.edge === 'bottom') {
            newDur = Math.max(SNAP, r.origDur + delta);
        } else {
            newStart = r.origStart + delta;
            newDur = r.origDur - delta;
            if (newDur < SNAP) { newStart = r.origStart + r.origDur - SNAP; newDur = SNAP; }
            if (newStart < 0) { newStart = 0; newDur = r.origStart + r.origDur; }
        }
        if (newStart + newDur > totalMinutes) setBeyondWarn(true);
        else setBeyondWarn(false);
        setResizePreview({ eventId: r.eventId, startMins: newStart, durMins: newDur });
    }, [ppmin, totalMinutes]);

    const onResizeUp = useCallback(() => {
        const r = resizeRef.current;
        const p = resizePreview;
        resizeRef.current = null;
        setBeyondWarn(false);
        if (!r || !p) { setResizePreview(null); return; }
        const startISO = toISO(p.startMins, finalStart);
        const endISO = toISO(p.startMins + p.durMins, finalStart);
        const others = blocks.filter(b => b.id !== r.eventId);
        const overlapped = others.find(b => p.startMins < b._s + b._d && p.startMins + p.durMins > b._s);
        if (overlapped) {
            const overlapMins = Math.min(p.startMins + p.durMins, overlapped._s + overlapped._d) - Math.max(p.startMins, overlapped._s);
            setCollision({
                type: 'resize', eventId: r.eventId, targetId: overlapped.id, overlapMins,
                edge: r.edge, newStart: p.startMins, newDur: p.durMins
            });
            setResizePreview(null);
            return;
        }
        onMoveEventToTime(r.eventId, null, null, startISO, endISO);
        setResizePreview(null);
    }, [resizePreview, blocks, finalStart, onMoveEventToTime]);

    // ====== UNIVERSAL POINTER-BASED DRAG ======
    // Works for: existing events, new-event from shelf, stashed event return
    const startDrag = useCallback((e, opts) => {
        // opts: { source, eventId?, origStart?, origDur?, title?, type?, slotIdx?, eventData? }
        e.preventDefault();
        e.stopPropagation();

        const cY = canvasY(e.clientY, canvasRef);
        const clickMins = cY / ppmin;

        let offsetMins = 0;
        let startMins = snap(Math.max(0, Math.round(clickMins)));
        let durMins = 60; // default 1 hour for new events

        if (opts.source === 'event') {
            const b = blocks.find(x => x.id === opts.eventId);
            if (!b) return;
            offsetMins = clickMins - b._s;
            startMins = b._s;
            durMins = b._d;
        } else if (opts.source === 'shelf-return') {
            durMins = opts.origDur || 60;
            offsetMins = durMins / 2; // anchor at middle
        } else if (opts.source === 'shelf-new') {
            offsetMins = 30; // anchor at middle of 1h default
        }

        moveRef.current = {
            ...opts,
            offsetMins,
            origDur: durMins,
        };

        setMovePreview({
            eventId: opts.eventId || null,
            startMins,
            durMins,
            title: opts.title || null,
            type: opts.type || null,
            source: opts.source,
        });
        setShelfHover(false);

        const onMove = (ev) => {
            if (!moveRef.current) return;
            const mr = moveRef.current;
            const cy = canvasY(ev.clientY, canvasRef);
            const rawMins = (cy / ppmin) - mr.offsetMins;
            const newStart = snap(Math.max(0, Math.round(rawMins)));

            if (newStart + mr.origDur > totalMinutes) setBeyondWarn(true);
            else setBeyondWarn(false);

            setShelfHover(isOverShelf(ev.clientX, ev.clientY) && mr.source === 'event');

            setMovePreview(prev => prev ? {
                ...prev,
                startMins: newStart,
            } : null);
        };

        const onUp = (ev) => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            setBeyondWarn(false);

            const mr = moveRef.current;
            moveRef.current = null;
            if (!mr) { setMovePreview(null); setShelfHover(false); return; }

            const overShelf = isOverShelf(ev.clientX, ev.clientY);

            // === STASH: event dragged to shelf ===
            if (overShelf && mr.source === 'event') {
                const ev2 = sortedEvents.find(x => x.id === mr.eventId);
                if (ev2) {
                    const slotIdx = shelfSlots.findIndex(s => s === null);
                    if (slotIdx !== -1) {
                        setShelfSlots(prev => {
                            const n = [...prev];
                            n[slotIdx] = { ...ev2, durMins: mr.origDur };
                            return n;
                        });
                        onDeleteEvent(ev2.id);
                    }
                }
                setMovePreview(null);
                setShelfHover(false);
                return;
            }

            // Read final position from state
            setMovePreview(prev => {
                if (!prev) return null;
                const dropMins = prev.startMins;
                const dur = prev.durMins;
                const startISO = toISO(dropMins, finalStart);
                const endISO = toISO(dropMins + dur, finalStart);

                if (mr.source === 'event') {
                    // Move existing event
                    const others = blocks.filter(x => x.id !== mr.eventId);
                    const hit = others.find(x => dropMins < x._s + x._d && dropMins + dur > x._s);
                    if (hit) {
                        const freeEnd = hit._s;
                        const freeStart = (() => {
                            const prev2 = others.filter(x => x._s + x._d <= dropMins).sort((a, b2) => b2._s - a._s);
                            return prev2.length ? prev2[0]._s + prev2[0]._d : 0;
                        })();
                        const gap = freeEnd - Math.max(dropMins, freeStart);
                        if (gap > 0 && gap < dur) {
                            setCollision({ type: 'shrink', eventId: mr.eventId, newStart: Math.max(dropMins, freeStart), newDur: gap, originalDur: dur });
                        } else {
                            const overlapMins = Math.min(dropMins + dur, hit._s + hit._d) - Math.max(dropMins, hit._s);
                            setCollision({ type: 'overlap', eventId: mr.eventId, targetId: hit.id, newStart: dropMins, newDur: dur, edge: 'bottom', overlapMins });
                        }
                    } else {
                        onMoveEventToTime(mr.eventId, null, null, startISO, endISO);
                    }
                } else if (mr.source === 'shelf-new') {
                    // New event — open inline add modal at drop time
                    setInlineAddStartMins(dropMins);
                } else if (mr.source === 'shelf-return') {
                    // Return stashed event
                    const { durMins: _, _s, _d, ...eventData } = mr.eventData;
                    onRestoreEvent({
                        ...eventData,
                        startTime: startISO,
                        endTime: endISO,
                    });
                    // Clear the shelf slot
                    if (mr.slotIdx !== undefined) {
                        setShelfSlots(p => { const n = [...p]; n[mr.slotIdx] = null; return n; });
                    }
                }
                return null;
            });

            setShelfHover(false);
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }, [blocks, ppmin, totalMinutes, finalStart, sortedEvents, shelfSlots, onDeleteEvent, onMoveEventToTime, onAddEvent, onRestoreEvent]);

    // ====== COLLISION RESOLUTION ======
    const resolve = useCallback((action) => {
        if (!collision) return;
        const c = collision;
        if (action === 'cancel') { setCollision(null); return; }

        if (c.type === 'shrink' && action === 'shrink') {
            onMoveEventToTime(c.eventId, null, null, toISO(c.newStart, finalStart), toISO(c.newStart + c.newDur, finalStart));
        }
        if (c.type !== 'shrink' && action === 'eat') {
            const myEnd = c.newStart + c.newDur;
            onMoveEventToTime(c.eventId, null, null, toISO(c.newStart, finalStart), toISO(myEnd, finalStart));
            const t = blocks.find(b => b.id === c.targetId);
            if (t) onMoveEventToTime(t.id, null, null, toISO(myEnd, finalStart), toISO(myEnd + t._d, finalStart));
        }
        if (c.type !== 'shrink' && action === 'push') {
            const myEnd = c.newStart + c.newDur;
            onMoveEventToTime(c.eventId, null, null, toISO(c.newStart, finalStart), toISO(myEnd, finalStart));
            const below = blocks.filter(b => b.id !== c.eventId && b._s >= c.newStart).sort((a, b) => a._s - b._s);
            let cursor = myEnd;
            for (const ev of below) {
                if (ev._s < cursor) {
                    onMoveEventToTime(ev.id, null, null, toISO(cursor, finalStart), toISO(cursor + ev._d, finalStart));
                    cursor += ev._d;
                } else break;
            }
        }
        setCollision(null);
    }, [collision, blocks, finalStart, onMoveEventToTime]);

    // Minimap scroll
    const onScroll = useCallback((e) => {
        const th = document.getElementById('tl-thumb');
        if (th && e.currentTarget.scrollHeight > 0) {
            th.style.top = `${(e.currentTarget.scrollTop / e.currentTarget.scrollHeight) * 100}%`;
            th.style.height = `${(e.currentTarget.clientHeight / e.currentTarget.scrollHeight) * 100}%`;
        }
    }, []);

    const jumpToToday = useCallback(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(finalStart);
        start.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / 86400000);

        if (diffDays >= 0 && diffDays < tripDays) {
            if (scrollRef.current) {
                const topPx = diffDays * 24 * 60 * ppmin;
                scrollRef.current.scrollTo({ top: topPx, behavior: 'smooth' });
            }
        }
    }, [finalStart, tripDays, ppmin]);

    const scrollToTop = useCallback(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, []);

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden shadow-sm border border-slate-200 dark:border-neutral-800 transition-colors h-[70vh] min-h-[500px] flex relative">

            {/* ===== Minimap ===== */}
            <div className="w-12 sm:w-14 bg-slate-100 dark:bg-neutral-950 border-r border-slate-300 dark:border-neutral-800 relative cursor-pointer overflow-hidden shrink-0 z-30"
                onPointerDown={e => {
                    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
                    const hd = ev => { const r = el.getBoundingClientRect(); const pct = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)); if (scrollRef.current) scrollRef.current.scrollTop = pct * scrollRef.current.scrollHeight - scrollRef.current.clientHeight / 2; };
                    hd(e); el.onpointermove = hd; el.onpointerup = ev => { el.releasePointerCapture(ev.pointerId); el.onpointermove = null; el.onpointerup = null; };
                }}>
                <div id="tl-thumb" className="absolute w-full bg-slate-400/30 border-y border-slate-500/30 pointer-events-none" style={{ top: '0%', height: '10%' }} />
                {Array.from({ length: tripDays }).map((_, i) => (
                    <div key={i} className="absolute w-full border-t border-red-500/30" style={{ top: `${(i / tripDays) * 100}%`, height: `${(1 / tripDays) * 100}%` }}>
                        <span className="text-[6px] text-red-500/70 font-bold ml-1 opacity-70">D{i + 1}</span>
                    </div>
                ))}
                {blocks.map(b => {
                    const col = EVENT_COLORS[b.type]?.split(' ')[0] || 'bg-slate-300';
                    return <div key={b.id} className={`absolute left-1 right-1 rounded-[2px] ${col} opacity-90`} style={{ top: `${(b._s / totalMinutes) * 100}%`, height: `${Math.max((b._d / totalMinutes) * 100, 0.3)}%` }} />;
                })}
            </div>

            {/* ===== Canvas ===== */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-neutral-950 relative scroll-smooth" ref={scrollRef} onScroll={onScroll}>
                <div className="relative w-full" ref={canvasRef} style={{ height: `${canvasH}px` }}>
                    {/* Hour grid */}
                    <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
                        {Array.from({ length: tripDays * 24 }).map((_, i) => (
                            <div key={i} className={`w-full flex items-start ${i % 24 === 0 ? '' : 'border-t border-slate-200 dark:border-neutral-800'}`} style={{ height: `${zoomLevel}px` }}>
                                <div className="relative" style={{ width: `${GUTTER}px` }}>
                                    {i % 24 !== 0 && <span className="absolute -top-3 right-1 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-neutral-900 px-1 rounded">{(i % 24).toString().padStart(2, '0')}:00</span>}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Day markers */}
                    {Array.from({ length: tripDays }).map((_, i) => (
                        <div key={i} className="absolute w-full border-t-[3px] border-red-500 z-40 pointer-events-none flex items-center" style={{ top: `${i * 24 * zoomLevel}px` }}>
                            <div style={{ width: `${GUTTER}px` }} className="shrink-0" />
                            <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-b-lg ml-1">
                                {new Date(finalStart.getTime() + i * 86400000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                        </div>
                    ))}

                    {/* Move shadow block — accurate ghost with start/end times */}
                    {movePreview && (() => {
                        const shadowTop = movePreview.startMins * ppmin;
                        const shadowH = Math.max(movePreview.durMins * ppmin, 40);
                        const startLabel = timeStr(movePreview.startMins % 1440);
                        const endLabel = timeStr((movePreview.startMins + movePreview.durMins) % 1440);
                        const dayStart = Math.floor(movePreview.startMins / 1440) + 1;
                        const dayEnd = Math.floor((movePreview.startMins + movePreview.durMins) / 1440) + 1;

                        // Try to get color from event type
                        let evType = movePreview.type;
                        if (!evType && movePreview.eventId) {
                            const b = blocks.find(x => x.id === movePreview.eventId);
                            if (b) evType = b.type;
                        }
                        const col = EVENT_COLORS[evType]?.split(' ')[0]?.replace('bg-', 'border-') || 'border-indigo-400';
                        const title = movePreview.title || blocks.find(x => x.id === movePreview.eventId)?.title || 'New Event';

                        return (
                            <div className="absolute pointer-events-none z-[55]"
                                style={{ top: `${shadowTop}px`, height: `${shadowH}px`, left: `${GUTTER + 4}px`, right: '8px' }}>
                                <div className={`w-full h-full rounded-xl border-2 border-dashed ${col} bg-black/5 dark:bg-white/5 relative`}>
                                    <div className="p-2 text-xs font-bold truncate opacity-60">{title}</div>
                                </div>
                                {/* Start time label */}
                                <div className="absolute -top-0.5 -left-1 flex items-center -translate-y-full">
                                    <div className="bg-indigo-600 dark:bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-t shadow-lg">
                                        {dayStart > 1 ? `D${dayStart} ` : ''}{startLabel}
                                    </div>
                                </div>
                                {/* End time label */}
                                <div className="absolute -bottom-0.5 -left-1 translate-y-full">
                                    <div className="bg-indigo-600 dark:bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-b shadow-lg">
                                        {dayEnd > 1 && dayEnd !== dayStart ? `D${dayEnd} ` : ''}{endLabel}
                                    </div>
                                </div>
                                {/* Guide lines */}
                                <div className="absolute top-0 left-0 right-0 border-t-2 border-indigo-500 dark:border-purple-400" style={{ marginLeft: '-4px', marginRight: '-8px' }} />
                                <div className="absolute bottom-0 left-0 right-0 border-b-2 border-indigo-500 dark:border-purple-400" style={{ marginLeft: '-4px', marginRight: '-8px' }} />
                            </div>
                        );
                    })()}

                    {/* Inline Add Popover */}
                    {inlineAddStartMins !== null && (() => {
                        const topPx = inlineAddStartMins * ppmin;
                        const dropISO = toISO(inlineAddStartMins, finalStart);
                        return (
                            <div className="absolute left-[70px] right-2 z-[70]" style={{ top: `${topPx}px` }}>
                                <div className="bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-2xl rounded-2xl p-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-indigo-600 dark:text-purple-400 flex items-center gap-1">
                                            <Plus size={14} /> New Event at {timeStr(inlineAddStartMins)}
                                        </span>
                                        <button onClick={() => setInlineAddStartMins(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={inlineMagicText}
                                                onChange={e => setInlineMagicText(e.target.value)}
                                                placeholder="e.g. Coffee break, sightseeing..."
                                                className="w-full bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-purple-500"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && inlineMagicText.trim()) {
                                                        if (onUniversalMagic) onUniversalMagic(inlineMagicText + ` (at ${dropISO})`);
                                                        setInlineMagicText('');
                                                        setInlineAddStartMins(null);
                                                    }
                                                }}
                                                autoFocus
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (inlineMagicText.trim() && onUniversalMagic) {
                                                    onUniversalMagic(inlineMagicText + ` (at ${dropISO})`);
                                                } else {
                                                    onAddEvent({ startTime: dropISO });
                                                }
                                                setInlineMagicText('');
                                                setInlineAddStartMins(null);
                                            }}
                                            className="shrink-0 bg-indigo-600 dark:bg-purple-600 text-white p-2 rounded-xl hover:bg-indigo-700 dark:hover:bg-purple-700 transition-colors shadow-sm"
                                            title="AI Magic"
                                        >
                                            <Sparkles size={16} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                onAddEvent({ startTime: dropISO });
                                                setInlineAddStartMins(null);
                                            }}
                                            className="shrink-0 bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 p-2 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
                                            title="Add manually"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                    <div className="flex items-center flex-wrap gap-1.5 mt-2">
                                        <span className="text-[9px] font-bold text-slate-400 dark:text-neutral-600 uppercase tracking-wider">Quick:</span>
                                        <button onClick={() => { setInlineAddStartMins(null); onAddEvent({ title: 'Rest', type: 'rest', startTime: dropISO }); }} className="text-[10px] font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-2 py-1 rounded-lg transition-colors"><Sofa size={10} /> Rest</button>
                                        <button onClick={() => { setInlineAddStartMins(null); onAddEvent({ title: 'Travel', type: 'bus', startTime: dropISO }); }} className="text-[10px] font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-2 py-1 rounded-lg transition-colors"><Package size={10} /> Travel</button>
                                        <button onClick={() => { setInlineAddStartMins(null); onAddEvent({ title: 'Walk around', type: 'walking', startTime: dropISO }); }} className="text-[10px] font-bold flex items-center gap-1 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40 px-2 py-1 rounded-lg transition-colors"><Footprints size={10} /> Walk</button>
                                        <button onClick={() => { setInlineAddStartMins(null); onAddEvent({ title: 'Shopping', type: 'activity', startTime: dropISO }); }} className="text-[10px] font-bold flex items-center gap-1 bg-indigo-50 dark:bg-purple-900/20 text-indigo-600 dark:text-purple-400 hover:bg-indigo-100 dark:hover:bg-purple-900/40 px-2 py-1 rounded-lg transition-colors"><AlertTriangle size={10} /> Shop</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Event blocks */}
                    {blocks.map(block => {
                        const isResizing = resizePreview?.eventId === block.id;
                        const isMoving = movePreview?.eventId === block.id && movePreview?.source === 'event';
                        const startM = isResizing ? resizePreview.startMins : block._s;
                        const durM = isResizing ? resizePreview.durMins : block._d;
                        const blockH = Math.max(durM * ppmin, 40);
                        const startLabel = timeStr(startM % 1440);
                        const endLabel = timeStr((startM + durM) % 1440);

                        const q = (searchQuery || '').toLowerCase().trim();
                        const isMatch = !q || (block.title || '').toLowerCase().includes(q) || (block.type || '').toLowerCase().includes(q) || (block.notes || '').toLowerCase().includes(q);

                        return (
                            <div key={block.id}
                                className={`absolute rounded-xl border shadow-sm overflow-visible group/ev select-none
                                  ${EVENT_COLORS[block.type] || EVENT_COLORS.other}
                                  ${!isMatch ? 'opacity-20 grayscale pointer-events-none' :
                                        isMoving ? 'z-[60] scale-[1.03] shadow-2xl ring-2 ring-indigo-400 dark:ring-purple-400 opacity-50' :
                                            isResizing ? 'z-50 ring-2 ring-indigo-400 dark:ring-purple-400' :
                                                'opacity-90 z-20 hover:z-30 hover:opacity-100 hover:shadow-lg'}`}
                                style={{
                                    top: `${startM * ppmin}px`,
                                    height: `${blockH}px`,
                                    left: `${GUTTER + 4}px`,
                                    right: '8px',
                                    transition: isResizing || isMoving ? 'none' : 'box-shadow 0.15s, opacity 0.15s, transform 0.15s',
                                }}>

                                {/* Top resize handle */}
                                <div className="absolute -top-3 left-2 right-2 h-6 cursor-ns-resize z-40 flex items-center justify-center group/rh"
                                    onPointerDown={e => onResizeDown(e, block.id, 'top')}
                                    onPointerMove={onResizeMove}
                                    onPointerUp={onResizeUp}>
                                    <div className="w-16 h-1.5 rounded-full bg-black/15 dark:bg-white/20 group-hover/rh:bg-indigo-500 dark:group-hover/rh:bg-purple-400 group-hover/rh:h-2 group-hover/rh:w-20 transition-all" />
                                </div>

                                {/* Content row — ENTIRE area is the move handle */}
                                <div className="flex items-stretch h-full px-2 sm:px-3 py-1 cursor-grab active:cursor-grabbing"
                                    onPointerDown={e => {
                                        // Don't trigger move if clicking action buttons
                                        if (e.target.closest('[data-no-drag]')) return;
                                        startDrag(e, { source: 'event', eventId: block.id });
                                    }}>
                                    {/* Grip indicator */}
                                    <div className="flex items-center justify-center shrink-0 mr-1 opacity-30 group-hover/ev:opacity-60 transition-opacity">
                                        <GripVertical size={14} className="text-current" />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 overflow-hidden py-0.5">
                                        <div className="font-bold text-xs sm:text-sm truncate leading-tight">{block.title || ''}</div>
                                        {blockH > 46 && (
                                            <div className="text-[10px] sm:text-xs opacity-75 mt-0.5 truncate">
                                                {startLabel} – {endLabel}
                                                {block.cost > 0 && <span className="ml-1.5 font-bold">{formatCurrency(block.cost, currency)}</span>}
                                            </div>
                                        )}
                                        {blockH > 75 && block.notes && <div className="text-[10px] opacity-60 mt-0.5 truncate">{block.notes}</div>}
                                    </div>

                                    {/* Actions — marked data-no-drag to prevent triggering move */}
                                    <div data-no-drag className={`flex flex-col gap-0.5 justify-center shrink-0 transition-opacity ${isMoving ? 'opacity-0' : 'opacity-0 group-hover/ev:opacity-100'}`}>
                                        <button onClick={e => { e.stopPropagation(); e.preventDefault(); onEditEvent(block); }} className="p-1 rounded hover:bg-black/10"><Edit3 size={11} /></button>
                                        <button onClick={e => { e.stopPropagation(); e.preventDefault(); onDeleteEvent(block.id); }} className="p-1 rounded hover:bg-black/10 text-red-700"><Trash2 size={11} /></button>
                                    </div>
                                </div>

                                {/* Bottom resize handle */}
                                <div className="absolute -bottom-3 left-2 right-2 h-6 cursor-ns-resize z-40 flex items-center justify-center group/rh2"
                                    onPointerDown={e => onResizeDown(e, block.id, 'bottom')}
                                    onPointerMove={onResizeMove}
                                    onPointerUp={onResizeUp}>
                                    <div className="w-16 h-1.5 rounded-full bg-black/15 dark:bg-white/20 group-hover/rh2:bg-indigo-500 dark:group-hover/rh2:bg-purple-400 group-hover/rh2:h-2 group-hover/rh2:w-20 transition-all" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ===== Shelf ===== */}
            <div ref={shelfRef}
                className={`w-36 sm:w-44 border-l flex flex-col shrink-0 overflow-hidden transition-all duration-200
                ${shelfHover
                        ? 'bg-indigo-50 dark:bg-purple-950 border-indigo-400 dark:border-purple-500 ring-2 ring-indigo-300 dark:ring-purple-600 ring-inset'
                        : 'bg-slate-50 dark:bg-neutral-950 border-slate-200 dark:border-neutral-800'}`}>
                {/* New Event section */}
                <div className="p-3 border-b border-slate-200 dark:border-neutral-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">New Event</p>
                    <div
                        className="bg-white dark:bg-neutral-900 border-2 border-dashed border-indigo-300 dark:border-purple-700 rounded-xl p-4 cursor-grab active:cursor-grabbing hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-purple-900/20 transition-all text-center select-none shadow-sm"
                        onPointerDown={e => startDrag(e, { source: 'shelf-new' })}>
                        <Plus size={18} className="mx-auto text-indigo-500 dark:text-purple-400 mb-1" />
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-purple-400">Drag to timeline</span>
                    </div>
                </div>

                {/* Temp slots — pointer-based drag */}
                <div className="flex-1 p-2 overflow-y-auto">
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 px-1 transition-colors
                        ${shelfHover ? 'text-indigo-600 dark:text-purple-400' : 'text-slate-400'}`}>
                        {shelfHover ? '⬇ Drop to stash' : 'Temp Storage'}
                    </p>
                    <div className="space-y-2">
                        {shelfSlots.map((slot, idx) => (
                            <div key={idx}
                                className={`rounded-xl border-2 min-h-[56px] transition-all select-none
                  ${slot ? `${EVENT_COLORS[slot.type] || 'bg-slate-100'} border-solid cursor-grab shadow-sm` :
                                        shelfHover ? 'border-dashed border-indigo-400 dark:border-purple-500 bg-indigo-50/50 dark:bg-purple-900/20 animate-pulse' :
                                            'border-dashed border-slate-300 dark:border-neutral-700 bg-white/50 dark:bg-neutral-900/50'}`}
                                onPointerDown={e => {
                                    if (!slot) return;
                                    startDrag(e, {
                                        source: 'shelf-return',
                                        eventId: slot.id,
                                        origDur: slot.durMins || 60,
                                        title: slot.title,
                                        type: slot.type,
                                        slotIdx: idx,
                                        eventData: slot,
                                    });
                                }}>
                                {slot ? (
                                    <div className="p-2">
                                        <div className="text-[11px] font-bold truncate">{slot.title}</div>
                                        <div className="text-[9px] opacity-70">{Math.floor(slot.durMins / 60)}h {slot.durMins % 60}m</div>
                                        <button data-no-drag onClick={(e) => { e.stopPropagation(); setShelfSlots(prev => { const n = [...prev]; n[idx] = null; return n; }); }}
                                            className="text-[9px] text-red-600 font-bold mt-1 hover:underline">Remove</button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full p-3">
                                        <span className={`text-[10px] ${shelfHover ? 'text-indigo-500 dark:text-purple-400 font-bold' : 'text-slate-400 dark:text-neutral-600'}`}>
                                            {shelfHover ? 'Drop here' : 'Empty slot'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Beyond warning */}
            {beyondWarn && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold z-50">
                    <AlertTriangle size={16} /> Extends beyond project dates
                </div>
            )}

            {/* Collision modal */}
            {collision && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-neutral-800">
                        <div className="flex items-center gap-2 mb-4 text-amber-600">
                            <AlertTriangle size={20} />
                            <h3 className="font-bold text-lg">{collision.type === 'shrink' ? 'Insufficient Space' : 'Event Overlap'}</h3>
                        </div>
                        {collision.type === 'shrink' ? (
                            <p className="text-sm text-slate-600 dark:text-neutral-400 mb-5">
                                Shrink from <b>{Math.floor(collision.originalDur / 60)}h {collision.originalDur % 60}m</b> to <b>{Math.floor(collision.newDur / 60)}h {collision.newDur % 60}m</b> to fit?
                            </p>
                        ) : (
                            <p className="text-sm text-slate-600 dark:text-neutral-400 mb-5">
                                Overlaps <b>"{blocks.find(b => b.id === collision.targetId)?.title}"</b> by {collision.overlapMins || '?'} min.
                            </p>
                        )}
                        <div className="space-y-2">
                            {collision.type === 'shrink' && <button onClick={() => resolve('shrink')} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700">Shrink to fit</button>}
                            {collision.type !== 'shrink' && <>
                                <button onClick={() => resolve('eat')} className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600">Shift overlapped event</button>
                                <button onClick={() => resolve('push')} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700">Push all events {collision.edge === 'top' ? '↑' : '↓'}</button>
                            </>}
                            <button onClick={() => resolve('cancel')} className="w-full py-2.5 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-neutral-700">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Navigation Floating Buttons (Timeline) */}
            <div className="absolute bottom-6 left-16 sm:left-20 flex flex-col gap-3 z-[80] animate-in slide-in-from-bottom flex-col-reverse group/nav">
                <button onClick={scrollToTop} className="bg-indigo-600 dark:bg-purple-600 text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform" title="Scroll to Top">
                    <ArrowUp size={20} />
                </button>
                <button onClick={jumpToToday} className="bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 p-3 rounded-full shadow-lg border border-slate-200 dark:border-neutral-700 hover:scale-110 transition-transform mb-auto opacity-0 translate-y-4 group-hover/nav:opacity-100 group-hover/nav:translate-y-0" title="Jump to Today">
                    <Target size={20} className="text-indigo-600 dark:text-purple-400" />
                </button>
            </div>
        </div>
    );
}
