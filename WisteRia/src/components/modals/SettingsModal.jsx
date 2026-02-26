import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Settings, X, FolderOpen, Command, Sparkles, Moon, Sun, Info } from 'lucide-react';

export default function SettingsModal({ currentKey, useAppleAI, setUseAppleAI, darkMode, setDarkMode, appIconStyle, setAppIconStyle, userProfile, onClose, onSave, onSwitchDirectory, onTriggerSetup, useRecentDirs }) {
    const [keyInput, setKeyInput] = useState(currentKey);
    const [iconStyleInput, setIconStyleInput] = useState(appIconStyle);
    const [nameInput, setNameInput] = useState(userProfile?.name || '');
    const [dirInput, setDirInput] = useState(userProfile?.rootDir || '');

    // New UI prop handlers
    // onSwitchDirectory(path) -> immediate hot-swap
    // onTriggerSetup() -> closes settings and runs setup wizard
    // recentDirs -> array of directory strings passed from App.jsx

    // This state tracks local input for the visual directory display, but saving applies it to DB.
    // Instead of waiting for "save", let's handle "Open" safely below.

    const handleSelectDir = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Select a WisteRia projects folder to open"
            });
            if (selected && onSwitchDirectory) {
                onSwitchDirectory(selected);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl my-auto overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-xl font-extrabold flex items-center gap-2"><Settings className="text-slate-500" /> Settings</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6">

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Your Name</label>
                        <input
                            type="text"
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all font-semibold"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Workspace Directory</label>

                        <div className="bg-slate-50 border-2 border-slate-100 rounded-xl p-4 gap-3 flex flex-col items-start w-full">
                            <span className="truncate text-xs font-mono text-slate-500 font-medium w-full block text-center bg-white border border-slate-200 px-3 py-2 rounded-lg">{useRecentDirs && useRecentDirs.length > 0 ? useRecentDirs[0] : (userProfile?.rootDir || 'No directory loaded')}</span>

                            <div className="flex gap-2 w-full">
                                <button
                                    onClick={handleSelectDir}
                                    className="flex-1 flex items-center justify-center gap-2 border bg-white border-slate-200 rounded-lg px-2 py-2 hover:border-indigo-400 hover:text-indigo-600 transition-all text-sm font-bold text-slate-700 shadow-sm"
                                >
                                    <FolderOpen size={16} /> Open Existing
                                </button>
                                <button
                                    onClick={() => { if (onTriggerSetup) onTriggerSetup(); }}
                                    className="flex-1 flex items-center justify-center gap-2 border bg-white border-slate-200 rounded-lg px-3 py-2 hover:border-emerald-500 hover:text-emerald-600 transition-all text-sm font-bold text-slate-700 shadow-sm"
                                >
                                    <Sparkles size={16} /> Create New
                                </button>
                            </div>
                        </div>

                        {/* Recent directories UI */}
                        {useRecentDirs && useRecentDirs.length > 1 && (
                            <div className="mt-4">
                                <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Recent Workspaces</p>
                                <div className="space-y-1.5 bg-slate-50 border border-slate-100 p-2 rounded-xl">
                                    {useRecentDirs.slice(1, 4).map((rDir, i) => (
                                        <button
                                            key={i}
                                            onClick={() => onSwitchDirectory && onSwitchDirectory(rDir)}
                                            className="w-full text-left truncate text-xs font-mono text-slate-600 font-medium bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 px-3 py-2 rounded-lg transition-colors overflow-hidden text-ellipsis whitespace-nowrap"
                                        >
                                            {rDir}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed text-center">Opening or creating a workspace will automatically reload the application.</p>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Command className="text-slate-700" size={16} />
                                    Apple Intelligence
                                </label>
                                <p className="text-xs text-slate-500 mt-0.5">Use on-device AI instead of Gemini</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setUseAppleAI(!useAppleAI)}
                                className={`w-12 h-6 rounded-full transition-colors relative flex items-center shadow-inner ${useAppleAI ? 'bg-indigo-600' : 'bg-slate-300'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full absolute shadow-sm transition-transform ${useAppleAI ? 'translate-x-7' : 'translate-x-1'}`}></div>
                            </button>
                        </div>
                    </div>

                    {!useAppleAI ? (
                        <div className="border-t border-slate-200 pt-6 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 mb-2">
                                <label className="block text-sm font-bold text-slate-700">Custom Gemini API Key</label>
                                <div className="relative group">
                                    <Info size={14} className="text-slate-400 cursor-help" />
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block w-56 bg-slate-800 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 shadow-xl z-30">
                                        Get a free API key at <span className="font-bold underline">aistudio.google.com</span> → Get API Key → Create.
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 -mt-1"></div>
                                    </div>
                                </div>
                            </div>
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
                    ) : (
                        <div className="border-t border-slate-200 pt-6 animate-in fade-in slide-in-from-top-2">
                            <div className="bg-indigo-50 text-indigo-700 p-4 rounded-xl text-sm leading-relaxed border border-indigo-100 flex gap-3 items-start">
                                <Sparkles className="shrink-0 mt-0.5" size={18} />
                                <p>
                                    <strong>Apple Intelligence Enabled</strong><br />
                                    All requests will run privately on your device. Note: Image extraction is not supported by Apple's on-device model and will require a Gemini API key.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="border-t border-slate-200 pt-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700">App Icon Style</label>
                                <p className="text-xs text-slate-500 mt-0.5">Choose the light or dark app icon</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIconStyleInput(iconStyleInput === 'dark' ? 'light' : 'dark')}
                                className={`w-12 h-6 rounded-full transition-colors relative flex items-center shadow-inner ${iconStyleInput === 'dark' ? 'bg-slate-800' : 'bg-slate-300'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full absolute shadow-sm transition-transform flex items-center justify-center ${iconStyleInput === 'dark' ? 'translate-x-7' : 'translate-x-1'}`}></div>
                            </button>
                        </div>

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
                                <div className={`w-4 h-4 bg-white rounded-full absolute shadow-sm transition-transform flex items-center justify-center ${darkMode ? 'translate-x-7' : 'translate-x-1'}`}>
                                    {darkMode ? <Moon size={10} className="text-purple-600" /> : <Sun size={10} className="text-slate-400" />}
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                        <button type="button" onClick={() => onSave(keyInput, useAppleAI, iconStyleInput, nameInput, dirInput)} className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/30">Save Settings</button>
                    </div>
                </div>
            </div >
        </div >
    );
}
