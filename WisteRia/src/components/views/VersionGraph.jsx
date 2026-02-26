import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GitMerge, Copy, Edit3, Trash2, ChevronRight, Anchor, X, Check, MousePointer2, CheckSquare } from 'lucide-react';

const NODE_W = 140;
const NODE_H = 36;
const COL_GAP = 180;
const ROW_GAP = 72; // Increased to give room for the floating text pill between nodes
const PAD_X = 40;
const PAD_Y = 40; // Increased to prevent top bound clipping


function layoutGraph(versions) {
    if (!versions || versions.length === 0) return { nodes: [], edges: [] };
    const byId = {};
    versions.forEach(v => { byId[v.id] = v; });
    const children = {};
    versions.forEach(v => {
        if (v.parentId && byId[v.parentId]) {
            if (!children[v.parentId]) children[v.parentId] = [];
            children[v.parentId].push(v.id);
        }
    });
    const roots = versions.filter(v => !v.parentId || !byId[v.parentId]);
    const col = {}, visited = new Set(), order = [];
    let queue = roots.map(r => ({ id: r.id, depth: 0 }));
    while (queue.length > 0) {
        const { id, depth } = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id); col[id] = depth; order.push(id);
        const kids = children[id] || [];
        kids.sort((a, b) => (byId[a]?.createdAt || '').localeCompare(byId[b]?.createdAt || ''));
        kids.forEach(kid => queue.push({ id: kid, depth: depth + 1 }));
    }
    versions.forEach(v => { if (!visited.has(v.id)) { col[v.id] = 0; order.push(v.id); } });
    const colBuckets = {};
    order.forEach(id => { const c = col[id]; if (!colBuckets[c]) colBuckets[c] = []; colBuckets[c].push(id); });
    const lane = {}; let maxLane = 0;
    Object.keys(colBuckets).sort((a, b) => a - b).forEach(c => {
        colBuckets[c].forEach((id, idx) => { lane[id] = idx; if (idx > maxLane) maxLane = idx; });
    });
    const nodes = order.map(id => ({ id, version: byId[id], x: PAD_X + col[id] * COL_GAP, y: PAD_Y + lane[id] * ROW_GAP }));
    const edges = [];
    versions.forEach(v => {
        if (v.parentId && byId[v.parentId]) { const f = nodes.find(n => n.id === v.parentId), t = nodes.find(n => n.id === v.id); if (f && t) edges.push({ from: f, to: t, type: 'parent' }); }
        if (v.mergedFromId && byId[v.mergedFromId]) { const f = nodes.find(n => n.id === v.mergedFromId), t = nodes.find(n => n.id === v.id); if (f && t) edges.push({ from: f, to: t, type: 'merge' }); }
    });
    const maxCol = Math.max(0, ...Object.values(col));
    return { nodes, edges, width: PAD_X * 2 + (maxCol + 1) * COL_GAP + 40, height: PAD_Y * 2 + (maxLane + 1) * ROW_GAP + 40 };
}

function ArrowHead({ x1, y1, x2, y2, color }) {
    const angle = Math.atan2(y2 - y1, x2 - x1), s = 8;
    return <polygon points={`${x2},${y2} ${x2 - s * Math.cos(angle - Math.PI / 6)},${y2 - s * Math.sin(angle - Math.PI / 6)} ${x2 - s * Math.cos(angle + Math.PI / 6)},${y2 - s * Math.sin(angle + Math.PI / 6)}`} fill={color} />;
}

export default function VersionGraph({
    versions, activeVersionId,
    onChangeVersion, onCreateVersion, onRenameVersion, onDeleteVersion, onMergeVersions, onSetRoot,
    externalMergeMode, onExternalMergeModeChange, showDialog
}) {
    const [contextMenu, setContextMenu] = useState(null);
    // selectMode: false | 'select'
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState([]); // array of selected version ids
    const containerRef = useRef(null);

    // Merge mode driven externally (from TripView toolbar)
    const mergeMode = externalMergeMode || false;
    const setMergeMode = (val) => { if (onExternalMergeModeChange) onExternalMergeModeChange(val); };

    // When leaving merge mode, if we were also in select mode, keep it. Reset selected on merge-mode exit.
    useEffect(() => {
        if (!mergeMode && !selectMode) setSelected([]);
    }, [mergeMode, selectMode]);

    // If merge mode activates, leave select mode
    useEffect(() => {
        if (mergeMode) { setSelectMode(false); }
    }, [mergeMode]);

    const { nodes, edges, width, height } = useMemo(() => layoutGraph(versions), [versions]);
    const svgW = Math.max(width || 400, 400);
    const svgH = Math.max(height || 140, 140);

    useEffect(() => {
        if (containerRef.current) {
            const an = nodes.find(n => n.id === activeVersionId);
            if (an) containerRef.current.scrollLeft = Math.max(0, an.x - 200);
        }
    }, [activeVersionId, nodes]);

    // ---- Derived merge-mode state from selected (when in merge mode) ----
    // In merge mode we reuse `selected` for the 2-pick merge, capped at 2
    const mergeSelections = mergeMode ? selected.slice(0, 2) : [];

    const enterSelectMode = () => {
        if (mergeMode) setMergeMode(false);
        setSelectMode(true);
        setSelected([]);
        setContextMenu(null);
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelected([]);
    };

    const toggleSelect = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleNodeClick = (nodeId) => {
        if (mergeMode) {
            // Toggle selection for merge (hard cap at 2)
            setSelected(prev => {
                if (prev.includes(nodeId)) return prev.filter(id => id !== nodeId);
                if (prev.length < 2) return [...prev, nodeId];
                return prev; // already 2, ignore
            });
            return;
        }
        if (selectMode) {
            toggleSelect(nodeId);
            return;
        }
        onChangeVersion(nodeId);
    };

    const handleContextMenu = (e, nodeId) => {
        e.preventDefault(); e.stopPropagation();
        if (mergeMode || selectMode) return;
        const rect = containerRef.current.getBoundingClientRect();
        setContextMenu({ nodeId, x: e.clientX - rect.left + containerRef.current.scrollLeft, y: e.clientY - rect.top + containerRef.current.scrollTop });
    };

    const isAutoSave = (name) => name?.startsWith('Auto ·');

    // ---- Merge logic ----
    const doMerge = async () => {
        const picks = mergeMode ? mergeSelections : selected.slice(0, 2);
        if (picks.length !== 2) return;
        const n1 = versions.find(v => v.id === picks[0])?.name;
        const n2 = versions.find(v => v.id === picks[1])?.name;

        // Check for merge conflict — if either pick is already a merge node and shares lineage
        const v1 = versions.find(v => v.id === picks[0]);
        const v2 = versions.find(v => v.id === picks[1]);
        const byId = Object.fromEntries(versions.map(v => [v.id, v]));

        // Collect ancestors of a version
        const getAncestors = (id) => {
            const anc = new Set();
            let cur = byId[id];
            while (cur && (cur.parentId || cur.mergedFromId)) {
                const parents = [cur.parentId, cur.mergedFromId].filter(Boolean);
                for (const p of parents) { if (!anc.has(p)) { anc.add(p); } }
                cur = byId[cur.parentId] || null;
            }
            return anc;
        };

        const anc1 = getAncestors(picks[0]);
        const anc2 = getAncestors(picks[1]);

        // Warn if one is a direct ancestor of the other (potential conflict)
        const isConflict = anc1.has(picks[1]) || anc2.has(picks[0]);

        const mergeMsg = isConflict
            ? `⚠️ Merge Conflict Warning\n\n"${n1}" and "${n2}" have a direct ancestor relationship. Merging may produce duplicate events.\n\nContinue anyway?`
            : `Merge "${n1}" and "${n2}"?\n\nThis will create a new version combining events from both.`;

        const confirmed = await showDialog({
            type: 'confirm',
            title: isConflict ? 'Merge Conflict Detected' : 'Merge Versions',
            message: mergeMsg,
            confirmText: 'Merge',
            danger: isConflict
        });
        if (confirmed) onMergeVersions(picks[0], picks[1]);
        setMergeMode(false);
        setSelected([]);
    };

    // ---- Set Root logic ----
    // In select mode with exactly 1 selected, use that; otherwise fall back to activeVersionId
    const setRootTargetId = (selectMode && selected.length === 1) ? selected[0] : activeVersionId;

    const doSetRoot = async () => {
        const v = versions.find(vv => vv.id === setRootTargetId);
        if (!v) return;
        const isRoot = !v.parentId || !versions.find(vv => vv.id === v.parentId);
        if (isRoot) { await showDialog({ type: 'alert', title: 'Already Root', message: 'This version is already the root.' }); return; }
        const confirmed = await showDialog({
            type: 'confirm',
            title: 'Set as Root',
            message: `⚠️ Set "${v.name}" as the root?\n\nThis will permanently delete ALL versions before this one. This cannot be undone.`,
            confirmText: 'Set Root',
            danger: true
        });
        if (confirmed) onSetRoot(setRootTargetId);
        exitSelectMode();
    };

    // ---- Batch delete ----
    const doDeleteSelected = async () => {
        if (selected.length === 0) return;
        // Cannot delete all versions
        if (selected.length >= versions.length) {
            await showDialog({ type: 'alert', title: 'Cannot Delete All', message: 'You must keep at least one version.' });
            return;
        }
        const names = selected.map(id => versions.find(v => v.id === id)?.name).filter(Boolean);
        const confirmed = await showDialog({
            type: 'confirm',
            title: `Delete ${selected.length} Version${selected.length > 1 ? 's' : ''}`,
            message: `Permanently delete:\n${names.map(n => `• ${n}`).join('\n')}\n\nThis cannot be undone.`,
            confirmText: 'Delete',
            danger: true
        });
        if (confirmed) {
            onDeleteVersion(selected, true);
            exitSelectMode();
        }
    };

    // ---- Derived flags for button greying ----
    // In normal (no select) mode: buttons act on activeVersionId, behave as usual.
    // In select mode:
    //   Set Root: enabled only when exactly 1 selected
    //   Merge: enabled only when exactly 2 selected
    //   Delete: enabled when 1+ selected AND not deleting all

    const inAnyMultiMode = selectMode || mergeMode;
    const canSetRoot = !selectMode || selected.length === 1;
    const canMergeStart = !selectMode || selected.length <= 2;
    // In merge-mode with 2 picks, show confirm merge button
    const canConfirmMerge = (mergeMode && mergeSelections.length === 2) || (selectMode && selected.length === 2);

    return (
        <div className="relative">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
                {/* Select mode toggle */}
                {!mergeMode && (
                    <button
                        onClick={selectMode ? exitSelectMode : enterSelectMode}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${selectMode
                            ? 'bg-indigo-600 dark:bg-purple-600 text-white border-indigo-600 dark:border-purple-600'
                            : 'bg-white dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 border-slate-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-purple-500 hover:text-indigo-600 dark:hover:text-purple-400'}`}
                    >
                        <CheckSquare size={13} />
                        {selectMode ? `${selected.length} selected` : 'Select'}
                    </button>
                )}

                {/* Merge mode status */}
                {mergeMode && (
                    <>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                            {mergeSelections.length === 0 ? 'Click 2 versions to merge' : mergeSelections.length === 1 ? 'Select 1 more' : ''}
                        </span>
                    </>
                )}

                {/* Select mode action buttons */}
                {selectMode && selected.length > 0 && (
                    <>
                        {/* Merge (only when exactly 2 selected) */}
                        <button
                            onClick={doMerge}
                            disabled={selected.length !== 2}
                            title={selected.length !== 2 ? 'Select exactly 2 versions to merge' : 'Merge selected versions'}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors animate-in fade-in disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <GitMerge size={13} /> Merge {selected.length === 2 ? '' : `(need 2)`}
                        </button>

                        {/* Set Root (only when exactly 1 selected) */}
                        <button
                            onClick={doSetRoot}
                            disabled={selected.length !== 1}
                            title={selected.length !== 1 ? 'Select exactly 1 version to set as root' : 'Set selected as root'}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors animate-in fade-in disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Anchor size={13} /> Set Root {selected.length !== 1 ? `(need 1)` : ''}
                        </button>

                        {/* Delete selected */}
                        <button
                            onClick={doDeleteSelected}
                            disabled={selected.length >= versions.length}
                            title={selected.length >= versions.length ? 'Cannot delete all versions' : `Delete ${selected.length} version(s)`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-colors animate-in fade-in disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Trash2 size={13} /> Delete ({selected.length})
                        </button>
                    </>
                )}

                {/* Merge confirm button (when 2 picked in merge mode) */}
                {mergeMode && mergeSelections.length === 2 && (
                    <button onClick={doMerge} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors animate-in fade-in">
                        <Check size={14} /> Confirm Merge
                    </button>
                )}

                {/* Cancel select/merge */}
                {(selectMode || mergeMode) && (
                    <button
                        onClick={() => { setMergeMode(false); exitSelectMode(); }}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 font-bold transition-colors ml-auto"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            <div ref={containerRef} className="overflow-x-auto overflow-y-auto rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/50 p-4" style={{ maxHeight: 360 }} onClick={() => setContextMenu(null)}>
                <svg width={svgW} height={svgH} className="select-none overflow-visible">
                    {edges.map((edge, idx) => {
                        const x1 = edge.from.x + NODE_W, y1 = edge.from.y + NODE_H / 2;
                        const x2 = edge.to.x, y2 = edge.to.y + NODE_H / 2;
                        const midX = (x1 + x2) / 2;
                        const isMerge = edge.type === 'merge';
                        const t = 0.95, it = 1 - t;
                        const tx = 3 * it * it * (midX - x1) + 3 * t * t * (x2 - midX), ty = 6 * it * t * (y2 - y1);
                        const pathD = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
                        const c = isMerge ? '#34d399' : '#818cf8';
                        return (<g key={idx}><path d={pathD} fill="none" strokeWidth={isMerge ? 2 : 2.5} strokeDasharray={isMerge ? '6 4' : 'none'} stroke={c} /><ArrowHead x1={x2 - tx * 0.15} y1={y2 - ty * 0.15} x2={x2} y2={y2} color={c} /></g>);
                    })}

                    {nodes.map(node => {
                        const v = node.version;
                        const isActive = v.id === activeVersionId;
                        const isAuto = isAutoSave(v.name);
                        const isMergeNode = !!v.mergedFromId;
                        const isSel = selected.includes(v.id); // selected in either mode

                        return (
                            <g key={v.id} onClick={() => handleNodeClick(v.id)} onContextMenu={(e) => handleContextMenu(e, v.id)} className="cursor-pointer">
                                {/* Selection ring (Thick outline) */}
                                {isSel && (
                                    <rect x={node.x - 3} y={node.y - 3} width={NODE_W + 6} height={NODE_H + 6} rx={22} ry={22} fill="none" strokeWidth={3}
                                        className={mergeMode ? "stroke-emerald-500 dark:stroke-emerald-400" : "stroke-indigo-500 dark:stroke-purple-400"} />
                                )}

                                {/* Node Body */}
                                <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={NODE_H / 2} ry={NODE_H / 2}
                                    className={`transition-all ${isSel ? 'fill-indigo-50 dark:fill-purple-900/40 stroke-indigo-500 dark:stroke-purple-400' : isActive ? 'fill-white dark:fill-neutral-900 stroke-indigo-600 dark:stroke-purple-400' : isMergeNode ? 'fill-emerald-100 dark:fill-emerald-900/40 stroke-emerald-300 dark:stroke-emerald-700' : isAuto ? 'fill-slate-100 dark:fill-neutral-800 stroke-slate-300 dark:stroke-neutral-700' : 'fill-white dark:fill-neutral-900 stroke-slate-300 dark:stroke-neutral-700'} ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'} ${inAnyMultiMode && !isSel ? 'opacity-60' : ''}`}
                                />

                                {/* Active "CURRENT" Pill */}
                                {isActive && (
                                    <g transform={`translate(${node.x + NODE_W / 2}, ${node.y - 4})`} className="pointer-events-none">
                                        <rect x={-26} y={-8} width={52} height={16} rx={8} className="fill-indigo-600 dark:fill-purple-500 shadow-sm" />
                                        <text x={0} y={1} fontSize="9" fontWeight="800" fill="white" textAnchor="middle" dominantBaseline="central" letterSpacing="0.5">CURRENT</text>
                                    </g>
                                )}

                                {/* Checkbox indicator in select mode */}
                                {selectMode && (
                                    <g transform={`translate(${node.x + NODE_W - 14}, ${node.y - 6})`}>
                                        <rect width={20} height={20} rx={6} ry={6}
                                            className={`transition-colors stroke-[2px] ${isSel ? 'fill-indigo-500 dark:fill-purple-500 stroke-indigo-500 dark:stroke-purple-500' : 'fill-white dark:fill-neutral-800 stroke-slate-300 dark:stroke-neutral-600'} shadow-sm`}
                                        />
                                        {isSel && (
                                            <polyline points="5.5,10.5 9,14 14.5,6" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                        )}
                                    </g>
                                )}

                                {isMergeNode && (
                                    <foreignObject x={node.x + 10} y={node.y + (NODE_H - 14) / 2} width={14} height={14}>
                                        <GitMerge size={14} className={isSel ? 'text-indigo-600 dark:text-purple-300' : 'text-emerald-500'} />
                                    </foreignObject>
                                )}
                                <text x={node.x + (isMergeNode ? 28 : 16)} y={node.y + NODE_H / 2} dominantBaseline="central"
                                    className={`text-[12px] font-bold pointer-events-none ${isSel ? 'fill-indigo-900 dark:fill-purple-100' : isActive ? 'fill-indigo-700 dark:fill-purple-300' : isAuto ? 'fill-slate-500 dark:fill-neutral-400' : 'fill-slate-700 dark:fill-neutral-200'}`}
                                >
                                    {(v.name || 'Untitled').length > 13 ? (v.name || 'Untitled').slice(0, 12) + '…' : (v.name || 'Untitled')}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>

            {contextMenu && (() => {
                const v = versions.find(vv => vv.id === contextMenu.nodeId);
                if (!v) return null;
                return (
                    <div className="absolute bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-slate-200 dark:border-neutral-700 p-1.5 z-30 w-44 flex flex-col gap-0.5 animate-in fade-in zoom-in-95" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => { onChangeVersion(v.id); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 rounded-lg transition-colors w-full text-left"><ChevronRight size={14} /> Switch to</button>
                        <button onClick={() => { onChangeVersion(v.id); onCreateVersion(null); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 rounded-lg transition-colors w-full text-left"><Copy size={14} /> Fork from here</button>
                        <button onClick={() => { onRenameVersion(v.id); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 rounded-lg transition-colors w-full text-left"><Edit3 size={14} /> Rename</button>
                        <button onClick={() => { enterSelectMode(); setSelected([v.id]); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-700 rounded-lg transition-colors w-full text-left"><CheckSquare size={14} /> Select</button>
                        {versions.length > 1 && (
                            <button onClick={() => { onDeleteVersion(v.id); setContextMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors w-full text-left"><Trash2 size={14} /> Delete</button>
                        )}
                    </div>
                );
            })()}
        </div>
    );
}
