import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Globe, User, FolderOpen } from 'lucide-react';

export default function SetupModal({ onComplete }) {
    const [name, setName] = useState('');
    const [directory, setDirectory] = useState('');

    const handleSelectDir = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Select a folder to store your WisteRia projects"
            });
            if (selected) {
                setDirectory(selected);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to open directory picker.");
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !directory) {
            alert("Please provide your name and select a storage directory.");
            return;
        }
        onComplete(name.trim(), directory);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
                <div className="p-8 sm:p-12 text-center border-b border-slate-100 dark:border-neutral-800 bg-indigo-50/50 dark:bg-purple-900/10">
                    <div className="mx-auto w-20 h-20 bg-white dark:bg-neutral-800 rounded-2xl shadow-lg border border-slate-200 dark:border-neutral-700 flex items-center justify-center mb-6">
                        <Globe className="w-10 h-10 text-indigo-600 dark:text-purple-400" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">Welcome to WisteRia</h2>
                    <p className="text-slate-500 dark:text-neutral-400 text-sm sm:text-base px-4">Let's set up your profile and choose where to securely store your trip data.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 sm:p-10 space-y-8">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-2">Your Name</label>
                            <div className="relative border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-4 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all bg-slate-50 dark:bg-neutral-950 flex items-center gap-3">
                                <User className="text-slate-400" size={20} />
                                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full outline-none text-lg font-bold text-slate-900 dark:text-neutral-50 placeholder:text-slate-300 dark:placeholder:text-neutral-700 bg-transparent" placeholder="e.g. Alex" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-2">Data Storage Location</label>
                            <div
                                onClick={handleSelectDir}
                                className="relative border-2 border-slate-200 dark:border-neutral-800 border-dashed hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-purple-900/20 rounded-2xl p-4 transition-all cursor-pointer flex items-center justify-between group"
                            >
                                <div className="flex flex-col gap-1 overflow-hidden pr-4">
                                    <span className={`font-bold text-sm truncate ${directory ? 'text-indigo-700 dark:text-purple-400' : 'text-slate-500 dark:text-neutral-500'}`}>
                                        {directory ? directory : "Choose a folder..."}
                                    </span>
                                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-semibold">Projects will be saved here</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm">
                                    <FolderOpen className="text-slate-500 dark:text-neutral-400 w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full py-4 bg-indigo-600 dark:bg-purple-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 dark:hover:bg-purple-700 transition-all shadow-xl shadow-indigo-600/20 hover:scale-[1.02]">
                        Get Started
                    </button>
                </form>
            </div>
        </div>
    );
}
