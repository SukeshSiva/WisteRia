import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { writeTextFile, readTextFile, exists, mkdir, readDir, BaseDirectory, writeFile, remove } from '@tauri-apps/plugin-fs';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';
import { getTripSummary, loadFullTrip, upsertTrip, upsertEvent, upsertVersion, deleteEventFromDB, deleteVersionFromDB, upsertAttachment, syncFullTripState } from './db';
import { CURRENCIES } from './utils/constants';
import { generateId } from './utils/helpers';
import { handleExportPDF } from './utils/pdfExport';
import { callAppleAI } from './utils/aiHelpers';
import { Globe, Settings, Undo2, Redo2 } from 'lucide-react';

import Dashboard from './components/views/Dashboard';
import TripView from './components/views/TripView';
import SetupModal from './components/modals/SetupModal';
import SettingsModal from './components/modals/SettingsModal';
import TripModal from './components/modals/TripModal';
import EventModal from './components/modals/EventModal';
import MagicUploadModal from './components/modals/MagicUploadModal';
import AppDialog from './components/modals/AppDialog';
import StartupSplashScreen from './components/views/StartupSplashScreen';

export default function App() {
  const [trips, setTrips] = useState([]);
  const [activeTripId, setActiveTripId] = useState(null);
  const [currency, setCurrency] = useState('USD');
  const [isExporting, setIsExporting] = useState(false);
  const [isAIEditing, setIsAIEditing] = useState(false);

  // Undo/Redo tracking
  const undoStackRef = React.useRef([]);
  const redoStackRef = React.useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Clear undo/redo when switching projects
  useEffect(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, [activeTripId]);

  const activeTripIdRef = React.useRef(activeTripId);
  const tripsRef = React.useRef(trips);
  useEffect(() => { activeTripIdRef.current = activeTripId; }, [activeTripId]);
  useEffect(() => { tripsRef.current = trips; }, [trips]);

  // App Settings
  const [customApiKey, setCustomApiKey] = useState('');
  const [useAppleAI, setUseAppleAI] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [appIconStyle, setAppIconStyle] = useState('dark');

  // Initialization & Profile
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [userProfile, setUserProfile] = useState(null); // { name: '', rootDir: '' }
  const [recentDirs, setRecentDirs] = useState([]); // Array of recent paths

  // In-app dialog state (replaces window.confirm / window.prompt / alert)
  const [dialogConfig, setDialogConfig] = useState(null);

  // --- Persist settings helper: writes to rootDir/settings.json ---
  const persistSettings = async (overrides = {}) => {
    if (!window.__TAURI_INTERNALS__) return;
    const rootDir = overrides.rootDir || userProfile?.rootDir;
    if (!rootDir) return;
    try {
      const current = {
        name: userProfile?.name || '',
        rootDir,
        theme: darkMode ? 'dark' : 'light',
        currency,
        customApiKey,
        useAppleAI,
        appIconStyle,
        ...overrides
      };
      await writeTextFile(`${rootDir}/settings.json`, JSON.stringify(current, null, 2));
    } catch (e) {
      console.error('Failed to persist settings:', e);
    }
  };

  const loadDirectoryProjects = async (rootDir) => {
    const loadedTrips = [];
    try {
      const projectsDir = `${rootDir}/projects`;
      if (await exists(projectsDir)) {
        const entries = await readDir(projectsDir);
        for (const entry of entries) {
          if (entry.isDirectory) {
            try {
              const summary = await getTripSummary(rootDir, entry.name);
              if (summary) {
                const isArchived = await exists(`${projectsDir}/${entry.name}/archived.txt`);
                loadedTrips.push({ ...summary, versions: [], archived: isArchived });
              }
            } catch (dbErr) {
              console.warn(`Could not load trip ${entry.name}:`, dbErr);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to scan projects directory:", e);
    }
    setTrips(loadedTrips);
    setActiveTripId(null);
  };

  useEffect(() => {
    async function initApp() {
      try {
        // Step 1: Read pointer.json from AppLocalData to find the user's directory
        const hasPointer = await exists('pointer.json', { baseDir: BaseDirectory.AppLocalData });
        if (hasPointer) {
          const pointerContent = await readTextFile('pointer.json', { baseDir: BaseDirectory.AppLocalData });
          let pointer;
          try { pointer = JSON.parse(pointerContent); } catch (e) { pointer = {}; }

          const rootDir = pointer.rootDir;
          if (pointer.recentDirs && Array.isArray(pointer.recentDirs)) {
            setRecentDirs(pointer.recentDirs);
          } else if (rootDir) {
            setRecentDirs([rootDir]);
          }

          // Step 2: Read settings.json from the user's chosen directory
          const settingsPath = `${rootDir}/settings.json`;
          if (await exists(settingsPath)) {
            const content = await readTextFile(settingsPath);
            const settings = JSON.parse(content);
            setUserProfile({ name: settings.name, rootDir: settings.rootDir || rootDir });

            if (settings.theme === 'dark') setDarkMode(true);
            else setDarkMode(false);

            if (settings.currency) setCurrency(settings.currency);
            if (settings.customApiKey) setCustomApiKey(settings.customApiKey);
            if (settings.useAppleAI) setUseAppleAI(true);
            if (settings.appIconStyle) {
              setAppIconStyle(settings.appIconStyle);
              try {
                const iconResName = settings.appIconStyle === 'dark' ? 'app-icon-dark.png' : 'app-icon-light.png';
                const absPath = await resolveResource(`../public/${iconResName}`);
                await invoke('set_dock_icon', { path: absPath });
              } catch (e) {
                console.error("Failed to set initial dock icon:", e);
              }
            }
            setShowSetup(false);

            // Load trips by scanning the projects directory
            await loadDirectoryProjects(rootDir);

          } else {
            // Pointer exists but settings.json missing in the directory
            setShowSetup(true);
          }
        } else {
          setShowSetup(true);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setShowSetup(true);
      } finally {
        setIsInitializing(false);
      }
    }
    if (window.__TAURI_INTERNALS__) {
      initApp();
    } else {
      setIsInitializing(false);
    }
  }, []);

  const handleTriggerSetup = () => {
    setIsSettingsOpen(false);
    setShowSetup(true);
  };

  const handleSwitchDirectory = async (newDir) => {
    if (!newDir || newDir === userProfile?.rootDir) return;

    try {
      // 1. Update the recent directories memory
      const newRecents = [newDir, ...recentDirs.filter(d => d !== newDir)].slice(0, 5); // Keep up to 5 unique
      setRecentDirs(newRecents);

      // 2. Write new pointer.json
      await writeTextFile('pointer.json', JSON.stringify({ rootDir: newDir, recentDirs: newRecents }), { baseDir: BaseDirectory.AppLocalData });

      // 3. Clear UI states
      setIsSettingsOpen(false);
      setShowSplash(true); // Retrigger animation to masquerade loading time

      // 4. Try loading the settings from the new directory if they exist
      const settingsPath = `${newDir}/settings.json`;
      if (await exists(settingsPath)) {
        const content = await readTextFile(settingsPath);
        const settings = JSON.parse(content);
        setUserProfile({ name: settings.name, rootDir: newDir });

        if (settings.theme === 'dark') setDarkMode(true);
        else setDarkMode(false);

        if (settings.currency) setCurrency(settings.currency);
        if (settings.appIconStyle) setAppIconStyle(settings.appIconStyle);

        // Load trips from new dir
        await loadDirectoryProjects(newDir);
        setShowSetup(false);
      } else {
        // Selected a directory entirely devoid of settings. Claim it through setup.
        setUserProfile((prev) => ({ ...prev, rootDir: newDir }));
        setShowSetup(true);
      }
    } catch (e) {
      console.error("Failed to switch directory:", e);
    }
  };

  useEffect(() => {
    // Sync the body background color so that overscroll/bounce effect matches the theme
    document.documentElement.style.backgroundColor = darkMode ? '#0a0a0a' : '#f8fafc';
    document.body.style.backgroundColor = darkMode ? '#0a0a0a' : '#f8fafc';

    // Set dark class on HTML so standard tailwind 'dark:' prefixes apply at root
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (window.__TAURI_INTERNALS__) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        getCurrentWindow().setTheme(darkMode ? 'dark' : 'light');
      }).catch(console.error);
    }
  }, [darkMode]);

  // Modals state
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [editingTripData, setEditingTripData] = useState(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isMagicModalOpen, setIsMagicModalOpen] = useState(false);

  // Form States
  const [editingEvent, setEditingEvent] = useState(null);
  const [pendingStartTime, setPendingStartTime] = useState(null);

  const activeTrip = trips.find(t => t.id === activeTripId);

  const getAttachmentUrl = (att, tripIdToUse = activeTripId) => {
    if (att.url) return att.url;
    if (att.localPath && userProfile?.rootDir) {
      return convertFileSrc(`${userProfile.rootDir}/projects/${tripIdToUse}/files/${att.localPath}`);
    }
    return '';
  };


  useEffect(() => {
    async function loadActiveTripDetails() {
      if (activeTripId && userProfile) {
        try {
          const fullTrip = await loadFullTrip(userProfile.rootDir, activeTripId);
          if (fullTrip) {
            setTrips(prev => prev.map(t => t.id === activeTripId ? fullTrip : t));
          }
        } catch (e) {
          console.error("Failed to load active trip details", e);
        }
      }
    }
    loadActiveTripDetails();
  }, [activeTripId, userProfile]);

  // --- Handlers ---
  const handleSetupComplete = async (name, rootDir) => {
    try {
      // Write settings.json to the user's chosen directory
      const settings = {
        name, rootDir,
        theme: darkMode ? 'dark' : 'light',
        currency, customApiKey, useAppleAI, appIconStyle
      };

      // Ensure the root directory and projects folder exist
      const projectsDir = `${rootDir}/projects`;
      try {
        await mkdir(rootDir, { recursive: true });
        await mkdir(projectsDir, { recursive: true });
      } catch (err) {
        console.log("Directory creation info:", err);
      }

      // Write settings to the user's directory
      await writeTextFile(`${rootDir}/settings.json`, JSON.stringify(settings, null, 2));

      // Write pointer.json to AppLocalData so app knows where to look on next launch
      try { await mkdir('', { baseDir: BaseDirectory.AppLocalData, recursive: true }); } catch (e) { }
      await writeTextFile('pointer.json', JSON.stringify({ rootDir }, null, 2), { baseDir: BaseDirectory.AppLocalData });

      setUserProfile({ name, rootDir });
      setShowSetup(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save profile settings.");
    }
  };

  const saveTrip = async (tripData) => {
    try {
      if (editingTripData) {
        const updatedTrip = { ...activeTrip, ...tripData, id: editingTripData.id };
        await upsertTrip(userProfile.rootDir, updatedTrip);
        setTrips(trips.map(t => t.id === editingTripData.id ? updatedTrip : t));
      } else {
        const newTrip = {
          ...tripData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          activeVersionId: 'v1',
          versions: [{ id: 'v1', name: 'Draft 1', events: [] }]
        };
        await upsertTrip(userProfile.rootDir, newTrip);
        await upsertVersion(userProfile.rootDir, newTrip.id, newTrip.versions[0]);
        const newTrips = [...trips, newTrip];
        setTrips(newTrips);
        // Persist trip registry
        persistSettings({ tripIds: newTrips.map(t => t.id) });
      }
      setIsTripModalOpen(false);
      setEditingTripData(null);
    } catch (e) {
      console.error("Database save failed:", e);
      alert("Failed to save trip to local database. " + (e.message || JSON.stringify(e) || e));
    }
  };

  const handleDeleteTrip = async (tripId) => {
    try {
      if (!userProfile?.rootDir) return;
      const tripDir = `${userProfile.rootDir}/projects/${tripId}`;
      if (await exists(tripDir)) {
        await remove(tripDir, { recursive: true });
      }
      setTrips(currentTrips => currentTrips.filter(t => t.id !== tripId));
    } catch (err) {
      console.error('Failed to delete trip:', err);
      alert("Failed to delete project folder.");
    }
  };

  const handleArchiveTrip = async (tripId, archiveState) => {
    try {
      if (!userProfile?.rootDir) return;
      const markerPath = `${userProfile.rootDir}/projects/${tripId}/archived.txt`;
      if (archiveState) {
        // Create marker
        await writeTextFile(markerPath, '');
      } else {
        // Remove marker
        if (await exists(markerPath)) {
          await remove(markerPath);
        }
      }
      setTrips(currentTrips => currentTrips.map(t => t.id === tripId ? { ...t, archived: archiveState } : t));
    } catch (err) {
      console.error('Failed to change archive state:', err);
    }
  };

  // --- Deferred DB flush: collect pending changes, flush every 3 min ---
  const pendingFlushRef = React.useRef(null); // { tripId, versionId, events, oldEvents }
  const flushTimerRef = React.useRef(null);

  const flushToDB = async () => {
    const pending = pendingFlushRef.current;
    if (!pending) return;
    pendingFlushRef.current = null;

    setIsSaving(true);
    try {
      if (userProfile?.rootDir) {
        if (pending.fullTripSync) {
          // Overwrite entire trip state in DB (for Undo/Redo)
          await syncFullTripState(userProfile.rootDir, pending.fullTripSync);
        } else {
          // Upsert all current events
          for (const ev of pending.events) {
            await upsertEvent(userProfile.rootDir, pending.tripId, pending.versionId, ev);
            if (Array.isArray(ev.attachments)) {
              for (const att of ev.attachments) {
                if (!att.id) att.id = generateId();
                await upsertAttachment(userProfile.rootDir, pending.tripId, ev.id, att);
              }
            }
          }
          // Delete removed events
          if (pending.oldEvents) {
            const deletedEvents = pending.oldEvents.filter(oldEv => !pending.events.some(newEv => newEv.id === oldEv.id));
            for (const ev of deletedEvents) {
              await deleteEventFromDB(userProfile.rootDir, pending.tripId, ev.id);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to flush to DB:", e);
    }
    setIsSaving(false);
  };

  const scheduleDeferredFlush = () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => flushToDB(), 2000); // 2 seconds
  };

  // Flush on unmount or when leaving a trip
  React.useEffect(() => {
    return () => { if (pendingFlushRef.current) flushToDB(); };
  }, [activeTripId]);

  const pushTripToUndoStack = (trip) => {
    undoStackRef.current.push(JSON.stringify(trip));
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const applyEventsToActiveVersion = async (tripId, mutatorFn, isUndoRedo = false) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    const activeVerIdx = trip.versions.findIndex(v => v.id === trip.activeVersionId);
    if (activeVerIdx === -1) return;

    const activeVer = trip.versions[activeVerIdx];

    if (!isUndoRedo) {
      pushTripToUndoStack(trip);
    }

    const newEvents = mutatorFn([...activeVer.events]);

    const updatedVersions = [...trip.versions];
    updatedVersions[activeVerIdx] = { ...activeVer, events: newEvents };

    // Update UI state synchronously (temp/memory)
    setTrips(currentTrips => currentTrips.map(t => {
      if (t.id === tripId) return { ...t, versions: updatedVersions };
      return t;
    }));

    // Handle attachments that need immediate file writes (data: URLs)
    try {
      if (userProfile?.rootDir) {
        for (const ev of newEvents) {
          if (Array.isArray(ev.attachments)) {
            for (const att of ev.attachments) {
              if (att.url && att.url.startsWith('data:')) {
                // Determine file extension
                const ext = att.name ? att.name.split('.').pop() : (att.type === 'application/pdf' ? 'pdf' : 'jpg');
                // Use the event title for the file name (sanitized) to reflect content
                const contentName = ev.title ? ev.title.replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'attachment';
                const fileId = generateId();
                const newFileName = `${contentName}_${fileId}.${ext}`;
                const fileDir = `${userProfile.rootDir}/projects/${tripId}/files`;
                const filePath = `${fileDir}/${newFileName}`;
                try {
                  await mkdir(fileDir, { recursive: true }).catch(() => { });
                  const buf = await (await fetch(att.url)).arrayBuffer();
                  await writeFile(filePath, new Uint8Array(buf));
                  att.localPath = newFileName;
                  delete att.url;
                } catch (err) {
                  console.error("Failed to write attachment to disk", err);
                }
              }
              if (!att.id) att.id = generateId();
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to process attachments:", e);
    }

    // Queue for deferred DB flush
    pendingFlushRef.current = {
      tripId,
      versionId: activeVer.id,
      events: newEvents,
      oldEvents: activeVer.events
    };
    scheduleDeferredFlush();
  };



  const handleUndo = () => {
    const currentTripId = activeTripIdRef.current;
    if (undoStackRef.current.length === 0 || !currentTripId) return;
    const prevStateStr = undoStackRef.current.pop();

    const trip = tripsRef.current.find(t => t.id === currentTripId);
    if (trip) {
      redoStackRef.current.push(JSON.stringify(trip));
    }

    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);

    const prevState = JSON.parse(prevStateStr);

    // Restore full trip state
    setTrips(currentTrips => currentTrips.map(t => t.id === currentTripId ? prevState : t));

    // Deferred DB flush for entire trip (overwrite DB)
    pendingFlushRef.current = {
      tripId: currentTripId,
      fullTripSync: prevState
    };
    scheduleDeferredFlush();
  };

  const handleRedo = () => {
    const currentTripId = activeTripIdRef.current;
    if (redoStackRef.current.length === 0 || !currentTripId) return;
    const nextStateStr = redoStackRef.current.pop();

    const trip = tripsRef.current.find(t => t.id === currentTripId);
    if (trip) {
      undoStackRef.current.push(JSON.stringify(trip));
    }

    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);

    const nextState = JSON.parse(nextStateStr);

    // Restore full trip state
    setTrips(currentTrips => currentTrips.map(t => t.id === currentTripId ? nextState : t));

    // Deferred DB flush for entire trip
    pendingFlushRef.current = {
      tripId: currentTripId,
      fullTripSync: nextState
    };
    scheduleDeferredFlush();
  };

  // Listen for Tauri menu actions
  useEffect(() => {
    let unlisten;
    async function setupMenuListener() {
      if (window.__TAURI_INTERNALS__) {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen('menu-action', (event) => {
          const action = event.payload;
          if (action === 'undo') handleUndo();
          else if (action === 'redo') handleRedo();
          else if (action === 'new-project') setIsTripModalOpen(true);
        });
      }
    }
    setupMenuListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []); // Run once, handlers use refs for dynamic state

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsTripModalOpen(false);
        setIsEventModalOpen(false);
        setIsSettingsOpen(false);
        setIsMagicModalOpen(false);
        if (dialogConfig) {
          dialogConfig.onCancel?.();
        }
      }

      // Ignore Undo/Redo if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogConfig]);

  const saveEvent = (eventData) => {
    applyEventsToActiveVersion(activeTripId, (updatedEvents) => {
      if (editingEvent && editingEvent.id) {
        const idx = updatedEvents.findIndex(e => e.id === editingEvent.id);
        updatedEvents[idx] = { ...updatedEvents[idx], ...eventData };
      } else {
        const newEvent = { ...eventData, id: generateId() };
        updatedEvents.push(newEvent);
      }

      updatedEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      let currentMaxTimeMs = 0;
      for (let i = 0; i < updatedEvents.length; i++) {
        const e = { ...updatedEvents[i] };
        const sMs = new Date(e.startTime).getTime();
        const eDur = (e.endTime ? new Date(e.endTime).getTime() : sMs + 3600000) - sMs;

        if (sMs < currentMaxTimeMs) {
          e.startTime = new Date(currentMaxTimeMs).toISOString();
          e.endTime = new Date(currentMaxTimeMs + eDur).toISOString();
          currentMaxTimeMs += eDur;
        } else {
          currentMaxTimeMs = sMs + eDur;
        }
        updatedEvents[i] = e;
      }
      return updatedEvents;
    });
    setIsEventModalOpen(false);
    setEditingEvent(null);
  };

  const deleteEvent = async (eventId) => {
    const confirmed = await showDialog({
      type: 'confirm',
      title: 'Delete Event',
      message: 'Are you sure you want to delete this event?',
      confirmText: 'Delete',
      danger: true
    });
    if (!confirmed) return;
    applyEventsToActiveVersion(activeTripId, (events) => events.filter(e => e.id !== eventId));
  };

  const restoreEvent = (eventData) => {
    applyEventsToActiveVersion(activeTripId, (events) => {
      const restored = { ...eventData };
      if (!restored.id) restored.id = generateId();
      events.push(restored);
      events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      return events;
    });
  };

  const updateEventDuration = (eventId, deltaMs) => {
    applyEventsToActiveVersion(activeTripId, (events) => {
      events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      const targetIdx = events.findIndex(e => e.id === eventId);
      if (targetIdx === -1) return events;

      const targetEvent = { ...events[targetIdx] };
      const oldStartMs = new Date(targetEvent.startTime).getTime();
      const oldEndMs = targetEvent.endTime ? new Date(targetEvent.endTime).getTime() : oldStartMs + 3600000;
      const newEndMs = oldEndMs + deltaMs;

      if (newEndMs <= oldStartMs) return events;

      targetEvent.endTime = new Date(newEndMs).toISOString();
      events[targetIdx] = targetEvent;

      let previousEndMs = newEndMs;

      for (let i = targetIdx + 1; i < events.length; i++) {
        let ev = { ...events[i] };
        const evStartMs = new Date(ev.startTime).getTime();
        const evDurMs = (ev.endTime ? new Date(ev.endTime).getTime() : evStartMs + 3600000) - evStartMs;

        if (deltaMs > 0) {
          if (evStartMs < previousEndMs) {
            ev.startTime = new Date(previousEndMs).toISOString();
            ev.endTime = new Date(previousEndMs + evDurMs).toISOString();
            previousEndMs = previousEndMs + evDurMs;
          } else {
            break;
          }
        } else if (deltaMs < 0) {
          if (Math.abs(evStartMs - (previousEndMs - deltaMs)) < 60000) {
            ev.startTime = new Date(previousEndMs).toISOString();
            ev.endTime = new Date(previousEndMs + evDurMs).toISOString();
            previousEndMs = previousEndMs + evDurMs;
          } else {
            break;
          }
        }
        events[i] = ev;
      }
      return events;
    });
  };

  const reorderEventsList = (draggedId, targetId) => {
    applyEventsToActiveVersion(activeTripId, (events) => {
      events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      const dragIdx = events.findIndex(e => e.id === draggedId);
      const dropIdx = events.findIndex(e => e.id === targetId);
      if (dragIdx === -1 || dropIdx === -1 || dragIdx === dropIdx) return events;

      const draggedEvent = events[dragIdx];
      events.splice(dragIdx, 1);

      const newDropIdx = events.findIndex(e => e.id === targetId);
      const targetEvent = events[newDropIdx];

      let currentTimeMs = new Date(targetEvent.startTime).getTime();
      events.splice(newDropIdx, 0, draggedEvent);

      for (let i = newDropIdx; i < events.length; i++) {
        const ev = events[i];
        const evStart = new Date(ev.startTime).getTime();
        const evDur = new Date(ev.endTime || ev.startTime).getTime() - evStart;

        if (i === newDropIdx) {
          ev.startTime = new Date(currentTimeMs).toISOString();
          ev.endTime = new Date(currentTimeMs + evDur).toISOString();
          currentTimeMs += evDur;
        } else {
          if (currentTimeMs > evStart) {
            ev.startTime = new Date(currentTimeMs).toISOString();
            ev.endTime = new Date(currentTimeMs + evDur).toISOString();
            currentTimeMs += evDur;
          } else {
            currentTimeMs = evStart + evDur;
          }
        }
      }
      return events;
    });
  };

  const moveEventToTime = (eventId, targetDate, targetMins, startISO, endISO) => {
    applyEventsToActiveVersion(activeTripId, (events) => {
      const evIdx = events.findIndex(e => e.id === eventId);
      if (evIdx === -1) return events;

      const ev = { ...events[evIdx] };

      if (startISO && endISO) {
        // New direct ISO signature from TimelineView
        ev.startTime = startISO;
        ev.endTime = endISO;
      } else if (targetDate) {
        // Legacy signature
        const startMsOriginal = new Date(ev.startTime).getTime();
        const endMsOriginal = ev.endTime ? new Date(ev.endTime).getTime() : startMsOriginal + 3600000;
        const durMs = endMsOriginal - startMsOriginal;
        const newStart = new Date(targetDate);
        newStart.setHours(Math.floor(targetMins / 60), targetMins % 60, 0, 0);
        ev.startTime = newStart.toISOString();
        ev.endTime = new Date(newStart.getTime() + durMs).toISOString();
      }

      events[evIdx] = ev;
      events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      return events;
    });
  };

  // --- Versioning and AI Handlers ---
  const changeVersion = async (versionId) => {
    const trip = trips.find(t => t.id === activeTripId);
    if (!trip) return;
    pushTripToUndoStack(trip);

    const updatedTrip = { ...trip, activeVersionId: versionId };
    setTrips(trips.map(t => t.id === activeTripId ? updatedTrip : t));
    try {
      await upsertTrip(userProfile.rootDir, updatedTrip);
    } catch (e) {
      console.error("Failed to update active version in DB", e);
    }
  };

  const createVersion = async (customName = null, baseEventsOverride = null) => {
    const trip = trips.find(t => t.id === activeTripId);
    if (!trip) return;
    pushTripToUndoStack(trip);

    const activeVer = trip.versions.find(v => v.id === trip.activeVersionId);

    // Copy events and generate new IDs for them
    let newEvents = baseEventsOverride || JSON.parse(JSON.stringify(activeVer.events));
    newEvents = newEvents.map(e => ({ ...e, id: generateId() }));

    const newVer = {
      id: generateId(),
      name: customName || `Version ${trip.versions.length + 1}`,
      parentId: trip.activeVersionId,
      mergedFromId: null,
      createdAt: new Date().toISOString(),
      events: newEvents
    };

    const updatedTrip = { ...trip, versions: [...trip.versions, newVer], activeVersionId: newVer.id };
    setTrips(trips.map(t => t.id === activeTripId ? updatedTrip : t));

    try {
      await upsertVersion(userProfile.rootDir, updatedTrip.id, newVer);
      for (const ev of newEvents) {
        await upsertEvent(userProfile.rootDir, updatedTrip.id, newVer.id, ev);
      }
      await upsertTrip(userProfile.rootDir, updatedTrip); // update activeVersionId
    } catch (e) {
      console.error("Failed to create version in DB", e);
    }
  };

  // Helper to show in-app dialogs (replaces window.confirm/prompt/alert)
  const showDialog = (config) => {
    return new Promise((resolve) => {
      setDialogConfig({
        ...config,
        onConfirm: (value) => { setDialogConfig(null); resolve(config.type === 'prompt' ? value : true); },
        onCancel: () => { setDialogConfig(null); resolve(config.type === 'prompt' ? null : false); }
      });
    });
  };

  const renameVersion = async (versionId) => {
    const trip = trips.find(t => t.id === activeTripId);
    if (!trip) return;
    const ver = trip.versions.find(v => v.id === versionId);
    if (!ver) return;
    const name = await showDialog({
      type: 'prompt',
      title: 'Rename Version',
      message: 'Enter a new name for this version:',
      defaultValue: ver.name,
      placeholder: 'Version name',
      confirmText: 'Rename'
    });
    if (!name || name === ver.name) return;

    pushTripToUndoStack(trip);

    const updatedVer = { ...ver, name };
    setTrips(prev => prev.map(t => t.id === activeTripId ? {
      ...t, versions: t.versions.map(v => v.id === versionId ? updatedVer : v)
    } : t));

    try {
      await upsertVersion(userProfile.rootDir, trip.id, updatedVer);
    } catch (e) {
      console.error("Failed to rename version in DB", e);
    }
  };

  const deleteVersion = async (versionIds, skipConfirm = false) => {
    const idsToDelete = Array.isArray(versionIds) ? versionIds : [versionIds];
    const trip = trips.find(t => t.id === activeTripId);
    if (!trip) return;

    if (trip.versions.length <= idsToDelete.length) {
      await showDialog({ type: 'alert', title: 'Cannot Delete', message: 'Cannot delete all layout versions. You must keep at least one.' });
      return;
    }

    if (!skipConfirm) {
      const ver = trip.versions.find(v => v.id === idsToDelete[0]);
      const confirmed = await showDialog({
        type: 'confirm',
        title: 'Delete Version',
        message: `Are you sure you want to delete "${ver?.name || 'this version'}"?`,
        confirmText: 'Delete',
        danger: true
      });
      if (!confirmed) return;
    }

    pushTripToUndoStack(trip);

    const newVersions = trip.versions.filter(v => !idsToDelete.includes(v.id));
    const activeDeleted = idsToDelete.includes(trip.activeVersionId);
    const updatedTrip = {
      ...trip,
      versions: newVersions,
      activeVersionId: activeDeleted ? newVersions[newVersions.length - 1].id : trip.activeVersionId
    };

    setTrips(trips.map(t => t.id === activeTripId ? updatedTrip : t));

    try {
      for (const id of idsToDelete) {
        await deleteVersionFromDB(userProfile.rootDir, trip.id, id);
      }
      if (activeDeleted) {
        await upsertTrip(userProfile.rootDir, updatedTrip);
      }
    } catch (e) {
      console.error("Failed to delete version(s) from DB", e);
    }
  };

  const mergeVersions = async (targetId, sourceId) => {
    const trip = trips.find(t => t.id === activeTripId);
    if (!trip) return;
    const targetVer = trip.versions.find(v => v.id === targetId);
    const sourceVer = trip.versions.find(v => v.id === sourceId);
    if (!targetVer || !sourceVer) return;

    pushTripToUndoStack(trip);

    // Union of events: take all from target, add any from source that don't conflict (by title+startTime)
    const targetEvents = JSON.parse(JSON.stringify(targetVer.events));
    const sourceEvents = JSON.parse(JSON.stringify(sourceVer.events));

    const existingKeys = new Set(targetEvents.map(e => `${e.title}::${e.startTime}`));
    const merged = [...targetEvents];
    for (const ev of sourceEvents) {
      const key = `${ev.title}::${ev.startTime}`;
      if (!existingKeys.has(key)) {
        merged.push({ ...ev, id: generateId() });
        existingKeys.add(key);
      }
    }

    const mergeVer = {
      id: generateId(),
      name: `Merge: ${targetVer.name} + ${sourceVer.name}`,
      parentId: targetId,
      mergedFromId: sourceId,
      createdAt: new Date().toISOString(),
      events: merged
    };

    const updatedTrip = { ...trip, versions: [...trip.versions, mergeVer], activeVersionId: mergeVer.id };
    setTrips(trips.map(t => t.id === activeTripId ? updatedTrip : t));

    try {
      await upsertVersion(userProfile.rootDir, updatedTrip.id, mergeVer);
      for (const ev of merged) {
        await upsertEvent(userProfile.rootDir, updatedTrip.id, mergeVer.id, ev);
      }
      await upsertTrip(userProfile.rootDir, updatedTrip);
    } catch (e) {
      console.error("Failed to merge versions in DB", e);
    }
  };



  // --- Set as Root: prune all ancestor versions before the selected node ---
  const setRootVersion = async (versionId) => {
    const trip = trips.find(t => t.id === activeTripId);
    if (!trip) return;

    // Collect all ancestor IDs of versionId
    const ancestorIds = new Set();
    let current = trip.versions.find(v => v.id === versionId);
    let walkId = current?.parentId;
    while (walkId) {
      ancestorIds.add(walkId);
      const parent = trip.versions.find(v => v.id === walkId);
      walkId = parent?.parentId;
    }

    if (ancestorIds.size === 0) return; // already root

    pushTripToUndoStack(trip);

    // Filter out ancestors, update the chosen version to have no parent
    const newVersions = trip.versions
      .filter(v => !ancestorIds.has(v.id))
      .map(v => {
        if (v.id === versionId) return { ...v, parentId: null };
        // Reparent any version whose parentId was an ancestor (shouldn't normally happen, but safety)
        if (v.parentId && ancestorIds.has(v.parentId)) return { ...v, parentId: versionId };
        // Clear mergedFromId if it pointed to a deleted ancestor
        if (v.mergedFromId && ancestorIds.has(v.mergedFromId)) return { ...v, mergedFromId: null };
        return v;
      });

    const newActiveId = ancestorIds.has(trip.activeVersionId) ? versionId : trip.activeVersionId;
    const updatedTrip = { ...trip, versions: newVersions, activeVersionId: newActiveId };
    setTrips(trips.map(t => t.id === activeTripId ? updatedTrip : t));

    try {
      // Delete ancestor versions from DB
      for (const ancId of ancestorIds) {
        await deleteVersionFromDB(userProfile.rootDir, trip.id, ancId);
      }
      // Update the new root version (clear parentId)
      const rootVer = newVersions.find(v => v.id === versionId);
      if (rootVer) await upsertVersion(userProfile.rootDir, trip.id, rootVer);
      await upsertTrip(userProfile.rootDir, updatedTrip);
    } catch (e) {
      console.error("Failed to set root version", e);
    }
  };

  const handleAIEdit = async (prompt) => {
    if (!prompt.trim()) return;
    setIsAIEditing(true);

    const trip = trips.find(t => t.id === activeTripId);
    const activeVer = trip.versions.find(v => v.id === trip.activeVersionId);
    const activeKey = customApiKey;

    if (!useAppleAI && !activeKey) {
      alert("Please enter a valid Gemini API Key in the Settings to use Magic Edit.");
      setIsAIEditing(false);
      return;
    }

    let contextualPromptAdditions = "";
    if (trip && trip.currency) {
      contextualPromptAdditions += `\nCurrency: ${trip.currency}\nBudget: ${trip.budget || 0} per person\n`;
    }

    try {
      // Create a stripped down version of the events to send to the AI
      // Attachments (especially base64 images) will blow up the context window
      const leanEventsForAI = activeVer.events.map(ev => {
        const { attachments, ...rest } = ev;
        return rest;
      });

      const systemPrompt = `You are an AI travel assistant. The user wants to modify their itinerary.
          Destination: ${trip.destination}
          Trip Dates: ${trip.startDate} to ${trip.endDate}${contextualPromptAdditions}

          Current Itinerary (JSON array):
          ${JSON.stringify(leanEventsForAI)}

          User Request: "${prompt}"

          Instructions:
          1. Apply the user's request carefully. Add, remove, update times, or reorder events exactly as requested.
          2. Ensure no overlapping times unless strictly logical.
          3. Format 'startTime' and 'endTime' strictly as "YYYY-MM-DDTHH:mm". Calculate correct durations. MUST adjust the date portions (YYYY-MM-DD) if asked to move events to "Day 1", "Day 2" etc., where Day 1 is the Trip Start Date.
          4. Retain existing IDs ('id') for events that you keep or move. Generate short random IDs for completely new events.
          5. For ANY NEW events you create (like restaurants, cafes, tourist spots):
             - You MUST provide a specific, real-world 'title' (e.g., "Cafe de Flore", not "Good Cafe").
             - You MUST estimate realistic 'cost' based on typical pricing for the destination.
             - You MUST generate a realistic 'locationLink' (e.g., a Google Maps search URL or actual Maps URL if you know it).
          6. Ensure every event is categorized with a valid 'type': 'flight', 'train', 'bus', 'lodging', 'food', 'activity', 'walk', 'shop', or 'rest'. Do not leave type empty or invent new types.
          7. Return ONLY the ENTIRE updated itinerary as a JSON array of event objects. Include all events that were not removed. Do not wrap in markdown fences.`;

      let text;
      if (useAppleAI) {
        const applePrompt = systemPrompt + "\n\nRespond ONLY with the JSON array, nothing else.";
        text = await callAppleAI(applePrompt, "json");
      } else {
        const ai = new GoogleGenAI({ apiKey: activeKey });
        const res = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: systemPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  id: { type: 'STRING' },
                  title: { type: 'STRING' },
                  type: { type: 'STRING' },
                  startTime: { type: 'STRING' },
                  endTime: { type: 'STRING' },
                  cost: { type: 'NUMBER' },
                  notes: { type: 'STRING' },
                  locationLink: { type: 'STRING' }
                }
              }
            }
          }
        });
        text = res.text;
      }
      if (!text) throw new Error("No response");

      let newEvents;
      try {
        newEvents = JSON.parse(text);
      } catch (e) {
        const cleanText = text.replace(/```(?:json)?\n?|\n?```/g, '').trim();
        newEvents = JSON.parse(cleanText);
      }

      // We must re-attach the original attachments to any events that were kept
      newEvents = newEvents.map(newEv => {
        const orig = activeVer.events.find(oldEv => oldEv.id === newEv.id);
        if (orig && orig.attachments) {
          return { ...newEv, attachments: orig.attachments };
        }
        return newEv;
      });

      createVersion(`AI: ${prompt.substring(0, 15)}...`, newEvents);

    } catch (err) {
      console.error("AI Edit Error:", err);
      alert('Failed to process AI Edit: ' + err.message);
    } finally {
      setIsAIEditing(false);
    }
  };

  const handleExtractedData = (extractedData) => {
    if (Array.isArray(extractedData)) {
      const newEvents = extractedData.map(e => ({
        ...e,
        id: generateId(),
        attachments: e.attachments || []
      }));
      applyEventsToActiveVersion(activeTripId, (events) => {
        let merged = [...events, ...newEvents].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        let currentMaxTimeMs = 0;
        for (let i = 0; i < merged.length; i++) {
          const e = { ...merged[i] };
          const sMs = new Date(e.startTime).getTime();
          const eDur = (e.endTime ? new Date(e.endTime).getTime() : sMs + 3600000) - sMs;
          if (sMs < currentMaxTimeMs) {
            e.startTime = new Date(currentMaxTimeMs).toISOString();
            e.endTime = new Date(currentMaxTimeMs + eDur).toISOString();
            currentMaxTimeMs += eDur;
          } else {
            currentMaxTimeMs = sMs + eDur;
          }
          merged[i] = e;
        }
        return merged;
      });
    } else {
      if (pendingStartTime && !extractedData.startTime) {
        extractedData.startTime = pendingStartTime;
      }
      setEditingEvent(extractedData);
      setIsEventModalOpen(true);
    }
    setPendingStartTime(null);
  };

  const processUniversalMagic = async (prompt, file, previewUrl) => {
    const activeKey = customApiKey;

    if (file && previewUrl) {
      // Process Image or PDF
      setIsAIEditing(true);
      try {
        const base64Data = previewUrl.split(',')[1];
        const sysPrompt = `Analyze this document/image (it is likely a travel ticket, booking confirmation, receipt, or itinerary). 
      Extract the trip event details into the following JSON schema exactly.
      Do not include markdown blocks, just the raw JSON object.
      {
        "title": "A short, descriptive title (e.g. 'Flight to NYC' or 'Dinner at Joe\\'s')",
        "type": "Must be exactly one of: 'flight', 'bus', 'train', 'food', 'lodging', 'activity', 'other'",
        "cost": number (The total cost extracted. If none found, return 0),
        "startTime": "YYYY-MM-DDTHH:mm" (The start date and time. Guess the year if missing but contextually obvious. If totally unknown, use '2026-01-01T12:00'),
        "endTime": "YYYY-MM-DDTHH:mm" (The end date and time, if applicable, else empty string),
        "notes": "Any important details like confirmation numbers, terminal, gate, seat, or addresses."
      }`;
        let textResponse;
        if (useAppleAI) {
          textResponse = await callAppleAI(sysPrompt, "json", base64Data, file.type);
        } else {
          if (!activeKey) {
            alert("Please enter a valid Gemini API Key in the Settings.");
            setIsAIEditing(false);
            return;
          }
          const ai = new GoogleGenAI({ apiKey: activeKey });
          const res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ inlineData: { data: base64Data, mimeType: file.type } }, sysPrompt],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  type: { type: 'STRING' },
                  cost: { type: 'NUMBER' },
                  startTime: { type: 'STRING' },
                  endTime: { type: 'STRING' },
                  notes: { type: 'STRING' }
                }
              }
            }
          });
          textResponse = res.text;
        }
        if (!textResponse) throw new Error("No response from AI");
        let extractedData;
        try { extractedData = JSON.parse(textResponse); } catch (e) {
          extractedData = JSON.parse(textResponse.replace(/```json\n?|\n?```/g, ''));
        }
        extractedData.attachments = [{ name: file.name, type: file.type, url: previewUrl }];
        handleExtractedData(extractedData);
      } catch (err) {
        console.error(err);
        alert('Failed to extract information from document: ' + err.message);
      } finally {
        setIsAIEditing(false);
      }
    } else if (prompt && prompt.trim().match(/https?:\/\//)) {
      // Process Map Link
      setIsAIEditing(true);
      try {
        let extractedData = { title: '', type: 'activity', locationLink: prompt.trim(), cost: 0, startTime: '', endTime: '', notes: '', attachments: [] };
        let regexSuccess = false;
        try {
          const parsedUrl = new URL(prompt.trim());
          let placeName = '';
          if (parsedUrl.pathname.includes('/place/')) {
            const parts = parsedUrl.pathname.split('/');
            const placeIndex = parts.indexOf('place');
            if (placeIndex !== -1 && parts[placeIndex + 1]) placeName = decodeURIComponent(parts[placeIndex + 1].split('@')[0].replace(/\+/g, ' '));
          } else if (parsedUrl.searchParams.has('q')) {
            placeName = decodeURIComponent(parsedUrl.searchParams.get('q').replace(/\+/g, ' '));
          } else if (parsedUrl.searchParams.has('query')) {
            placeName = decodeURIComponent(parsedUrl.searchParams.get('query').replace(/\+/g, ' '));
          }
          if (placeName) {
            placeName = placeName.replace(/\/$/, '').trim();
            extractedData.title = placeName;
            const lowerName = placeName.toLowerCase();
            if (lowerName.match(/restaurant|cafe|bistro|diner|pizza|burger|coffee|bakery|steak|sushi|kitchen|grill/)) extractedData.type = 'food';
            else if (lowerName.match(/hotel|resort|hostel|motel|inn|lodge|suites/)) extractedData.type = 'lodging';
            else if (lowerName.match(/airport|flight|airways|airlines/)) extractedData.type = 'flight';
            else if (lowerName.match(/station|train|railway|subway/)) extractedData.type = 'train';
            else if (lowerName.match(/bus|transit|coach/)) extractedData.type = 'bus';
            else extractedData.type = 'activity';
            regexSuccess = true;
          }
        } catch (e) { }
        if (!regexSuccess && !extractedData.title) {
          extractedData.title = 'Saved Map Location';
          extractedData.notes = 'Extracted from shortlink.';
        }
        setTimeout(() => {
          handleExtractedData(extractedData);
          setIsAIEditing(false);
        }, 500);
      } catch (err) {
        alert('Failed to extract details from link.');
        setIsAIEditing(false);
      }
    } else if (prompt && prompt.trim()) {
      // Process generic AI Edit or Local Simple Parse
      const txt = prompt.trim();
      const lower = txt.toLowerCase();

      // Check if this looks like a complex instruction
      const isComplex =
        txt.length > 80 ||
        /\b(move|change|update|delete|remove|reschedule|swap|postpone|shift|clear|replace|instead of|rearrange|reorganize|organize|sort|group|split)\b/i.test(lower) ||
        /\b(tomorrow|yesterday|next|later|earlier|day \d+|all|every)\b/i.test(lower) ||
        /\b(guess|estimate|suggest|plan|idea|recommend|help|what|how much|cost|price)\b/i.test(lower);

      if (isComplex) {
        // Fall back to full LLM edit route
        await handleAIEdit(txt);
      } else {
        // Clean title by stripping conversatonal filler at the beginning
        let cleanTitle = txt;
        cleanTitle = cleanTitle.replace(/^(add|create|make|new|schedule|book|put in)\s+(a|an|some|the)?\s*/i, '');
        cleanTitle = cleanTitle.replace(/^(i want to|let's|can we|can you)\s+(add|create|make|schedule|book|go to|visit)\s+(a|an|some|the)?\s*/i, '');
        // Capitalize first letter neatly
        cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

        // Local deterministic parsing for simple additions
        let extractedData = {
          title: cleanTitle,
          type: 'activity',
          cost: 0,
          startTime: '',
          endTime: '',
          notes: '',
          attachments: []
        };

        let neighborContext = "";

        // Check if there is an explicit drop time appended by the "Fill time" UI: e.g. "Coffee (at 2026-02-24T10:00)"
        const timeMatch = txt.match(/^(.*?)\s*\(at\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})\)$/i);
        if (timeMatch) {
          let st = timeMatch[1].trim();
          st = st.replace(/^(add|create|make|new|schedule|book|put in)\s+(a|an|some|the)?\s*/i, '');
          st = st.replace(/^(i want to|let's|can we|can you)\s+(add|create|make|schedule|book|go to|visit)\s+(a|an|some|the)?\s*/i, '');
          st = st.charAt(0).toUpperCase() + st.slice(1);
          extractedData.title = st;
          extractedData.startTime = timeMatch[2];

          // Calculate neighboring context for the prompt
          const trip = trips.find(t => t.id === activeTripId);
          if (trip) {
            const activeVer = trip.versions.find(v => v.id === trip.activeVersionId);
            if (activeVer && activeVer.events) {
              const sortedEvents = [...activeVer.events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
              const targetMs = new Date(extractedData.startTime).getTime();

              let prevEvent = null;
              let nextEvent = null;

              for (const e of sortedEvents) {
                const sMs = new Date(e.startTime).getTime();
                const eMs = e.endTime ? new Date(e.endTime).getTime() : sMs + 3600000;
                if (eMs <= targetMs) prevEvent = e;
                if (sMs >= targetMs && !nextEvent) nextEvent = e;
              }

              if (prevEvent) {
                neighborContext += `\nPrevious Event before this drop: ${prevEvent.title} (Ended at ${prevEvent.endTime ? prevEvent.endTime.split('T')[1] : 'unknown'}).`;
              }
              if (nextEvent) {
                const nStartMs = new Date(nextEvent.startTime).getTime();
                const gapMs = nStartMs - targetMs;
                const gapHours = Math.floor(gapMs / (1000 * 60 * 60));
                const gapMins = Math.floor((gapMs % (1000 * 60 * 60)) / (1000 * 60));
                neighborContext += `\nNext Event after this drop: ${nextEvent.title} (Starts at ${nextEvent.startTime.split('T')[1]}).`;
                neighborContext += `\nYou have a free time gap of ${gapHours} hours and ${gapMins} minutes before the next event.`;

                // If doing a LOCAL parse, we can automatically fill this gap!
                if (!isComplex && gapMs > 0) {
                  // Cap it at max 3 hours to prevent a local request from making a 16 hour dinner
                  const finalDurMs = Math.min(gapMs, 3 * 60 * 60 * 1000);
                  const calcEnd = new Date(targetMs + finalDurMs);
                  extractedData.endTime = new Date(calcEnd.getTime() - (calcEnd.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                }
              }
            }
          }
        }

        if (isComplex) {
          const finalPrompt = txt + (neighborContext ? `\n\n--- UI Context ---\nThe user executed this prompt by dropping it onto the timeline at ${extractedData.startTime ? extractedData.startTime.split('T')[1] : 'an unknown time'}.${neighborContext}\nPlease make sure the duration realistically fits within any free time limit mentioned above, and logically follows/precedes the neighboring events.` : "");
          // Fall back to full LLM edit route, equipped with the neighbor context block.
          await handleAIEdit(finalPrompt);
        } else {
          // Infer type based on common keywords in the clean title

          // Infer type based on common keywords in the clean title
          const titleLower = extractedData.title.toLowerCase();
          if (titleLower.match(/breakfast|lunch|dinner|meal|snack|restaurant|cafe|bistro|diner|pizza|burger|coffee|bakery|steak|sushi|kitchen|grill|drink|bar/)) {
            extractedData.type = 'food';
          } else if (titleLower.match(/hotel|resort|hostel|motel|inn|lodge|suites|sleep|stay/)) {
            extractedData.type = 'lodging';
          } else if (titleLower.match(/airport|flight|airways|airlines|fly/)) {
            extractedData.type = 'flight';
          } else if (titleLower.match(/station|train|railway|subway|metro/)) {
            extractedData.type = 'train';
          } else if (titleLower.match(/bus|transit|coach/)) {
            extractedData.type = 'bus';
          }

          // Instantly pop the modal open with the inferred data
          handleExtractedData(extractedData);
        }
      }
    }
  };

  // --- Modals ---
  const openNewTripModal = () => {
    setEditingTripData(null);
    setIsTripModalOpen(true);
  };

  const openEditTripModal = (trip) => {
    setEditingTripData(trip);
    setIsTripModalOpen(true);
  };

  const openNewEventModal = (initialData = null) => {
    if (typeof initialData === 'string') {
      setEditingEvent({ startTime: initialData });
    } else if (initialData && typeof initialData === 'object') {
      setEditingEvent(initialData);
    } else {
      setEditingEvent(null);
    }
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (event) => {
    setEditingEvent(event);
    setIsEventModalOpen(true);
  };

  const handleMagicAddOpen = (startTime = null) => {
    setPendingStartTime(typeof startTime === 'string' ? startTime : null);
    setIsMagicModalOpen(true);
  };


  const triggerExport = () => {
    handleExportPDF(activeTrip, currency, getAttachmentUrl, setIsExporting, userProfile?.rootDir, activeTripId);
  };

  if (isInitializing) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-[#0a0a0a]" />
    );
  }

  if (showSetup) {
    return (
      <div className={`min-h-screen font-sans bg-slate-50 transition-colors duration-300 ${darkMode ? 'dark-theme bg-neutral-950 text-neutral-50' : 'bg-slate-50 text-slate-900'}`}>
        <SetupModal onComplete={handleSetupComplete} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans selection:bg-purple-300 transition-colors duration-300 ${darkMode ? 'dark-theme bg-neutral-950 text-neutral-50' : 'bg-slate-50 text-slate-900'} ${showSplash ? 'overflow-hidden' : ''}`}>
      {showSplash && (
        <StartupSplashScreen
          userName={userProfile?.name}
          darkMode={darkMode}
          onComplete={() => setShowSplash(false)}
        />
      )}
      {darkMode && (
        <style>{`
          @media screen {
            /* Base Neutral Gray Palette Overrides based on user hex codes */
            .dark-theme { background-color: #0a0a0a !important; color: #fafafa !important; }
            
            .dark-theme .bg-white { background-color: #171717 !important; }
            .dark-theme .bg-slate-50 { background-color: #0a0a0a !important; }
            .dark-theme .bg-slate-100 { background-color: #262626 !important; }
            .dark-theme .bg-slate-200, .dark-theme .bg-slate-200\\/50 { background-color: #262626 !important; }
            .dark-theme .bg-slate-800 { background-color: #171717 !important; }
            .dark-theme .bg-slate-900 { background-color: #0a0a0a !important; }
            .dark-theme .bg-neutral-900 { background-color: #171717 !important; }
            .dark-theme .bg-neutral-950 { background-color: #0a0a0a !important; }
            
            .dark-theme .text-slate-900 { color: #fafafa !important; }
            .dark-theme .text-slate-800 { color: #f5f5f5 !important; }
            .dark-theme .text-slate-700 { color: #e5e5e5 !important; }
            .dark-theme .text-slate-600 { color: #d4d4d4 !important; }
            .dark-theme .text-slate-50 { color: #fafafa !important; }
            .dark-theme .text-slate-500 { color: #a1a1a1 !important; }
            .dark-theme .text-slate-400 { color: #737373 !important; }
            .dark-theme .text-slate-300 { color: #525252 !important; }
            
            .dark-theme .border-slate-100 { border-color: #262626 !important; }
            .dark-theme .border-slate-200 { border-color: #404040 !important; }
            .dark-theme .border-slate-300 { border-color: #525252 !important; }
            .dark-theme .border-slate-700 { border-color: #404040 !important; }
            .dark-theme .border-slate-800 { border-color: #525252 !important; }
            .dark-theme .border-dashed { border-color: #404040 !important; }
            
            /* UI Fixes for Broken Components in Dark Mode */
            .dark-theme .dark-bg-950 { background-color: #0a0a0a !important; }
            .dark-theme .dark-bg-900 { background-color: #171717 !important; }
            .dark-theme .dark-bg-800 { background-color: #262626 !important; }
            .dark-theme .dark-border-700 { border-color: #404040 !important; }
            
            /* Sticky Header Fixes */
            .dark-theme .bg-slate-50\\/90 { background-color: rgba(10, 10, 10, 0.9) !important; }
            
            /* Inputs */
            .dark-theme input, .dark-theme textarea, .dark-theme select {
                background-color: transparent !important;
                color: #fafafa !important;
                color-scheme: dark;
            }
            .dark-theme select option { background-color: #171717; color: #fafafa; }
            
            /* PURPLE ACCENT OVERRIDES */
            .dark-theme .bg-blue-600, .dark-theme .bg-indigo-600, .dark-theme .bg-purple-600 { background-color: #9333ea !important; color: #fff !important; }
            .dark-theme .hover\\:bg-blue-700:hover, .dark-theme .hover\\:bg-indigo-700:hover, .dark-theme .hover\\:bg-purple-700:hover { background-color: #7e22ce !important; }
            
            .dark-theme .text-blue-600, .dark-theme .text-indigo-600, 
            .dark-theme .text-blue-500, .dark-theme .text-indigo-500, .dark-theme .text-purple-400 { color: #c084fc !important; }
            
            .dark-theme .bg-blue-50, .dark-theme .bg-indigo-50, .dark-theme .bg-purple-900\\/10 { background-color: #171717 !important; border: 1px solid #404040 !important; color: #fafafa !important; }
            .dark-theme .text-indigo-700, .dark-theme .text-purple-300 { color: #d8b4fe !important; }

            /* AI Input specific colors */
            .dark-theme .bg-indigo-50.dark-bg-purple-900\\/10 { background-color: #171717 !important; }
            .dark-theme .bg-white.sm\\:bg-transparent { background-color: transparent !important; }

            /* View Toggles fix */
            .dark-theme .bg-slate-200\\/50 { background-color: #262626 !important; }
            .dark-theme .bg-white.text-slate-900.shadow-md { background-color: #404040 !important; color: #fff !important; }
          }
        `}</style>
      )}

      <header data-tauri-drag-region className="bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 sticky top-0 z-50 print:hidden transition-colors duration-300">
        <div data-tauri-drag-region className="max-w-6xl mx-auto px-4 min-h-[4rem] py-2 flex flex-wrap items-center justify-between gap-4">
          <div data-tauri-drag-region className="flex items-center gap-2 text-indigo-600 dark:text-purple-400 transition-colors pointer-events-none">
            <div className="flex items-center gap-3 animate-in slide-in-from-left-4 fade-in duration-500">
              <img src={appIconStyle === 'dark' ? "/app-icon-dark.png" : "/app-icon-light.png"} alt="WisteRia Icon" className="w-10 h-10 sm:w-12 sm:h-12 rounded-[1rem] sm:rounded-[1.25rem] shadow-sm border border-slate-200 dark:border-slate-700" />
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">WisteRia</h1>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 sm:gap-3 ml-auto z-10">
            {/* Undo/Redo Buttons */}
            {activeTripId && (
              <div className="flex items-center gap-1 mr-1 border-r border-slate-200 dark:border-neutral-700 pr-2">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="p-1.5 sm:p-2 text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-colors"
                  title="Undo (Cmd+Z)"
                >
                  <Undo2 size={20} className="sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className="p-1.5 sm:p-2 text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-colors"
                  title="Redo (Cmd+Shift+Z)"
                >
                  <Redo2 size={20} className="sm:w-5 sm:h-5" />
                </button>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 dark:text-neutral-300 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 px-3 py-1.5 rounded-lg">
              <select
                value={currency}
                onChange={(e) => { setCurrency(e.target.value); persistSettings({ currency: e.target.value }); }}
                className="bg-transparent font-medium outline-none cursor-pointer"
              >
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
              </select>
            </div>

            {/* AI Provider Toggle */}
            <button
              onClick={() => { const next = !useAppleAI; setUseAppleAI(next); persistSettings({ useAppleAI: next }); }}
              className="relative flex items-center w-[72px] h-9 bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-full p-0.5 transition-colors group"
              title={useAppleAI ? 'Apple Intelligence (click for Gemini)' : 'Gemini API (click for Apple Intelligence)'}
            >
              {/* Sliding pill */}
              <div className={`absolute top-0.5 w-8 h-8 rounded-full shadow-md transition-all duration-300 ${useAppleAI ? 'left-0.5 bg-black dark:bg-white' : 'left-[calc(100%-2.125rem-2px)] bg-indigo-600 dark:bg-purple-600'}`} />

              {/* Apple Icon (left side) */}
              <div className={`relative z-10 flex items-center justify-center w-8 h-8 transition-colors duration-300 ${useAppleAI ? 'text-white dark:text-black' : 'text-slate-400 dark:text-neutral-500'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
              </div>

              {/* Gemini Icon (right side) */}
              <div className={`relative z-10 flex items-center justify-center w-8 h-8 transition-colors duration-300 ${!useAppleAI ? 'text-white' : 'text-slate-400 dark:text-neutral-500'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
                </svg>
              </div>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 sm:p-2.5 text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
              title="Settings"
            >
              <Settings size={22} className="sm:w-6 sm:h-6" />
            </button>

            {/* Saving indicator */}
            {isSaving && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl animate-in fade-in" title="Saving to disk…">
                <svg className="animate-spin h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 hidden sm:inline">Saving…</span>
              </div>
            )}

            {activeTripId && (
              <button
                onClick={triggerExport}
                disabled={isExporting}
                className="flex items-center gap-2 bg-indigo-50 dark:bg-purple-900/30 hover:bg-indigo-100 dark:hover:bg-purple-900/50 text-indigo-700 dark:text-purple-300 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-70 disabled:cursor-wait"
              >
                {isExporting ? (
                  <><span className="animate-spin border-2 border-indigo-700/30 border-t-indigo-700 dark:border-t-purple-400 rounded-full w-4 h-4"></span> Generating PDF...</>
                ) : (
                  <><span className="hidden sm:inline">Export PDF</span></>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="trip-export-content" className={`max-w-6xl mx-auto px-4 py-8 sm:py-10 ${isExporting ? 'pdf-export' : ''}`}>
        {!activeTripId ? (
          <Dashboard
            userName={userProfile?.name}
            trips={trips}
            onOpenTrip={setActiveTripId}
            onNewTrip={openNewTripModal}
            onDeleteTrip={handleDeleteTrip}
            onArchiveTrip={handleArchiveTrip}
            showDialog={showDialog}
          />
        ) : (
          <TripView
            trip={activeTrip}
            currency={currency}
            getAttachmentUrl={getAttachmentUrl}
            onBack={() => setActiveTripId(null)}
            onEditTrip={() => openEditTripModal(activeTrip)}
            onAddEvent={openNewEventModal}
            onEditEvent={openEditEventModal}
            onDeleteEvent={deleteEvent}
            onMagicAdd={handleMagicAddOpen}
            onUpdateDuration={updateEventDuration}
            onReorderList={reorderEventsList}
            onMoveEventToTime={moveEventToTime}
            onRestoreEvent={restoreEvent}
            isExporting={isExporting}
            darkMode={darkMode}

            onChangeVersion={changeVersion}
            onCreateVersion={createVersion}
            onRenameVersion={renameVersion}
            onDeleteVersion={deleteVersion}
            onMergeVersions={mergeVersions}
            onSetRoot={setRootVersion}
            onAIEdit={handleAIEdit}
            onUniversalMagic={processUniversalMagic}
            isAIEditing={isAIEditing}
            showDialog={showDialog}
          />
        )}
      </main>

      {isSettingsOpen && (
        <SettingsModal
          currentKey={customApiKey}
          useAppleAI={useAppleAI}
          setUseAppleAI={(v) => setUseAppleAI(v)}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          appIconStyle={appIconStyle}
          setAppIconStyle={setAppIconStyle}
          userProfile={userProfile}
          useRecentDirs={recentDirs}
          onClose={() => setIsSettingsOpen(false)}
          onTriggerSetup={handleTriggerSetup}
          onSwitchDirectory={handleSwitchDirectory}
          onSave={async (key, apple, iconStyle, newName, newDir) => {
            setCustomApiKey(key);
            setUseAppleAI(apple);

            if (iconStyle !== appIconStyle) {
              setAppIconStyle(iconStyle);
              try {
                const iconResName = iconStyle === 'dark' ? 'app-icon-dark.png' : 'app-icon-light.png';
                const absPath = await resolveResource(`../public/${iconResName}`);
                await invoke('set_dock_icon', { path: absPath });
              } catch (e) {
                console.error("Failed to dynamically set macOS dock icon:", e);
              }
            }

            const updatedProfile = {
              name: newName || userProfile?.name,
              rootDir: newDir || userProfile?.rootDir
            };
            setUserProfile(updatedProfile);

            if (newDir !== userProfile?.rootDir) {
              // Directory changed: update pointer.json and create new projects folder
              try {
                await mkdir(`${updatedProfile.rootDir}/projects`, { recursive: true });
                await writeTextFile('pointer.json', JSON.stringify({ rootDir: updatedProfile.rootDir }, null, 2), { baseDir: BaseDirectory.AppLocalData });
              } catch (e) {
                console.error("Failed to update pointer:", e);
              }
              setTrips([]);
              setActiveTripId(null);
            }

            // Persist everything to rootDir/settings.json
            persistSettings({
              name: updatedProfile.name,
              rootDir: updatedProfile.rootDir,
              customApiKey: key,
              useAppleAI: apple,
              appIconStyle: iconStyle
            });

            setIsSettingsOpen(false);
          }}
        />
      )}

      {isTripModalOpen && (
        <TripModal
          initialData={editingTripData}
          onClose={() => { setIsTripModalOpen(false); setEditingTripData(null); }}
          onSave={saveTrip}
        />
      )}

      {isEventModalOpen && (
        <EventModal
          event={editingEvent}
          trip={activeTrip}
          currency={currency}
          onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); }}
          onSave={saveEvent}
          showDialog={showDialog}
        />
      )}

      {isMagicModalOpen && (
        <MagicUploadModal
          trip={activeTrip}
          customApiKey={customApiKey}
          useAppleAI={useAppleAI}
          onClose={() => setIsMagicModalOpen(false)}
          onExtracted={(extractedData) => {
            setIsMagicModalOpen(false);
            handleExtractedData(extractedData);
          }}
        />
      )}

      {dialogConfig && (
        <AppDialog
          open={true}
          type={dialogConfig.type}
          title={dialogConfig.title}
          message={dialogConfig.message}
          defaultValue={dialogConfig.defaultValue}
          placeholder={dialogConfig.placeholder}
          confirmText={dialogConfig.confirmText}
          cancelText={dialogConfig.cancelText}
          danger={dialogConfig.danger}
          icon={dialogConfig.icon}
          onConfirm={dialogConfig.onConfirm}
          onCancel={dialogConfig.onCancel}
        />
      )}
    </div>
  );
}
