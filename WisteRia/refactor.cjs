const fs = require('fs');

const code = fs.readFileSync('src/App.jsx', 'utf8');

// I will extract just the interior of `export default function App() { ... }` up to `handleExportPDF`
const appMatch = code.match(/export default function App\(\) \{([\s\S]*?)const handleExportPDF/);

if (appMatch) {
    const innerApp = appMatch[1];

    const newImports = `import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { writeTextFile, readTextFile, exists, mkdir, readDir, BaseDirectory, writeFile } from '@tauri-apps/plugin-fs';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';
import { getTripSummary, loadFullTrip, upsertTrip, upsertEvent, upsertVersion, deleteEventFromDB, deleteVersionFromDB, upsertAttachment } from './db';
import { CURRENCIES } from './utils/constants';
import { generateId } from './utils/helpers';
import { handleExportPDF } from './utils/pdfExport';
import { Globe } from 'lucide-react';

import Dashboard from './components/views/Dashboard';
import TripView from './components/views/TripView';
import SetupModal from './components/modals/SetupModal';
import SettingsModal from './components/modals/SettingsModal';
import TripModal from './components/modals/TripModal';
import EventModal from './components/modals/EventModal';
import MagicUploadModal from './components/modals/MagicUploadModal';

`;

    const newReturn = `
  const triggerExport = () => {
    handleExportPDF(activeTrip, currency, getAttachmentUrl, setIsExporting);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-neutral-950 font-sans">
        <div className="flex flex-col items-center gap-4">
          <Globe className="w-12 h-12 text-indigo-500 animate-pulse" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-neutral-200 tracking-tight">Loading WisteRia...</h2>
        </div>
      </div>
    );
  }

  if (showSetup) {
    return (
      <div className={\`min-h-screen font-sans bg-slate-50 transition-colors duration-300 \${darkMode ? 'dark-theme bg-neutral-950 text-neutral-50' : 'bg-slate-50 text-slate-900'}\`}>
        <SetupModal onComplete={handleSetupComplete} />
      </div>
    );
  }

  return (
    <div className={\`min-h-screen font-sans selection:bg-purple-300 transition-colors duration-300 \${darkMode ? 'dark-theme bg-neutral-950 text-neutral-50' : 'bg-slate-50 text-slate-900'}\`}>
      {darkMode && (
        <style>{\`
          @media screen {
            /* Base Neutral Gray Palette Overrides based on user hex codes */
            .dark-theme { background-color: #0a0a0a !important; color: #fafafa !important; }
            
            .dark-theme .bg-white { background-color: #171717 !important; }
            .dark-theme .bg-slate-50 { background-color: #0a0a0a !important; }
            .dark-theme .bg-slate-100 { background-color: #262626 !important; }
            .dark-theme .bg-slate-200, .dark-theme .bg-slate-200\\\\/50 { background-color: #262626 !important; }
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
            .dark-theme .bg-slate-50\\\\/90 { background-color: rgba(10, 10, 10, 0.9) !important; }
            
            /* Inputs */
            .dark-theme input, .dark-theme textarea, .dark-theme select {
                background-color: transparent !important;
                color: #fafafa !important;
                color-scheme: dark;
            }
            .dark-theme select option { background-color: #171717; color: #fafafa; }
            
            /* PURPLE ACCENT OVERRIDES */
            .dark-theme .bg-blue-600, .dark-theme .bg-indigo-600, .dark-theme .bg-purple-600 { background-color: #9333ea !important; color: #fff !important; }
            .dark-theme .hover\\\\:bg-blue-700:hover, .dark-theme .hover\\\\:bg-indigo-700:hover, .dark-theme .hover\\\\:bg-purple-700:hover { background-color: #7e22ce !important; }
            
            .dark-theme .text-blue-600, .dark-theme .text-indigo-600, 
            .dark-theme .text-blue-500, .dark-theme .text-indigo-500, .dark-theme .text-purple-400 { color: #c084fc !important; }
            
            .dark-theme .bg-blue-50, .dark-theme .bg-indigo-50, .dark-theme .bg-purple-900\\\\/10 { background-color: #171717 !important; border: 1px solid #404040 !important; color: #fafafa !important; }
            .dark-theme .text-indigo-700, .dark-theme .text-purple-300 { color: #d8b4fe !important; }

            /* AI Input specific colors */
            .dark-theme .bg-indigo-50.dark-bg-purple-900\\\\/10 { background-color: #171717 !important; }
            .dark-theme .bg-white.sm\\\\:bg-transparent { background-color: transparent !important; }

            /* View Toggles fix */
            .dark-theme .bg-slate-200\\\\/50 { background-color: #262626 !important; }
            .dark-theme .bg-white.text-slate-900.shadow-md { background-color: #404040 !important; color: #fff !important; }
          }
        \`}</style>
      )}

      <header data-tauri-drag-region className="pt-8 bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 sticky top-0 z-50 print:hidden transition-colors duration-300">
        <div data-tauri-drag-region className="max-w-6xl mx-auto px-4 min-h-[4rem] py-2 flex flex-wrap items-center justify-between gap-4">
          <div data-tauri-drag-region className="flex items-center gap-2 text-indigo-600 dark:text-purple-400 transition-colors pointer-events-none pl-14 sm:pl-0">
            <div className="flex items-center gap-3 animate-in slide-in-from-left-4 fade-in duration-500">
              <img src={appIconStyle === 'dark' ? "/app-icon-dark.png" : "/app-icon-light.png"} alt="WisteRia Icon" className="w-8 h-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700" />
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">WisteRia</h1>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 sm:gap-3 ml-auto z-10">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 dark:text-neutral-300 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 px-3 py-1.5 rounded-lg">
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
              className="p-2 text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              title="Settings"
            >
              <Globe size={20} />
            </button>

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

      <main id="trip-export-content" className={\`max-w-6xl mx-auto px-4 py-8 sm:py-10 \${isExporting ? 'pdf-export' : ''}\`}>
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

            onChangeVersion={changeVersion}
            onCreateVersion={createVersion}
            onRenameVersion={renameVersion}
            onDeleteVersion={deleteVersion}
            onAIEdit={handleAIEdit}
            isAIEditing={isAIEditing}
          />
        )}
      </main>

      {isSettingsOpen && (
        <SettingsModal
          currentKey={customApiKey}
          useAppleAI={useAppleAI}
          setUseAppleAI={(v) => {
            setUseAppleAI(v);
            localStorage.setItem('USE_APPLE_AI', v ? 'true' : 'false');
          }}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          appIconStyle={appIconStyle}
          setAppIconStyle={setAppIconStyle}
          userProfile={userProfile}
          onClose={() => setIsSettingsOpen(false)}
          onSave={async (key, apple, iconStyle, newName, newDir) => {
            setCustomApiKey(key);
            localStorage.setItem('GEMINI_API_KEY', key);
            setUseAppleAI(apple);
            localStorage.setItem('USE_APPLE_AI', apple ? 'true' : 'false');

            if (iconStyle !== appIconStyle) {
              setAppIconStyle(iconStyle);
              localStorage.setItem('APP_ICON_STYLE', iconStyle);
              try {
                const iconResName = iconStyle === 'dark' ? 'app-icon-dark.png' : 'app-icon-light.png';
                const absPath = await resolveResource(\`public/\${iconResName}\`);
                await invoke('set_dock_icon', { path: absPath });
              } catch (e) {
                console.error("Failed to dynamically set macOS dock icon:", e);
              }
            }

            if (newName !== userProfile?.name || newDir !== userProfile?.rootDir) {
              const updatedSettings = {
                name: newName || userProfile?.name,
                rootDir: newDir || userProfile?.rootDir,
                theme: darkMode ? 'dark' : 'light'
              };

              try {
                await writeTextFile('settings.json', JSON.stringify(updatedSettings, null, 2), { baseDir: BaseDirectory.AppLocalData });
                setUserProfile(updatedSettings);

                if (newDir !== userProfile?.rootDir) {
                  await mkdir(\`\${updatedSettings.rootDir}/projects\`, { recursive: true }).catch(() => { });
                  setTrips([]);
                  setActiveTripId(null);
                }
              } catch (e) {
                console.error("Failed to update profile settings:", e);
                alert("Failed to save profile changes.");
              }
            }
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
          }}
        />
      )}
    </div>
  );
}
`;

    const finalCode = newImports + '\\nexport default function App() {' + innerApp + newReturn;
    fs.writeFileSync('src/App.jsx.new', finalCode);
    fs.writeFileSync('src/App.jsx', finalCode);
    console.log('Successfully generated and updated new App.jsx');
} else {
    console.error('Failed to parse inner app block.');
}
