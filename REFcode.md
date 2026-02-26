import React, { useState, useEffect, useRef } from 'react';
import { 
  Plane, Bus, Train, Coffee, Bed, Map, Calendar, DollarSign, 
  Paperclip, Plus, FileText, Download, X, Clock, MapPin, 
  ChevronLeft, Sparkles, Upload, Image as ImageIcon, Trash2, 
  AlertCircle, LayoutList, CalendarDays, Edit3, Globe, ChevronRight,
  GripVertical, Minus, Save, Settings
} from 'lucide-react';

// --- API Key provided by execution environment ---
const apiKey = "";

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const formatCurrency = (amount, currency = 'USD') => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(num);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'CAD', symbol: '$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: '$', label: 'Australian Dollar' }
];

// --- Icons Mapping ---
const EVENT_ICONS = {
  flight: <Plane size={20} />,
  bus: <Bus size={20} />,
  train: <Train size={20} />,
  food: <Coffee size={20} />,
  lodging: <Bed size={20} />,
  activity: <Map size={20} />,
  other: <FileText size={20} />
};

const EVENT_COLORS = {
  flight: 'bg-blue-100 text-blue-600 border-blue-300',
  bus: 'bg-emerald-100 text-emerald-600 border-emerald-300',
  train: 'bg-indigo-100 text-indigo-600 border-indigo-300',
  food: 'bg-orange-100 text-orange-600 border-orange-300',
  lodging: 'bg-purple-100 text-purple-600 border-purple-300',
  activity: 'bg-pink-100 text-pink-600 border-pink-300',
  other: 'bg-gray-100 text-gray-600 border-gray-300'
};

// --- Main Component ---
export default function App() {
  const [trips, setTrips] = useState([
    {
      id: '1',
      title: 'Summer Eurotrip',
      destination: 'France & Italy',
      startDate: '2026-06-15',
      endDate: '2026-06-30',
      activeVersionId: 'v1',
      versions: [
        {
          id: 'v1',
          name: 'Original Plan',
          events: [
            {
              id: 'e1',
              title: 'Flight to Paris',
              type: 'flight',
              cost: 850,
              startTime: '2026-06-15T18:30',
              endTime: '2026-06-16T08:00',
              locationLink: 'https://maps.app.goo.gl/exampleCDG',
              notes: 'Confirmation: XYZ123. Terminal 4.',
              attachments: []
            },
            {
              id: 'e2',
              title: 'Eiffel Tower Tour',
              type: 'activity',
              cost: 45.50,
              startTime: '2026-06-17T10:00',
              endTime: '2026-06-17T13:00',
              locationLink: 'https://maps.app.goo.gl/exampleEiffel',
              notes: 'Meet at the North Pillar.',
              attachments: []
            }
          ]
        }
      ]
    }
  ]);
  
  const [activeTripId, setActiveTripId] = useState(null);
  const [currency, setCurrency] = useState('USD');
  const [isExporting, setIsExporting] = useState(false);
  const [isAIEditing, setIsAIEditing] = useState(false);
  
  // App Settings
  const [customApiKey, setCustomApiKey] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // Modals state
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [editingTripData, setEditingTripData] = useState(null); 
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isMagicModalOpen, setIsMagicModalOpen] = useState(false);
  
  // Form States
  const [editingEvent, setEditingEvent] = useState(null);
  const [pendingStartTime, setPendingStartTime] = useState(null);

  const activeTrip = trips.find(t => t.id === activeTripId);

  // --- Handlers ---
  const saveTrip = (tripData) => {
    if (editingTripData) {
      setTrips(trips.map(t => t.id === editingTripData.id ? { ...t, ...tripData } : t));
    } else {
      setTrips([...trips, { 
        ...tripData, 
        id: generateId(), 
        activeVersionId: 'v1',
        versions: [{ id: 'v1', name: 'Draft 1', events: [] }] 
      }]);
    }
    setIsTripModalOpen(false);
    setEditingTripData(null);
  };

  const applyEventsToActiveVersion = (tripId, mutatorFn) => {
    setTrips(currentTrips => currentTrips.map(trip => {
      if (trip.id === tripId) {
        const activeVerIdx = trip.versions.findIndex(v => v.id === trip.activeVersionId);
        if (activeVerIdx === -1) return trip;
        
        const activeVer = trip.versions[activeVerIdx];
        const newEvents = mutatorFn([...activeVer.events]);
        
        const updatedVersions = [...trip.versions];
        updatedVersions[activeVerIdx] = { ...activeVer, events: newEvents };
        
        return { ...trip, versions: updatedVersions };
      }
      return trip;
    }));
  };

  const saveEvent = (eventData) => {
    applyEventsToActiveVersion(activeTripId, (updatedEvents) => {
        if (editingEvent && editingEvent.id) {
          const idx = updatedEvents.findIndex(e => e.id === editingEvent.id);
          updatedEvents[idx] = { ...updatedEvents[idx], ...eventData };
        } else {
          const newEvent = { ...eventData, id: generateId() };
          updatedEvents.push(newEvent);
        }

        updatedEvents.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

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

  const deleteEvent = (eventId) => {
    applyEventsToActiveVersion(activeTripId, (events) => events.filter(e => e.id !== eventId));
  };

  const updateEventDuration = (eventId, deltaMs) => {
    applyEventsToActiveVersion(activeTripId, (events) => {
      events.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
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
        events.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
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

  const moveEventToTime = (eventId, targetDate, targetMins) => {
    applyEventsToActiveVersion(activeTripId, (events) => {
      const evIdx = events.findIndex(e => e.id === eventId);
      if (evIdx === -1) return events;

      const ev = { ...events[evIdx] }; 
      const startMsOriginal = new Date(ev.startTime).getTime();
      const endMsOriginal = ev.endTime ? new Date(ev.endTime).getTime() : startMsOriginal + 3600000;
      const durMs = endMsOriginal - startMsOriginal;

      const newStart = new Date(targetDate);
      newStart.setHours(Math.floor(targetMins / 60), targetMins % 60, 0, 0);

      ev.startTime = newStart.toISOString();
      ev.endTime = new Date(newStart.getTime() + durMs).toISOString();

      events[evIdx] = ev; 
      events.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      let currentMaxTimeMs = 0;
      for (let i = 0; i < events.length; i++) {
          const e = { ...events[i] };
          const sMs = new Date(e.startTime).getTime();
          const eDur = (e.endTime ? new Date(e.endTime).getTime() : sMs + 3600000) - sMs;

          if (sMs < currentMaxTimeMs) {
              e.startTime = new Date(currentMaxTimeMs).toISOString();
              e.endTime = new Date(currentMaxTimeMs + eDur).toISOString();
              currentMaxTimeMs += eDur;
          } else {
              currentMaxTimeMs = sMs + eDur;
          }
          events[i] = e;
      }
      return events;
    });
  };

  // --- Versioning and AI Handlers ---
  const changeVersion = (versionId) => {
     setTrips(trips.map(t => t.id === activeTripId ? { ...t, activeVersionId: versionId } : t));
  };

  const createVersion = (customName = null, baseEventsOverride = null) => {
     setTrips(trips.map(t => {
         if (t.id === activeTripId) {
             const activeVer = t.versions.find(v => v.id === t.activeVersionId);
             const newEvents = baseEventsOverride || JSON.parse(JSON.stringify(activeVer.events));
             const newVer = {
                 id: generateId(),
                 name: customName || `Version ${t.versions.length + 1}`,
                 events: newEvents
             };
             return { ...t, versions: [...t.versions, newVer], activeVersionId: newVer.id };
         }
         return t;
     }));
  };

  const handleAIEdit = async (prompt) => {
      if (!prompt.trim()) return;
      setIsAIEditing(true);

      const trip = trips.find(t => t.id === activeTripId);
      const activeVer = trip.versions.find(v => v.id === trip.activeVersionId);
      const activeKey = customApiKey || apiKey;

      try {
          const systemPrompt = `You are an AI travel assistant. The user wants to modify their itinerary.
          Destination: ${trip.destination}
          Trip Dates: ${trip.startDate} to ${trip.endDate}

          Current Itinerary (JSON array):
          ${JSON.stringify(activeVer.events)}

          User Request: "${prompt}"

          Instructions:
          1. Apply the user's request carefully. Add, remove, update times, or reorder events exactly as requested.
          2. Ensure no overlapping times unless strictly logical.
          3. Format 'startTime' and 'endTime' strictly as "YYYY-MM-DDTHH:mm". Calculate correct durations.
          4. Retain existing IDs ('id') for events that you keep or move. Generate short random IDs for completely new events.
          5. Return ONLY the ENTIRE updated itinerary as a JSON array of event objects. Include all events that were not removed. Do not wrap in markdown fences.`;

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${activeKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
                  generationConfig: { responseMimeType: "application/json" }
              })
          });
          
          if (!res.ok) throw new Error("API Error");
          const result = await res.json();
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) throw new Error("No response");

          const newEvents = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
          createVersion(`AI: ${prompt.substring(0, 15)}...`, newEvents);

      } catch (err) {
          console.error(err);
          alert('Failed to process AI Edit. Please check your API settings or prompt.');
      } finally {
          setIsAIEditing(false);
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

  const handleExportPDF = async () => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    try {
      if (typeof window.html2pdf === 'undefined') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      const element = document.getElementById('trip-export-content');
      const filename = `${activeTrip?.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'itinerary'}.pdf`;

      const opt = {
        margin:       0.4,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'], avoid: '.pdf-avoid-break', before: '.pdf-page-break' }
      };
      
      await window.html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF Export failed:", error);
      alert("Failed to export PDF. Your browser environment may restrict file downloads.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-purple-300 transition-colors duration-300 ${darkMode ? 'dark-theme bg-neutral-950 text-neutral-50' : 'bg-slate-50 text-slate-900'}`}>
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
      {isExporting && (
        <style>{`
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:border-none { border: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:mb-6 { margin-bottom: 1.5rem !important; }
          .print\\:bg-white { background-color: #ffffff !important; }
          .print\\:text-slate-900 { color: #0f172a !important; }
          .print\\:text-slate-800 { color: #1e293b !important; }
          .print\\:text-slate-600 { color: #475569 !important; }
          .print\\:text-slate-500 { color: #64748b !important; }
          .print\\:bg-emerald-100 { background-color: #d1fae5 !important; }
          .print\\:text-emerald-600 { color: #059669 !important; }
          .print\\:border { border-width: 1px !important; }
          .print\\:border-slate-200 { border-color: #e2e8f0 !important; }
          .print\\:ml-2 { margin-left: 0.5rem !important; }
          .print\\:static { position: static !important; }
          .print\\:bg-transparent { background-color: transparent !important; }
          .pdf-page-break { page-break-before: always !important; break-before: page !important; }
          #trip-export-content {
            padding-top: 0 !important;
            margin-top: 0 !important;
          }
        `}</style>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 print:hidden transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 min-h-16 py-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-purple-400 transition-colors">
            <Globe className="w-6 h-6 shrink-0" />
            <h1 className="text-xl font-bold tracking-tight">VoyageCraft</h1>
          </div>
          
          <div className="flex items-center flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <DollarSign size={14} />
              <select 
                value={currency} 
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-transparent font-medium outline-none cursor-pointer"
              >
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
              </select>
            </div>
            
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Settings"
            >
                <Settings size={20} />
            </button>

            {activeTrip && (
              <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 bg-indigo-50 dark:bg-purple-900/30 hover:bg-indigo-100 dark:hover:bg-purple-900/50 text-indigo-700 dark:text-purple-300 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-70 disabled:cursor-wait"
              >
                {isExporting ? (
                   <><span className="animate-spin border-2 border-indigo-700/30 border-t-indigo-700 rounded-full w-4 h-4"></span> Generating PDF...</>
                ) : (
                   <><Download size={16} className="shrink-0" /> <span className="hidden sm:inline">Export PDF</span></>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="trip-export-content" className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {!activeTripId ? (
          <Dashboard 
            trips={trips} 
            onOpenTrip={setActiveTripId} 
            onNewTrip={openNewTripModal} 
          />
        ) : (
          <TripView 
            trip={activeTrip} 
            currency={currency}
            onBack={() => setActiveTripId(null)}
            onEditTrip={() => openEditTripModal(activeTrip)}
            onAddEvent={openNewEventModal}
            onEditEvent={openEditEventModal}
            onDeleteEvent={deleteEvent}
            onMagicAdd={handleMagicAddOpen}
            onUpdateDuration={updateEventDuration}
            onReorderList={reorderEventsList}
            onMoveEventToTime={moveEventToTime}
            isExporting={isExporting}
            darkMode={darkMode}
            
            // Versioning and AI
            onChangeVersion={changeVersion}
            onCreateVersion={createVersion}
            onAIEdit={handleAIEdit}
            isAIEditing={isAIEditing}
          />
        )}
      </main>

      {/* Modals */}
      {isSettingsOpen && (
          <SettingsModal 
            currentKey={customApiKey}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            onClose={() => setIsSettingsOpen(false)}
            onSave={(key) => { setCustomApiKey(key); setIsSettingsOpen(false); }}
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
        />
      )}

      {isMagicModalOpen && (
        <MagicUploadModal 
          trip={activeTrip}
          customApiKey={customApiKey}
          onClose={() => setIsMagicModalOpen(false)}
          onExtracted={(extractedData) => {
            setIsMagicModalOpen(false);
            
            if (Array.isArray(extractedData)) {
               const newEvents = extractedData.map(e => ({
                   ...e, 
                   id: generateId(), 
                   attachments: e.attachments || [] 
               }));
               applyEventsToActiveVersion(activeTripId, (events) => {
                   let merged = [...events, ...newEvents].sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
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
          }}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function SettingsModal({ currentKey, darkMode, setDarkMode, onClose, onSave }) {
    const [keyInput, setKeyInput] = useState(currentKey);
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl my-auto overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-xl font-extrabold flex items-center gap-2"><Settings className="text-slate-500"/> Settings</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Custom Gemini API Key</label>
                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                            Leave blank to use the default environment key.
                        </p>
                        <input 
                            type="password" 
                            value={keyInput} 
                            onChange={e => setKeyInput(e.target.value)} 
                            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all font-mono" 
                            placeholder="AIzaSy..." 
                        />
                    </div>
                    
                    <div className="border-t border-slate-200 pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-sm font-bold text-slate-700">Gray Dark Mode</label>
                                <p className="text-xs text-slate-500 mt-0.5">Toggle a sleek neutral gray theme</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setDarkMode(!darkMode)} 
                                className={`w-12 h-6 rounded-full transition-colors relative flex items-center shadow-inner ${darkMode ? 'bg-purple-600' : 'bg-slate-300'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full absolute shadow-sm transition-transform ${darkMode ? 'translate-x-7' : 'translate-x-1'}`}></div>
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                        <button type="button" onClick={() => onSave(keyInput)} className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/30">Save Settings</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Dashboard({ trips, onOpenTrip, onNewTrip }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Your Projects</h2>
          <p className="text-slate-500 mt-1">Plan and organize your upcoming adventures.</p>
        </div>
        <button 
          onClick={onNewTrip}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow-md w-full sm:w-auto justify-center"
        >
          <Plus size={18} /> New Trip
        </button>
      </div>

      {(!trips || trips.length === 0) ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 px-4">
          <Globe className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No trips yet</h3>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">Start planning your next big adventure by creating a new project.</p>
          <button 
            onClick={onNewTrip}
            className="text-blue-600 font-bold hover:underline"
          >
            Create your first trip
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map(trip => (
            <div 
              key={trip.id} 
              onClick={() => onOpenTrip(trip.id)}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 dark:bg-purple-900/30 text-indigo-600 dark:text-purple-400 rounded-2xl group-hover:scale-110 transition-transform">
                  <Map size={24} />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold mb-2 group-hover:text-indigo-600 dark:group-hover:text-purple-400 transition-colors line-clamp-1">{String(trip.title || '')}</h3>
              <p className="text-slate-500 flex items-center gap-1.5 text-sm mb-6 font-medium">
                <MapPin size={16} /> <span className="truncate">{String(trip.destination || '')}</span>
              </p>
              
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-lg w-full">
                  <CalendarDays size={14} className="text-indigo-500 dark:text-purple-500 shrink-0"/>
                  <span className="truncate">
                    {trip.startDate ? new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    {' - '}
                    {trip.endDate ? new Date(trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TripView({ 
  trip, currency, onBack, onEditTrip, onAddEvent, onEditEvent, onDeleteEvent, 
  onMagicAdd, onUpdateDuration, onReorderList, onMoveEventToTime, isExporting,
  onChangeVersion, onCreateVersion, onAIEdit, isAIEditing, darkMode 
}) {
  const [viewMode, setViewMode] = useState('list'); 
  const displayMode = isExporting ? 'list' : viewMode; 
  const [aiPromptText, setAiPromptText] = useState('');

  const [draggedId, setDraggedId] = useState(null);
  const [insertIndex, setInsertIndex] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(60); 
  const [dragHover, setDragHover] = useState(null);
  const [inlineEditId, setInlineEditId] = useState(null);

  const activeVersion = trip?.versions?.find(v => v.id === trip.activeVersionId) || trip?.versions?.[0];
  const sortedEvents = Array.isArray(activeVersion?.events) ? [...activeVersion.events].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)) : [];

  // --- Map All Attachments for PDF Appendix ---
  let appendixCounter = 1;
  const allAppendixItems = [];
  sortedEvents.forEach(event => {
      if (Array.isArray(event.attachments) && event.attachments.length > 0) {
          event.attachments.forEach(att => {
              allAppendixItems.push({
                  ...att,
                  eventId: event.id,
                  eventTitle: event.title,
                  refId: appendixCounter++
              });
          });
      }
  });

  const groupedEvents = sortedEvents.reduce((acc, event) => {
    if (!event.startTime) return acc;
    const dateStr = new Date(event.startTime).toDateString();
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(event);
    return acc;
  }, {});

  const costByCategory = sortedEvents.reduce((acc, event) => {
    const cost = Number(event.cost) || 0;
    acc[event.type] = (acc[event.type] || 0) + cost;
    acc.total = (acc.total || 0) + cost;
    return acc;
  }, { total: 0 });

  const tripStart = new Date(trip?.startDate || new Date());
  tripStart.setHours(0,0,0,0);
  let earliestStart = tripStart.getTime();
  let latestEnd = new Date(trip?.endDate || new Date()).getTime();
  
  sortedEvents.forEach(e => {
     const s = new Date(e.startTime).getTime();
     if (s < earliestStart) earliestStart = s;
     const endT = e.endTime ? new Date(e.endTime).getTime() : s + 3600000;
     if (endT > latestEnd) latestEnd = endT;
  });
  
  const finalStart = new Date(earliestStart);
  finalStart.setHours(0,0,0,0);
  const finalEnd = new Date(latestEnd);
  finalEnd.setHours(0,0,0,0);
  
  const tripDays = Math.max(1, Math.round((finalEnd - finalStart) / (1000 * 60 * 60 * 24)) + 1);
  const totalMinutes = tripDays * 24 * 60;

  const handleAIRequest = () => {
     onAIEdit(aiPromptText);
     setAiPromptText(''); 
  };

  const renderTimelineEvent = (event, idx, arrayToCompare) => {
    const endMs = event.endTime ? new Date(event.endTime).getTime() : new Date(event.startTime).getTime() + 3600000;
    const offsetMs = new Date(endMs).getTimezoneOffset() * 60000;
    const gapStartTime = new Date(endMs - offsetMs).toISOString().slice(0, 16);

    let gapMs = 0;
    let freeTimeDurStr = '';
    let gapEndTime = null;

    if (idx < arrayToCompare.length - 1) {
        const nextEvent = arrayToCompare[idx + 1];
        gapMs = new Date(nextEvent.startTime).getTime() - endMs;
        if (gapMs > 60000) { 
            const hrs = Math.floor(gapMs / 3600000);
            const mins = Math.floor((gapMs % 3600000) / 60000);
            freeTimeDurStr = hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`;
            
            const gapOffsetMs = new Date(nextEvent.startTime).getTimezoneOffset() * 60000;
            gapEndTime = new Date(new Date(nextEvent.startTime).getTime() - gapOffsetMs).toISOString().slice(0, 16);
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
              draggedId={draggedId}
              setDraggedId={setDraggedId}
              onReorder={onReorderList}
              appendixItems={eventAppendixItems}
              darkMode={darkMode}
            />
            
            {gapMs > 60000 ? (
                <div className="relative mb-8 ml-8 sm:ml-12 -mt-4 print:hidden group/free pdf-avoid-break">
                    <div className="absolute left-[-1px] sm:left-[-1px] -translate-x-1/2 top-4 w-5 h-5 rounded-full border-2 border-slate-50 flex items-center justify-center bg-slate-200 text-slate-500 z-10 group-hover/free:bg-purple-600 group-hover/free:text-white transition-colors">
                        <Clock size={10} />
                    </div>
                    <div className="bg-slate-50/50 dark:bg-neutral-900/50 border-2 border-slate-200 dark:border-neutral-800 border-dashed rounded-2xl p-3 flex flex-col justify-center hover:bg-indigo-50/50 dark:hover:bg-purple-900/10 hover:border-indigo-300 dark:hover:border-purple-600 transition-colors cursor-pointer"
                         onClick={() => setInsertIndex(insertIndex === event.id ? null : event.id)}>
                        <div className="flex justify-between items-center w-full">
                            <span className="text-sm font-bold text-slate-500 group-hover/free:text-indigo-600 dark:group-hover:text-purple-400 flex items-center gap-2">
                                {freeTimeDurStr} Free Time
                            </span>
                            <span className="text-xs font-bold text-indigo-600 dark:text-purple-400 opacity-0 group-hover/free:opacity-100 flex items-center gap-1">
                                <Plus size={14}/> Fill time
                            </span>
                        </div>
                        
                        {insertIndex === event.id && (
                            <div className="mt-3 flex flex-col gap-3 animate-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => { setInsertIndex(null); onMagicAdd(gapStartTime); }} className="flex-1 text-xs font-bold flex items-center justify-center gap-1.5 bg-indigo-600 dark:bg-purple-600 text-white hover:bg-indigo-700 dark:hover:bg-purple-700 px-3 py-2 rounded-xl transition-colors shadow-sm">
                                       <Sparkles size={14}/> Magic
                                    </button>
                                    <button onClick={() => { setInsertIndex(null); onAddEvent({ startTime: gapStartTime }); }} className="flex-1 text-xs font-bold flex items-center justify-center gap-1.5 bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-700 px-3 py-2 rounded-xl transition-colors border border-slate-200 dark:border-neutral-700 shadow-sm">
                                       <Plus size={14}/> Manual
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-full mb-1">Quick Fill:</span>
                                    <button 
                                       onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Rest', type: 'lodging', startTime: gapStartTime }); }} 
                                       className="text-[11px] font-bold flex items-center gap-1 bg-purple-100/50 text-purple-700 hover:bg-purple-100 border border-purple-200 px-2.5 py-1.5 rounded-lg transition-colors shadow-sm"
                                    >
                                       <Bed size={12}/> Rest
                                    </button>
                                    <button 
                                       onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Travel', type: 'bus', startTime: gapStartTime }); }} 
                                       className="text-[11px] font-bold flex items-center gap-1 bg-emerald-100/50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors shadow-sm"
                                    >
                                       <Bus size={12}/> Travel
                                    </button>
                                    <button 
                                       onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Walk around', type: 'activity', startTime: gapStartTime }); }} 
                                       className="text-[11px] font-bold flex items-center gap-1 bg-pink-100/50 text-pink-700 hover:bg-pink-100 border border-pink-200 px-2.5 py-1.5 rounded-lg transition-colors shadow-sm"
                                    >
                                       <Map size={12}/> Walk
                                    </button>
                                    <button 
                                       onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Shopping', type: 'activity', startTime: gapStartTime }); }} 
                                       className="text-[11px] font-bold flex items-center gap-1 bg-blue-100/50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition-colors shadow-sm"
                                    >
                                       <MapPin size={12}/> Shop
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="relative h-8 -mt-4 mb-4 ml-4 sm:ml-8 print:hidden flex items-center pdf-avoid-break">
                   {insertIndex === event.id ? (
                       <div className="absolute left-[-1px] -translate-x-1/2 flex items-center z-20">
                         <div className="w-8 h-8 rounded-full bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 shadow-sm flex items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors shrink-0" onClick={() => setInsertIndex(null)}>
                           <X size={14} />
                         </div>
                         <div className="ml-6 sm:ml-8 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-lg rounded-xl p-2 flex flex-col gap-2 animate-in slide-in-from-left-2 w-[220px]">
                            <div className="flex gap-1">
                                <button onClick={() => { setInsertIndex(null); onMagicAdd(gapStartTime); }} className="flex-1 text-xs font-bold flex items-center justify-center gap-1.5 bg-indigo-600 dark:bg-purple-600 text-white hover:bg-indigo-700 dark:hover:bg-purple-700 px-2 py-1.5 rounded-lg transition-colors">
                                   <Sparkles size={14}/> Magic
                                </button>
                                <button onClick={() => { setInsertIndex(null); onAddEvent({ startTime: gapStartTime }); }} className="flex-1 text-xs font-bold flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-700 px-2 py-1.5 rounded-lg transition-colors">
                                   <Plus size={14}/> Manual
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 pt-1">
                                <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Rest', type: 'lodging', startTime: gapStartTime }); }} className="flex-1 text-[10px] font-bold flex justify-center items-center gap-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 px-2 py-1.5 rounded-md transition-colors"><Bed size={10}/> Rest</button>
                                <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Travel', type: 'bus', startTime: gapStartTime }); }} className="flex-1 text-[10px] font-bold flex justify-center items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 px-2 py-1.5 rounded-md transition-colors"><Bus size={10}/> Travel</button>
                                <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Walk', type: 'activity', startTime: gapStartTime }); }} className="flex-1 text-[10px] font-bold flex justify-center items-center gap-1 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 hover:bg-pink-100 px-2 py-1.5 rounded-md transition-colors"><Map size={10}/> Walk</button>
                                <button onClick={() => { setInsertIndex(null); onAddEvent({ title: 'Shop', type: 'activity', startTime: gapStartTime }); }} className="flex-1 text-[10px] font-bold flex justify-center items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 px-2 py-1.5 rounded-md transition-colors"><MapPin size={10}/> Shop</button>
                            </div>
                         </div>
                       </div>
                   ) : (
                       <button 
                         onClick={() => setInsertIndex(event.id)} 
                         className="absolute left-[-1px] -translate-x-1/2 w-6 h-6 rounded-full bg-slate-50 dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 text-slate-400 hover:text-purple-600 hover:border-purple-400 hover:bg-purple-50 flex items-center justify-center transition-all z-10"
                         title="Insert event after this"
                       >
                         <Plus size={12} strokeWidth={3} />
                       </button>
                   )}
                </div>
            )}
        </React.Fragment>
    );
  };

  return (
    <div className="animate-in fade-in duration-500">
      <button 
        onClick={onBack}
        className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-neutral-50 mb-6 transition-colors font-medium print:hidden"
      >
        <ChevronLeft size={16} /> Back to Projects
      </button>

      <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-6 sm:p-8 border border-slate-200 dark:border-neutral-800 shadow-sm mb-6 print:border-none print:shadow-none print:p-0 print:mb-6 relative group pdf-avoid-break transition-colors duration-300">
        <button 
          onClick={onEditTrip}
          className="absolute top-6 sm:top-8 right-6 sm:right-8 text-slate-400 hover:text-indigo-600 dark:hover:text-purple-400 bg-slate-50 dark:bg-neutral-800 hover:bg-slate-50 p-2 rounded-xl transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 print:hidden"
          title="Edit Project Details"
        >
          <Edit3 size={20} />
        </button>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-neutral-50 mb-4 pr-12 break-words leading-tight">{String(trip?.title || '')}</h1>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-slate-600">
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-purple-900/20 text-indigo-700 dark:text-purple-300 px-3 sm:px-4 py-2 rounded-xl text-sm sm:text-base w-full sm:w-auto">
            <MapPin size={18} className="shrink-0" />
            <span className="font-bold truncate">{String(trip?.destination || '')}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 px-3 sm:px-4 py-2 rounded-xl text-sm sm:text-base w-full sm:w-auto">
            <CalendarDays size={18} className="text-slate-500 dark:text-neutral-400 shrink-0" />
            <span className="font-medium truncate text-slate-600 dark:text-neutral-300">
              {trip?.startDate ? new Date(trip.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' }) : ''} 
              {' to '} 
              {trip?.endDate ? new Date(trip.endDate).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : ''}
            </span>
          </div>
        </div>
      </div>

      {/* AI Edit Command Bar */}
      <div className="bg-indigo-50 dark:bg-purple-900/10 border border-indigo-100 dark:border-purple-900/30 rounded-[1.5rem] p-2 sm:p-2.5 mb-8 flex flex-col sm:flex-row items-stretch sm:items-center shadow-sm print:hidden gap-2 transition-colors duration-300">
          <div className="flex items-center flex-1 min-w-0 bg-transparent px-3 py-1">
              <div className="text-indigo-500 dark:text-purple-400 mr-2 sm:mr-3 shrink-0">
                  <Sparkles size={22} />
              </div>
              <input
                  type="text"
                  value={aiPromptText}
                  onChange={e => setAiPromptText(e.target.value)}
                  placeholder="Ask AI to reorder, add dinner, or adjust the schedule..."
                  className="flex-1 bg-transparent border-none outline-none text-sm sm:text-base font-bold text-slate-700 dark:text-neutral-100 placeholder:text-indigo-300 dark:placeholder:text-purple-300/40 min-w-0 w-full"
                  onKeyDown={e => e.key === 'Enter' && handleAIRequest()}
              />
          </div>
          <button
              onClick={handleAIRequest}
              disabled={isAIEditing || !aiPromptText.trim()}
              className="bg-indigo-600 dark:bg-purple-600 hover:bg-indigo-700 dark:hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-indigo-600 dark:disabled:hover:bg-purple-600 text-white px-6 py-3 sm:py-2.5 rounded-xl text-sm font-extrabold transition-all shadow-lg shadow-indigo-600/20 dark:shadow-purple-600/20 shrink-0 flex items-center justify-center gap-2 w-full sm:w-auto"
          >
              {isAIEditing ? <><span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-4 h-4"></span> Generating...</> : 'Magic Edit'}
          </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          
          {/* Controls Bar */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8 print:hidden">
            
            <div className="bg-slate-200/50 dark:bg-neutral-800/50 p-1.5 rounded-2xl flex items-center flex-wrap gap-1 w-full xl:w-auto justify-center xl:justify-start shadow-inner transition-colors duration-300">
              <button 
                onClick={() => setViewMode('list')}
                className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-2.5 sm:py-2 rounded-xl text-sm font-bold transition-all ${displayMode === 'list' ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-100'}`}
              >
                <LayoutList size={16} /> <span className="hidden sm:inline">Live List</span>
              </button>
              <button 
                onClick={() => setViewMode('day')}
                className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-2.5 sm:py-2 rounded-xl text-sm font-bold transition-all ${displayMode === 'day' ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-100'}`}
              >
                <CalendarDays size={16} /> <span className="hidden sm:inline">Day View</span>
              </button>
              <div className="w-px h-6 bg-slate-300 dark:bg-neutral-700 mx-1 hidden sm:block"></div>
              <button 
                onClick={() => setViewMode(viewMode === 'edit' ? 'list' : 'edit')}
                className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-2.5 sm:py-2 rounded-xl text-sm font-bold transition-all ${displayMode === 'edit' ? 'bg-indigo-600 dark:bg-purple-600 text-white shadow-md' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-100'}`}
              >
                <Edit3 size={16} /> {displayMode === 'edit' ? 'Exit Edit' : <span className="hidden sm:inline">Edit Timeline</span>}
              </button>
            </div>

            <div className="flex gap-2 w-full xl:w-auto items-center justify-between xl:justify-end flex-wrap">
              {/* Version Controls */}
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-neutral-900 rounded-2xl p-1.5 border border-slate-200 dark:border-neutral-800 shadow-inner flex-1 sm:flex-none">
                 <select 
                   value={trip.activeVersionId} 
                   onChange={e => onChangeVersion(e.target.value)} 
                   className="bg-transparent px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-neutral-300 outline-none cursor-pointer border-none flex-1 min-w-[120px]"
                 >
                    {trip.versions?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                 </select>
                 <button onClick={() => onCreateVersion()} className="bg-white dark:bg-neutral-800 p-2 rounded-xl shadow-sm text-indigo-600 dark:text-purple-400 hover:bg-indigo-50 dark:hover:bg-purple-900/30 transition-colors shrink-0" title="Save as New Version">
                    <Save size={16}/>
                 </button>
              </div>

              <div className="flex gap-2 w-full sm:w-auto flex-1 sm:flex-none">
                  {displayMode === 'edit' ? (
                     <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-neutral-800/50 p-1 rounded-2xl w-full justify-center shadow-inner">
                        <button onClick={() => setZoomLevel(z => Math.max(30, z - 15))} className="p-2 hover:bg-white dark:hover:bg-neutral-700 rounded-xl text-slate-600 dark:text-neutral-400 transition-colors"><Minus size={14}/></button>
                        <span className="text-xs font-bold text-slate-500 dark:text-neutral-400 w-16 text-center select-none">Zoom {Math.round((zoomLevel/60)*100)}%</span>
                        <button onClick={() => setZoomLevel(z => Math.min(240, z + 15))} className="p-2 hover:bg-white dark:hover:bg-neutral-700 rounded-xl text-slate-600 dark:text-neutral-400 transition-colors"><Plus size={14}/></button>
                     </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => onMagicAdd(null)}
                        className="flex-1 sm:flex-none bg-indigo-600 dark:bg-purple-600 text-white px-5 py-3 sm:py-2.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 dark:shadow-purple-600/20 hover:scale-[1.02]"
                      >
                        <Sparkles size={16} /> Magic
                      </button>
                      <button 
                        onClick={() => onAddEvent(null)}
                        className="flex-1 sm:flex-none bg-slate-900 dark:bg-neutral-100 text-white dark:text-neutral-950 hover:bg-slate-800 dark:hover:bg-neutral-200 px-5 py-3 sm:py-2.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.02]"
                      >
                        <Plus size={16} /> Add Event
                      </button>
                    </>
                  )}
              </div>
            </div>
          </div>
          
          <h2 className="hidden print:block text-2xl font-bold mb-4 border-b pb-2">Itinerary</h2>

          {sortedEvents.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-12 text-center border border-dashed border-slate-300 dark:border-neutral-700 print:hidden transition-colors duration-300">
              <CalendarDays className="w-12 h-12 text-slate-300 dark:text-neutral-700 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-neutral-500 mb-4 font-medium text-lg">Your itinerary is empty.</p>
              <button onClick={() => onAddEvent(null)} className="text-indigo-600 dark:text-purple-400 font-bold hover:underline">Add your first event</button>
            </div>
          ) : displayMode === 'edit' ? (
             // --- CONTINUOUS CALENDAR EDIT VIEW ---
             <div className="bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden shadow-sm border border-slate-200 dark:border-neutral-800 print:break-inside-avoid animate-in fade-in slide-in-from-bottom-4 transition-colors duration-300">
                {/* Sticky Header */}
                <div className="bg-slate-50 dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 p-4 font-extrabold text-base sm:text-lg text-slate-800 dark:text-neutral-50 sticky top-0 z-40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarDays size={20} className="text-indigo-500 dark:text-purple-400 shrink-0"/>
                        Continuous Timeline ({tripDays} Days)
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-neutral-400 text-right">
                       {finalStart.toLocaleDateString()} - {finalEnd.toLocaleDateString()}
                    </div>
                </div>

                <div className="flex h-[60vh] min-h-[500px] relative">
                    {/* MINIMAP */}
                    <div 
                      className="w-12 sm:w-16 bg-slate-800 dark:bg-neutral-950 border-r border-slate-700 dark:border-neutral-800 relative cursor-pointer flex-shrink-0 select-none overflow-hidden hover:bg-slate-700 dark:hover:bg-neutral-900 transition-colors group z-30"
                      onClick={(e) => {
                         const rect = e.currentTarget.getBoundingClientRect();
                         const pct = (e.clientY - rect.top) / rect.height;
                         const scrollEl = document.getElementById(`continuous-scroll`);
                         if (scrollEl) {
                             scrollEl.scrollTo({ top: pct * scrollEl.scrollHeight - scrollEl.clientHeight / 2, behavior: 'smooth' });
                         }
                      }}
                    >
                        {Array.from({length: tripDays}).map((_, i) => (
                            <div key={`mday-${i}`} className="absolute w-full border-t border-red-500/50" style={{top: `${(i/tripDays)*100}%`, height: `${(1/tripDays)*100}%`}}>
                               <span className="text-[6px] text-red-300 font-bold ml-1 opacity-70">Day {i+1}</span>
                            </div>
                        ))}
                        
                        {sortedEvents.map(event => {
                            const s = new Date(event.startTime);
                            const sMidnight = new Date(s); sMidnight.setHours(0,0,0,0);
                            let dayOffset = Math.round((sMidnight - finalStart) / (1000 * 60 * 60 * 24));
                            if (dayOffset < 0) dayOffset = 0;

                            const startMins = dayOffset * 1440 + s.getHours() * 60 + s.getMinutes();
                            const eMs = event.endTime ? new Date(event.endTime).getTime() : s.getTime() + 3600000;
                            const durMins = (eMs - s.getTime()) / 60000;
                            
                            const topPct = (startMins / totalMinutes) * 100;
                            const heightPct = (durMins / totalMinutes) * 100;
                            const colorClass = EVENT_COLORS[event.type]?.split(' ')[0] || 'bg-gray-100';

                            return (
                                <div 
                                  key={`mini-${event.id}`} 
                                  className={`absolute left-1 right-1 rounded-[2px] ${colorClass} opacity-90 border border-black/20 shadow-sm`}
                                  style={{ top: `${topPct}%`, height: `${Math.max(heightPct, 0.2)}%` }}
                                />
                            );
                        })}
                    </div>

                    {/* MAIN TIMELINE SCROLL */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-neutral-950 relative" id={`continuous-scroll`}>
                        <div 
                          className="relative w-full" 
                          style={{ height: `${tripDays * zoomLevel * 24}px` }}
                          onDragOver={e => {
                              e.preventDefault();
                              if (!draggedId) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              const y = e.clientY - rect.top;
                              const dropMins = Math.max(0, Math.min(totalMinutes - 1, Math.round(y / (zoomLevel / 60))));
                              setDragHover({ y, mins: dropMins });
                          }}
                          onDragLeave={() => setDragHover(null)}
                          onDrop={e => {
                              e.preventDefault();
                              setDragHover(null);
                              if (!draggedId) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              const y = e.clientY - rect.top;
                              const dropMins = Math.max(0, Math.min(totalMinutes - 1, Math.round(y / (zoomLevel / 60))));
                              
                              const dropDayOffset = Math.floor(dropMins / 1440);
                              const dropMinsWithinDay = dropMins % 1440;
                              
                              const targetDate = new Date(finalStart);
                              targetDate.setDate(finalStart.getDate() + dropDayOffset);
                              
                              onMoveEventToTime(draggedId, targetDate, dropMinsWithinDay);
                              setDraggedId(null);
                          }}
                        >
                            {/* Grid lines */}
                            <div className="absolute inset-0 flex flex-col pointer-events-none">
                                {Array.from({length: tripDays * 24}).map((_, i) => {
                                    const hr = i % 24;
                                    const isMidnight = hr === 0;
                                    return (
                                    <div key={i} className={`w-full flex items-start box-border ${isMidnight ? '' : 'border-t border-slate-200 dark:border-neutral-800'}`} style={{height: `${zoomLevel}px`}}>
                                        <div className="w-12 sm:w-16 bg-white/80 dark:bg-neutral-900/80 backdrop-blur h-full border-r border-slate-200 dark:border-neutral-800 flex flex-col z-10 relative">
                                            {!isMidnight && (
                                                <span className="absolute -top-3 right-1 sm:right-2 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-neutral-500 bg-slate-50 dark:bg-neutral-900 px-1 rounded select-none">
                                                    {hr.toString().padStart(2, '0')}:00
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )})}
                            </div>

                            {/* RED LINE DAY SEPARATORS */}
                            {Array.from({length: tripDays}).map((_, i) => {
                                const currentDay = new Date(finalStart);
                                currentDay.setDate(finalStart.getDate() + i);
                                const y = i * 24 * zoomLevel;
                                return (
                                    <div key={`day-sep-${i}`} className="absolute w-full border-t-[3px] border-red-500 z-40 flex items-center pointer-events-none" style={{ top: `${y}px` }}>
                                        <div className="w-12 sm:w-16 h-0 border-r border-slate-200 dark:border-neutral-800 flex-shrink-0"></div>
                                        <div className="bg-red-500 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-b-lg shadow-sm ml-1 sm:ml-2">
                                           {currentDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Dynamic Drag Hover Time Indicator */}
                            {dragHover && draggedId && (
                                <div 
                                    className="absolute left-12 sm:left-16 right-0 flex items-center pointer-events-none z-[60]"
                                    style={{ top: `${dragHover.y}px`, transform: 'translateY(-50%)' }}
                                >
                                    <div className="bg-slate-900 dark:bg-neutral-100 text-white dark:text-neutral-950 text-[10px] sm:text-xs font-bold px-2 py-1 rounded shadow-lg -ml-12 sm:-ml-16 mr-1 sm:mr-2 relative z-10">
                                        {Math.floor((dragHover.mins % 1440) / 60).toString().padStart(2, '0')}:{(dragHover.mins % 60).toString().padStart(2, '0')}
                                    </div>
                                    <div className="flex-1 border-t-[3px] border-slate-900 dark:border-neutral-100 border-dashed shadow-sm"></div>
                                </div>
                            )}

                            {/* Events Overlay */}
                            <div className="absolute top-0 bottom-0 left-12 sm:left-16 right-2 sm:right-4">
                                {sortedEvents.map(event => {
                                    const s = new Date(event.startTime);
                                    const sMidnight = new Date(s); sMidnight.setHours(0,0,0,0);
                                    let dayOffset = Math.round((sMidnight - finalStart) / (1000 * 60 * 60 * 24));
                                    if (dayOffset < 0) dayOffset = 0;
                                    
                                    const startMins = dayOffset * 1440 + s.getHours() * 60 + s.getMinutes();
                                    const topOffset = startMins * (zoomLevel / 60);
                                    
                                    const eMs = event.endTime ? new Date(event.endTime).getTime() : s.getTime() + 3600000;
                                    const durMins = (eMs - s.getTime()) / 60000;
                                    
                                    const height = Math.max(durMins * (zoomLevel / 60), 46); 
                                    
                                    const colorClass = EVENT_COLORS[event.type] || EVENT_COLORS.other;

                                    return (
                                        <div
                                            key={event.id}
                                            draggable
                                            onDragStart={(e) => {
                                                setDraggedId(event.id);
                                                e.dataTransfer.effectAllowed = "move";
                                            }}
                                            onDragEnd={() => {
                                                setDraggedId(null);
                                                setDragHover(null);
                                            }}
                                            className={`absolute left-1 sm:left-2 right-0 rounded-xl p-2 border shadow-sm cursor-grab active:cursor-grabbing transition-all overflow-hidden group
                                                ${colorClass} 
                                                ${draggedId === event.id ? 'opacity-40 z-50 scale-95 shadow-lg border-dashed' : 'opacity-90 z-20 hover:z-30 hover:opacity-100 hover:shadow-md'}`
                                            }
                                            style={{ top: `${topOffset}px`, height: `${height}px` }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1 sm:gap-1.5 font-bold text-xs sm:text-sm leading-tight truncate pr-1 sm:pr-2">
                                                    <GripVertical size={14} className="opacity-50 flex-shrink-0" />
                                                    <span className="truncate">{String(event.title || '')}</span>
                                                </div>
                                                <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur rounded shadow-sm shrink-0">
                                                    <button onClick={(e) => { e.stopPropagation(); onUpdateDuration(event.id, -15 * 60000); }} className="p-1 hover:bg-white dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 transition-colors" title="-15m duration"><Minus size={12}/></button>
                                                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-800 dark:text-neutral-200 px-0.5 sm:px-1 select-none min-w-[28px] sm:min-w-[32px] text-center">
                                                        {Math.floor(durMins/60)>0 ? `${Math.floor(durMins/60)}h ` : ''}{Math.round(durMins%60)}m
                                                    </span>
                                                    <button onClick={(e) => { e.stopPropagation(); onUpdateDuration(event.id, 15 * 60000); }} className="p-1 hover:bg-white dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 transition-colors" title="+15m duration"><Plus size={12}/></button>
                                                    <div className="w-px h-3 bg-slate-400/50 mx-0.5 hidden sm:block"></div>
                                                    <button onClick={(e) => { e.stopPropagation(); onEditEvent(event); }} className="p-1 hover:bg-white dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 transition-colors hidden sm:block" title="Edit Event Details"><Edit3 size={12}/></button>
                                                </div>
                                            </div>
                                            
                                            <div className="mt-1 pl-4 sm:pl-5 relative z-10">
                                                {inlineEditId === event.id ? (
                                                    <input 
                                                        type="time" 
                                                        defaultValue={`${s.getHours().toString().padStart(2,'0')}:${s.getMinutes().toString().padStart(2,'0')}`}
                                                        autoFocus
                                                        onBlur={(e) => {
                                                            setInlineEditId(null);
                                                            const [h, m] = e.target.value.split(':');
                                                            const targetDate = new Date(finalStart);
                                                            targetDate.setDate(finalStart.getDate() + dayOffset);
                                                            onMoveEventToTime(event.id, targetDate, parseInt(h)*60 + parseInt(m));
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if(e.key === 'Enter') e.currentTarget.blur();
                                                        }}
                                                        className="text-[10px] sm:text-[11px] font-bold text-slate-900 bg-white rounded px-1 py-0.5 border-none outline-none ring-2 ring-indigo-500 w-auto shadow-sm"
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <div 
                                                        className="inline-flex text-[10px] sm:text-[11px] font-medium opacity-90 items-center gap-1 cursor-text hover:bg-white/60 dark:hover:bg-neutral-800/60 px-1 py-0.5 rounded transition-colors group/time"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setInlineEditId(event.id);
                                                        }}
                                                        title="Click to edit time manually"
                                                    >
                                                        <span className="bg-white/40 dark:bg-neutral-800/40 px-1 rounded group-hover/time:bg-white/80 dark:group-hover/time:bg-neutral-700 transition-colors">
                                                            {s.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                        {event.endTime && <span className="opacity-80 hidden sm:inline">- {new Date(event.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                                        <Edit3 size={10} className="opacity-0 group-hover/time:opacity-100 ml-1 text-slate-700 dark:text-neutral-400 hidden sm:block" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
             </div>
          ) : (
            <div className="print:ml-2">
              {displayMode === 'list' ? (
                // --- LIST VIEW ---
                <div className="relative border-l-2 border-slate-200 dark:border-neutral-800 ml-4 sm:ml-8 pt-2 pb-4 transition-colors duration-300">
                  {sortedEvents.map((event, idx) => {
                    const currentEventDateStr = new Date(event.startTime).toDateString();
                    const prevEventDateStr = idx > 0 ? new Date(sortedEvents[idx-1].startTime).toDateString() : null;
                    const isNewDay = currentEventDateStr !== prevEventDateStr;
                    
                    const sMidnight = new Date(event.startTime);
                    sMidnight.setHours(0,0,0,0);
                    let dayOffset = Math.round((sMidnight - finalStart) / (1000 * 60 * 60 * 24));
                    if (dayOffset < 0) dayOffset = 0;
                    const dayNumber = dayOffset + 1;

                    return (
                      <React.Fragment key={`list-wrap-${event.id}`}>
                        {isNewDay && (
                          <div className="relative flex items-center mb-8 mt-4 print:mt-6 print:mb-6 print:break-after-avoid pdf-avoid-break">
                              <div className="absolute left-[-1px] -translate-x-1/2 bg-slate-800 dark:bg-neutral-800 text-white text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full z-10 border-[3px] border-white dark:border-neutral-950 shadow-sm whitespace-nowrap">
                                  Day {dayNumber}
                              </div>
                              <div className="ml-8 sm:ml-12 text-sm sm:text-base font-extrabold text-slate-800 dark:text-neutral-50 flex items-center gap-2">
                                  <CalendarDays size={16} className="text-slate-400 print:hidden" />
                                  {new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                              </div>
                          </div>
                        )}
                        {renderTimelineEvent(event, idx, sortedEvents)}
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
                // --- DAY VIEW ---
                <div className="space-y-10">
                  {Object.keys(groupedEvents).map((dateStr, index) => {
                    const dayEvents = groupedEvents[dateStr];
                    const dateObj = new Date(dateStr);
                    return (
                      <div key={dateStr} className="print:break-inside-avoid pdf-avoid-break">
                        <div className="flex items-center gap-4 mb-6 sticky top-16 bg-slate-50/90 dark:bg-neutral-950/90 backdrop-blur py-2 z-10 print:static print:bg-transparent">
                          <div className="bg-indigo-600 dark:bg-purple-600 text-white text-xs sm:text-sm font-bold px-3 py-1 rounded-lg">
                            Day {index + 1}
                          </div>
                          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-neutral-50">
                            {dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </h3>
                          <div className="h-px bg-slate-200 dark:bg-neutral-800 flex-1 hidden sm:block"></div>
                        </div>
                        <div className="relative border-l-2 border-slate-200 dark:border-neutral-800 ml-4 sm:ml-8 pt-2 pb-4 transition-colors duration-300">
                           {dayEvents.map((event, idx) => renderTimelineEvent(event, idx, dayEvents))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cost Summary Sidebar */}
        <div className="lg:col-span-1 print:break-before-page pdf-page-break mt-6 lg:mt-0 w-full">
          <div className="bg-slate-900 dark:bg-neutral-900 rounded-[2rem] p-6 sm:p-8 text-white lg:sticky lg:top-24 shadow-xl print:bg-white print:text-slate-900 print:border print:border-slate-200 print:shadow-none border border-transparent dark:border-neutral-800 transition-colors duration-300">
            <h2 className="text-xl font-bold mb-6 sm:mb-8 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl print:bg-emerald-100">
                <DollarSign className="text-emerald-400 print:text-emerald-600" size={20} /> 
              </div>
              Cost Estimation
            </h2>
            
            <div className="space-y-4 sm:space-y-5 mb-6 sm:mb-8">
              {['flight', 'lodging', 'activity', 'food', 'bus', 'train', 'other'].map(type => {
                if (!costByCategory[type]) return null;
                return (
                  <div key={type} className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-3 text-slate-300 dark:text-neutral-400 print:text-slate-600 capitalize font-medium">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 dark:bg-neutral-800 print:bg-slate-100 flex items-center justify-center text-slate-400 print:text-slate-500 shrink-0">
                        {EVENT_ICONS[type] || <FileText size={16}/>}
                      </div>
                      <span className="truncate">{String(type)}</span>
                    </span>
                    <span className="font-bold tracking-wide">{formatCurrency(costByCategory[type], currency)}</span>
                  </div>
                );
              })}
              
              {Object.keys(costByCategory).length === 1 && (
                <p className="text-slate-400 dark:text-neutral-600 text-sm text-center py-4 print:hidden">No costs added yet.</p>
              )}
            </div>

            <div className="border-t border-slate-700 dark:border-neutral-800 print:border-slate-200 pt-6">
              <div className="text-slate-400 dark:text-neutral-500 text-sm font-bold uppercase tracking-wider mb-1">Total Estimated</div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 dark:text-emerald-500 print:text-slate-900 tracking-tight break-all leading-tight">
                {formatCurrency(costByCategory.total, currency)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Appendix Section */}
      {allAppendixItems.length > 0 && (
          <div className="hidden print:block mt-12 w-full">
              {allAppendixItems.map((item, index) => (
                  <div key={`appendix-${index}`} className="pdf-page-break pt-8 w-full">
                      <div className="border-b-2 border-slate-800 pb-4 mb-6">
                          <h2 className="text-3xl font-black text-slate-900">Appendix {item.refId}</h2>
                          <p className="text-lg text-slate-600 font-bold mt-1">{item.eventTitle}</p>
                      </div>
                      <p className="text-slate-500 font-medium mb-6 flex items-center gap-2">
                          <Paperclip size={16}/> {item.name}
                      </p>
                      {item.type?.startsWith('image/') ? (
                          <div className="w-full flex justify-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                              <img src={item.url} alt={item.name} className="max-w-full max-h-[850px] object-contain rounded-lg shadow-sm" />
                          </div>
                      ) : (
                          <div className="p-12 border-2 border-dashed border-slate-300 rounded-2xl text-center bg-slate-50">
                              <FileText className="w-20 h-20 text-slate-400 mx-auto mb-4" />
                              <p className="text-lg text-slate-700 font-bold">{item.name}</p>
                              <p className="text-sm text-slate-500 mt-2">Document attachments cannot be visually previewed in the PDF export.</p>
                          </div>
                      )}
                  </div>
              ))}
          </div>
      )}
    </div>
  );
}

// Reusable Event Card Component for the Timeline
function EventCard({ event, onEditEvent, onDeleteEvent, currency, onUpdateDuration, draggedId, setDraggedId, onReorder, appendixItems, darkMode }) {
  const colorClass = EVENT_COLORS[event.type] || EVENT_COLORS.other;
  
  const startMs = new Date(event.startTime).getTime();
  const endMs = event.endTime ? new Date(event.endTime).getTime() : startMs;
  const durationMins = Math.max(0, Math.round((endMs - startMs) / 60000));
  const hrs = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  const durationStr = hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`;

  return (
    <div 
      className={`mb-8 relative group print:break-inside-avoid pdf-avoid-break transition-all ${draggedId === event.id ? 'opacity-40' : 'opacity-100'}`}
      draggable
      onDragStart={(e) => {
         setDraggedId(event.id);
         e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
         e.preventDefault();
         e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
         e.preventDefault();
         if (draggedId && draggedId !== event.id) {
             onReorder(draggedId, event.id);
         }
         setDraggedId(null);
      }}
      onDragEnd={() => setDraggedId(null)}
    >
      {/* Timeline Dot - Mathematically centered on the line */}
      <div className={`absolute left-[-1px] -translate-x-1/2 top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-[3px] sm:border-4 ${darkMode ? 'border-neutral-950 bg-neutral-950' : 'border-white bg-white'} z-10 flex items-center justify-center ${colorClass}`}>
        {React.cloneElement(EVENT_ICONS[event.type] || <FileText />, { className: "w-3 h-3 sm:w-4 sm:h-4" })}
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 sm:p-6 ml-8 sm:ml-12 border border-slate-200 dark:border-neutral-800 shadow-sm hover:shadow-xl hover:border-indigo-200 dark:hover:border-purple-800 transition-all group-relative">
        
        {/* Drag Handle */}
        <div className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 text-slate-300 dark:text-neutral-700 hover:text-indigo-500 dark:hover:text-purple-400 cursor-grab active:cursor-grabbing opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 print:hidden">
          <GripVertical size={16} className="sm:w-[18px] sm:h-[18px]" />
        </div>

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
              {event.endTime && <span className="hidden sm:inline"> - {new Date(event.endTime).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</span>}
            </div>

            {/* Duration Changer */}
            {event.endTime && (
              <div className="flex items-center bg-slate-100 dark:bg-neutral-800 rounded-md border border-slate-200 dark:border-neutral-700 overflow-hidden print:hidden shrink-0">
                <button onClick={() => onUpdateDuration(event.id, -15 * 60000)} className="px-1.5 sm:px-2 py-1 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 transition-colors">
                  <Minus size={12} className="sm:w-[14px] sm:h-[14px]" />
                </button>
                <span className="px-1 sm:px-2 py-1 text-[10px] sm:text-xs font-bold text-slate-700 dark:text-neutral-200 bg-white dark:bg-neutral-700 border-x border-slate-200 dark:border-neutral-600 select-none">
                  {durationStr}
                </span>
                <button onClick={() => onUpdateDuration(event.id, 15 * 60000)} className="px-1.5 sm:px-2 py-1 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 transition-colors">
                  <Plus size={12} className="sm:w-[14px] sm:h-[14px]" />
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
                href={att.url} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] sm:text-sm font-bold text-slate-700 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-colors max-w-[120px] sm:max-w-xs"
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

// --- Modals ---

function TripModal({ initialData, onClose, onSave }) {
  const [data, setData] = useState(() => {
    const defaultState = { title: '', destination: '', startDate: '', endDate: '' };
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
              <input required type="text" value={data.title || ''} onChange={e => setData({...data, title: e.target.value})} className="w-full outline-none text-base sm:text-lg font-bold text-slate-900 dark:text-neutral-50 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent" placeholder="e.g. Summer Eurotrip" />
            </div>
            
            <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Destination</label>
              <input required type="text" value={data.destination || ''} onChange={e => setData({...data, destination: e.target.value})} className="w-full outline-none text-base sm:text-lg font-bold text-slate-900 dark:text-neutral-50 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent" placeholder="e.g. Paris, France" />
            </div>
          </div>

          <div className="border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-2 sm:p-4 bg-white dark:bg-neutral-950 overflow-hidden transition-colors">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 sm:mb-4 flex items-center gap-1 px-2"><Calendar size={12}/> Select Dates</label>
            <DateRangePicker 
              startDate={data.startDate || ''} 
              endDate={data.endDate || ''} 
              onChange={(dates) => setData({...data, ...dates})} 
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

function EventModal({ event, trip, currency, onClose, onSave }) {
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

  const handleSubmit = (e) => {
    e.preventDefault();
    let finalData = { ...data, cost: parseFloat(data.cost) || 0 };
    
    if (timeMode === 'duration' && data.startTime) {
      const start = new Date(data.startTime);
      const endMs = start.getTime() + (duration.hours * 60 * 60 * 1000) + (duration.minutes * 60 * 1000);
      const end = new Date(endMs);
      finalData.endTime = new Date(end.getTime() - (end.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
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
    setData({...data, attachments: newAtt});
  };

  const minDateTime = trip?.startDate ? `${trip.startDate}T00:00` : '';
  const maxDateTime = trip?.endDate ? `${trip.endDate}T23:59` : '';
  
  const safeAttachments = Array.isArray(data?.attachments) ? data.attachments : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 rounded-[2rem] w-full max-w-2xl shadow-2xl my-auto overflow-hidden">
        <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-slate-100 dark:border-neutral-800 flex justify-between items-center bg-white/90 dark:bg-neutral-950/90 backdrop-blur z-10 transition-colors">
          <h3 className="text-xl sm:text-2xl font-extrabold dark:text-white">{event ? 'Edit Event' : 'Add Event'}</h3>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 sm:space-y-6">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="sm:col-span-2 relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Event Title</label>
              <input required type="text" value={data.title || ''} onChange={e => setData({...data, title: e.target.value})} className="w-full outline-none text-base sm:text-lg font-bold text-slate-900 dark:text-neutral-50 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent" placeholder="e.g. Flight to JFK" />
            </div>
            <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Category</label>
              <select value={data.type || 'activity'} onChange={e => setData({...data, type: e.target.value})} className="w-full outline-none text-sm sm:text-base font-bold text-slate-900 dark:text-neutral-50 bg-transparent cursor-pointer">
                <option value="flight">✈️ Flight</option>
                <option value="lodging">🛏️ Lodging</option>
                <option value="activity">🗺️ Activity</option>
                <option value="food">☕ Food</option>
                <option value="bus">🚌 Bus</option>
                <option value="train">🚂 Train</option>
                <option value="other">📄 Other</option>
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

            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="relative bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1"><Clock size={12}/> Start Time</label>
                <input 
                  required 
                  type="datetime-local" 
                  min={minDateTime}
                  max={maxDateTime}
                  value={data.startTime || ''} 
                  onChange={e => setData({...data, startTime: e.target.value})} 
                  className="w-full outline-none text-xs sm:text-sm font-bold text-slate-900 dark:text-neutral-50 bg-transparent" 
                />
              </div>

              {timeMode === 'duration' ? (
                <div className="relative bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">⏱️ Duration</label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 flex-1 border-r border-slate-100 dark:border-neutral-800 pr-2">
                      <input type="number" min="0" value={duration.hours} onChange={e => setDuration({...duration, hours: parseInt(e.target.value) || 0})} className="w-full outline-none text-sm font-bold text-slate-900 dark:text-neutral-50 bg-transparent text-right" placeholder="0" />
                      <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-neutral-500">hr</span>
                    </div>
                    <div className="flex items-center gap-1 flex-1 pl-1">
                      <input type="number" min="0" max="59" value={duration.minutes} onChange={e => setDuration({...duration, minutes: parseInt(e.target.value) || 0})} className="w-full outline-none text-sm font-bold text-slate-900 dark:text-neutral-50 bg-transparent text-right" placeholder="0" />
                      <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-neutral-500">min</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-xl p-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1"><Clock size={12}/> End Time (Optional)</label>
                  <input 
                    type="datetime-local" 
                    min={data.startTime || minDateTime}
                    max={maxDateTime}
                    value={data.endTime || ''} 
                    onChange={e => setData({...data, endTime: e.target.value})} 
                    className="w-full outline-none text-xs sm:text-sm font-bold text-slate-900 dark:text-neutral-50 bg-transparent" 
                  />
                </div>
              )}
            </div>
          </div>

          <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/20 transition-all bg-white dark:bg-neutral-950 max-w-xs">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Estimated Cost ({currency})</label>
            <div className="flex items-center text-base sm:text-lg font-bold text-slate-900 dark:text-neutral-50">
               <span className="text-slate-400 dark:text-neutral-600 mr-2">{String(CURRENCIES.find(c=>c.code===currency)?.symbol || '$')}</span>
               <input type="number" min="0" step="0.01" value={data.cost} onChange={e => setData({...data, cost: e.target.value})} className="w-full outline-none bg-transparent" placeholder="0.00" />
            </div>
          </div>

          <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-white dark:bg-neutral-950">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Notes & Booking Refs</label>
            <textarea value={data.notes || ''} onChange={e => setData({...data, notes: e.target.value})} className="w-full outline-none text-sm sm:text-base font-medium text-slate-900 dark:text-neutral-200 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent min-h-[60px] sm:min-h-[80px] resize-y" placeholder="Confirmation numbers, terminal, meeting points..." />
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
                      {att?.type?.startsWith('image/') ? <ImageIcon size={14} className="text-indigo-500 dark:text-purple-400 shrink-0"/> : <FileText size={14} className="text-indigo-500 dark:text-purple-400 shrink-0"/>}
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

function MagicUploadModal({ trip, customApiKey, onClose, onExtracted }) {
  const [magicMode, setMagicMode] = useState('text'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [plainText, setPlainText] = useState('');
  const [magicLink, setMagicLink] = useState('');
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const activeKey = customApiKey || apiKey;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (screenshot of ticket/receipt).');
      return;
    }

    setSelectedFile(file);
    setError('');
    
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const fetchWithRetry = async (payload, retries = 5, delay = 1000) => {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${activeKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(payload, retries - 1, delay * 2);
      }
      throw err;
    }
  };

  const processPlainText = async () => {
    if (!plainText.trim()) return;
    setLoading(true);
    setError('');

    try {
      const prompt = `You are an AI travel planner. Extract ALL itinerary events from the following text into a JSON array.
      The trip starts on ${trip?.startDate || 'Unknown'} and ends on ${trip?.endDate || 'Unknown'}.
      "Day 1" refers to ${trip?.startDate}. "Day 2" is the day after, etc. Use this to calculate exact dates.
      
      Text: "${plainText}"
      
      Rules:
      1. Extract distinct activities, transits, meals, or lodgings as separate objects in an array.
      2. Categorize 'type' strictly as one of: 'flight', 'lodging', 'activity', 'food', 'bus', 'train', 'other'.
      3. Determine 'startTime' and 'endTime' (Format: "YYYY-MM-DDTHH:mm"). If duration is provided (e.g. "stay for 3 hours"), calculate the 'endTime' based on the 'startTime'. If no time is specified, default to 09:00.
      4. IF THE USER GIVES A GENERIC DESCRIPTION (e.g. "france famous museum"), YOU MUST INFER THE ACTUAL REAL-WORLD LOCATION (e.g., "The Louvre") and use it as the 'title'.
      5. If Google Maps URLs are present in the text, map them to the corresponding event in 'locationLink'.
      6. Return ONLY a valid JSON array of objects. No markdown formatting.
      
      Example format:
      [
        {"title": "The Louvre", "type": "activity", "cost": 0, "startTime": "2026-06-15T09:00", "endTime": "2026-06-15T12:00", "notes": "", "locationLink": ""},
        {"title": "Bus to Mall", "type": "bus", "cost": 0, "startTime": "2026-06-15T12:00", "endTime": "2026-06-15T18:00", "notes": "", "locationLink": ""}
      ]`;

      const result = await fetchWithRetry({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });
      
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) throw new Error("No response from AI");

      let extractedData = JSON.parse(textResponse.replace(/```json\n?|\n?```/g, ''));
      if (!Array.isArray(extractedData)) {
          extractedData = [extractedData]; 
      }
      onExtracted(extractedData);

    } catch (err) {
      console.error("Text extraction failed", err);
      setError('Failed to extract events from text. Ensure formatting is clear or check API key.');
    } finally {
      setLoading(false);
    }
  };

  const processMapLink = async (url) => {
    if (!url) return;
    setLoading(true);
    setError('');

    let extractedData = { title: '', type: 'activity', locationLink: url, cost: 0, startTime: '', endTime: '', notes: '', attachments: [] };

    try {
      let regexSuccess = false;
      
      try {
        const parsedUrl = new URL(url);
        let placeName = '';
        
        if (parsedUrl.pathname.includes('/place/')) {
          const parts = parsedUrl.pathname.split('/');
          const placeIndex = parts.indexOf('place');
          if (placeIndex !== -1 && parts[placeIndex + 1]) {
            placeName = decodeURIComponent(parts[placeIndex + 1].split('@')[0].replace(/\+/g, ' '));
          }
        } 
        else if (parsedUrl.searchParams.has('q')) {
          placeName = decodeURIComponent(parsedUrl.searchParams.get('q').replace(/\+/g, ' '));
        } else if (parsedUrl.searchParams.has('query')) {
          placeName = decodeURIComponent(parsedUrl.searchParams.get('query').replace(/\+/g, ' '));
        }

        if (placeName) {
          placeName = placeName.replace(/\/$/, '').trim();
          extractedData.title = placeName;
          
          const lowerName = placeName.toLowerCase();
          if (lowerName.match(/restaurant|cafe|bistro|diner|pizza|burger|coffee|bakery|steak|sushi|kitchen|grill/)) {
            extractedData.type = 'food';
          } else if (lowerName.match(/hotel|resort|hostel|motel|inn|lodge|suites/)) {
            extractedData.type = 'lodging';
          } else if (lowerName.match(/airport|flight|airways|airlines/)) {
            extractedData.type = 'flight';
          } else if (lowerName.match(/station|train|railway|subway/)) {
            extractedData.type = 'train';
          } else if (lowerName.match(/bus|transit|coach/)) {
            extractedData.type = 'bus';
          } else {
            extractedData.type = 'activity';
          }
          regexSuccess = true;
        }
      } catch (e) { /* Ignore invalid URL parse errors */ }

      if (!regexSuccess) {
        const prompt = `I am building a trip planner. The user pasted this map link: ${url}. 
        Extract the likely name of the place to use as a title. Also strictly categorize it into exactly one of these types: 'flight', 'lodging', 'activity', 'food', 'bus', 'train', 'other'. Infer the type accurately based on the place name.
        Return ONLY a valid JSON object in this format EXACTLY: {"title": "Place Name", "type": "activity"}`;

        try {
          const result = await fetchWithRetry({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          });
          
          const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResponse) {
            const extracted = JSON.parse(textResponse);
            if (extracted.title) extractedData.title = extracted.title;
            if (extracted.type) extractedData.type = extracted.type;
            regexSuccess = true;
          }
        } catch (e) { console.error("Gemini fallback failed", e); }
      }

      if (!regexSuccess && !extractedData.title) {
         extractedData.title = 'Saved Map Location';
         extractedData.notes = 'Extracted from shortlink.';
      }

      setTimeout(() => {
        onExtracted(extractedData);
        setLoading(false);
      }, 500);

    } catch (err) {
      console.error("Link extraction failed", err);
      setError('Failed to extract details from link.');
      setLoading(false);
    }
  };

  const processWithAI = async () => {
    if (!selectedFile || !previewUrl) return;
    setLoading(true);
    setError('');

    try {
      const base64Data = previewUrl.split(',')[1];
      
      const prompt = `Analyze this image (it is likely a travel ticket, booking confirmation, receipt, or itinerary screenshot). 
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

      const result = await fetchWithRetry({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: selectedFile.type, data: base64Data } }
          ]
        }],
        generationConfig: { responseMimeType: "application/json" }
      });

      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) throw new Error("No response from AI");

      let extractedData;
      try {
        extractedData = JSON.parse(textResponse);
      } catch (e) {
        const cleanText = textResponse.replace(/```json\n?|\n?```/g, '');
        extractedData = JSON.parse(cleanText);
      }
      
      extractedData.attachments = [{
        name: selectedFile.name,
        type: selectedFile.type,
        url: previewUrl
      }];

      onExtracted(extractedData);
      
    } catch (err) {
      console.error(err);
      setError('Failed to extract information. Make sure the API key is valid or try entering manually.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-start justify-center p-4 sm:p-6 animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 rounded-[2rem] w-full max-w-lg shadow-2xl my-auto overflow-hidden animate-in zoom-in-95 duration-200 transition-colors">
        <div className="bg-indigo-600 dark:bg-purple-600 px-6 sm:px-8 py-6 sm:py-8 pb-4 sm:pb-6 text-white text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-indigo-200 dark:text-purple-200 hover:text-white bg-indigo-700/50 dark:bg-purple-700/50 hover:bg-indigo-700 dark:hover:bg-purple-700 p-2 rounded-full transition-colors"><X size={20}/></button>
          <div className="bg-white/20 w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 backdrop-blur">
             <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold">Magic Add</h3>
          
          <div className="flex bg-indigo-800/50 dark:bg-purple-900/50 p-1 rounded-xl mt-4 sm:mt-6 shadow-inner">
             <button onClick={()=>setMagicMode('text')} className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${magicMode === 'text' ? 'bg-white dark:bg-neutral-800 text-indigo-700 dark:text-purple-400 shadow-sm' : 'text-indigo-100 dark:text-purple-100 hover:text-white hover:bg-indigo-700 dark:hover:bg-purple-700'}`}>Text Prompt</button>
             <button onClick={()=>setMagicMode('link')} className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${magicMode === 'link' ? 'bg-white dark:bg-neutral-800 text-indigo-700 dark:text-purple-400 shadow-sm' : 'text-indigo-100 dark:text-purple-100 hover:text-white hover:bg-indigo-700 dark:hover:bg-purple-700'}`}>Map Link</button>
             <button onClick={()=>setMagicMode('image')} className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${magicMode === 'image' ? 'bg-white dark:bg-neutral-800 text-indigo-700 dark:text-purple-400 shadow-sm' : 'text-indigo-100 dark:text-purple-100 hover:text-white hover:bg-indigo-700 dark:hover:bg-purple-700'}`}>Receipt</button>
          </div>
        </div>
        
        <div className="p-6 sm:p-8 bg-slate-50 dark:bg-neutral-900 transition-colors">
          {error && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 p-3 sm:p-4 rounded-xl text-xs sm:text-sm font-medium border border-red-100 dark:border-red-900/30 mb-4 sm:mb-6">
              <AlertCircle size={16} className="shrink-0 sm:w-[18px] sm:h-[18px]" />
              <p>{error}</p>
            </div>
          )}

          {magicMode === 'text' && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                 <p className="text-slate-600 dark:text-neutral-400 text-xs sm:text-sm font-medium mb-2 leading-relaxed">
                     Describe your plans naturally.
                 </p>
                 <textarea 
                    value={plainText}
                    onChange={e => setPlainText(e.target.value)}
                    placeholder="e.g. I'll go to the Eiffel Tower at 9am, stay for 3 hours..."
                    className="w-full h-32 sm:h-40 outline-none text-xs sm:text-sm font-medium text-slate-900 dark:text-neutral-50 placeholder:text-slate-400 dark:placeholder:text-neutral-700 bg-white dark:bg-neutral-950 border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-3 sm:p-4 focus:border-indigo-500 dark:focus:border-purple-600 focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-purple-600/10 transition-all resize-none shadow-sm"
                 />
                 <button 
                    onClick={processPlainText}
                    disabled={loading || !plainText}
                    className="w-full bg-indigo-600 dark:bg-purple-600 hover:bg-indigo-700 dark:hover:bg-purple-700 text-white py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 dark:shadow-purple-600/30 disabled:opacity-70 disabled:shadow-none"
                 >
                    {loading ? (
                      <><span className="animate-spin border-4 border-white/30 border-t-white rounded-full w-5 h-5 sm:w-6 sm:h-6"></span> Parsing...</>
                    ) : (
                      <><Sparkles size={18} className="sm:w-[20px] sm:h-[20px]" /> Extract Events</>
                    )}
                 </button>
             </div>
          )}

          {magicMode === 'link' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
              <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-2 sm:p-3 focus-within:border-indigo-500 dark:focus-within:border-purple-600 focus-within:ring-4 focus-within:ring-indigo-500/20 dark:focus-within:ring-purple-600/10 transition-all bg-white dark:bg-neutral-950 group shadow-sm">
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1 px-1"><MapPin size={12}/> Map Link</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="url" 
                    value={magicLink} 
                    onChange={e => setMagicLink(e.target.value)} 
                    className="w-full outline-none text-sm sm:text-base font-medium text-slate-900 dark:text-neutral-50 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent px-1" 
                    placeholder="Paste single link here..." 
                  />
                  <button 
                    onClick={() => processMapLink(magicLink)}
                    disabled={loading || !magicLink}
                    className="bg-indigo-100 dark:bg-purple-900/30 text-indigo-700 dark:text-purple-300 p-2 rounded-xl hover:bg-indigo-200 dark:hover:bg-purple-900/50 disabled:opacity-50 transition-colors flex shrink-0 items-center justify-center"
                  >
                    {loading ? <span className="animate-spin border-2 border-indigo-700/30 dark:border-purple-400/30 border-t-indigo-700 dark:border-t-purple-400 rounded-full w-5 h-5"></span> : <ChevronRight size={18} className="sm:w-[20px] sm:h-[20px]" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {magicMode === 'image' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
              {!previewUrl ? (
                  <div className="border-2 border-dashed border-slate-300 dark:border-neutral-800 rounded-3xl p-8 sm:p-10 text-center hover:bg-white dark:hover:bg-neutral-950 hover:border-indigo-400 dark:hover:border-purple-600 hover:shadow-md transition-all cursor-pointer group" onClick={() => document.getElementById('magic-upload').click()}>
                    <div className="bg-slate-200 dark:bg-neutral-800 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:bg-indigo-100 dark:group-hover:bg-purple-900/50 transition-colors">
                      <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500 dark:text-neutral-500 group-hover:text-indigo-600 dark:group-hover:text-purple-400 transition-colors" />
                    </div>
                    <p className="text-sm sm:text-base text-slate-700 dark:text-neutral-300 font-bold mb-1">Click to upload image</p>
                    <p className="text-slate-400 dark:text-neutral-600 text-[10px] sm:text-xs font-medium">JPG, PNG</p>
                    <input type="file" id="magic-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </div>
              ) : (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-neutral-800 bg-slate-200 dark:bg-neutral-950 h-40 sm:h-56 flex items-center justify-center group shadow-inner">
                      <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        onClick={() => { setPreviewUrl(''); setSelectedFile(null); }}
                        className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-slate-900/70 text-white p-1.5 sm:p-2 rounded-full hover:bg-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 backdrop-blur"
                      >
                        <X size={14} className="sm:w-[16px] sm:h-[16px]" />
                      </button>
                    </div>
                    <button 
                      onClick={processWithAI}
                      disabled={loading}
                      className="w-full bg-indigo-600 dark:bg-purple-600 hover:bg-indigo-700 dark:hover:bg-purple-700 text-white py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 dark:shadow-purple-600/30 disabled:opacity-70 disabled:shadow-none"
                    >
                      {loading ? (
                        <><span className="animate-spin border-4 border-white/30 border-t-white rounded-full w-5 h-5 sm:w-6 sm:h-6"></span> Analyzing...</>
                      ) : (
                        <><Sparkles size={18} className="sm:w-[20px] sm:h-[20px]" /> Extract Details</>
                      )}
                    </button>
                  </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Custom Components ---

function DateRangePicker({ startDate, endDate, onChange }) {
  const [currentMonth, setCurrentMonth] = useState(startDate ? new Date(startDate) : new Date());
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

  const handleDayClick = (dayStr) => {
    if (!dayStr) return;
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
    <div className="w-full select-none transition-colors">
      <div className="flex justify-between items-center mb-4 px-1 sm:px-2">
        <button type="button" onClick={prevMonth} className="p-1.5 sm:p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors"><ChevronLeft size={18} className="sm:w-[20px] sm:h-[20px]" /></button>
        <div className="font-bold text-sm sm:text-lg dark:text-neutral-50">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</div>
        <button type="button" onClick={nextMonth} className="p-1.5 sm:p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors"><ChevronRight size={18} className="sm:w-[20px] sm:h-[20px]" /></button>
      </div>
      
      <div className="grid grid-cols-7 gap-y-1 sm:gap-y-2 text-center text-xs sm:text-sm">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="font-bold text-slate-400 dark:text-neutral-600 text-[10px] sm:text-xs mb-1 sm:mb-2">{d}</div>
        ))}
        
        {generateDays().map((day, idx) => {
          const dayStr = getFormatDate(day);
          const selected = isSelected(dayStr);
          const inRange = isBetween(dayStr);
          const isStart = dayStr === startDate;
          const isEnd = dayStr === endDate;

          return (
            <div 
              key={idx} 
              className={`relative flex justify-center items-center h-8 sm:h-10 ${inRange ? 'bg-indigo-50 dark:bg-purple-900/20' : ''} ${isStart && endDate ? 'rounded-l-full bg-indigo-50 dark:bg-purple-900/20' : ''} ${isEnd ? 'rounded-r-full bg-indigo-50 dark:bg-purple-900/20' : ''}`}
            >
              {day ? (
                <div 
                  onClick={() => handleDayClick(dayStr)}
                  onMouseEnter={() => dayStr && setHoverDate(dayStr)}
                  onMouseLeave={() => setHoverDate(null)}
                  className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full cursor-pointer text-xs sm:text-sm font-semibold transition-colors
                    ${selected ? 'bg-indigo-600 dark:bg-purple-600 text-white shadow-md' : 'hover:border-2 hover:border-slate-900 dark:hover:border-white text-slate-800 dark:text-neutral-300'}
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