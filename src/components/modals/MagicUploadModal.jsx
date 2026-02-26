import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { X, Sparkles, AlertCircle, MapPin, Upload, ChevronRight, FileText } from 'lucide-react';
import { callAppleAI } from '../../utils/aiHelpers';

export default function MagicUploadModal({ trip, customApiKey, useAppleAI, onClose, onExtracted }) {
    const [magicMode, setMagicMode] = useState('text');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [plainText, setPlainText] = useState('');
    const [magicLink, setMagicLink] = useState('');

    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const fileInputRef = useRef(null);

    const activeKey = customApiKey || "";

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
            setError('Please upload an image file or PDF (screenshot/document of ticket/receipt).');
            return;
        }

        setSelectedFile(file);
        setError('');

        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result);
        reader.readAsDataURL(file);
    };

    const processPlainText = async () => {
        if (!plainText.trim()) return;
        if (!useAppleAI && !activeKey) {
            setError("Please enter a valid Gemini API Key or enable Apple Intelligence in Settings.");
            return;
        }
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

            let textResponse;
            if (useAppleAI) {
                textResponse = await callAppleAI(prompt + "\n\nRespond ONLY with the JSON array.", "json");
            } else {
                const ai = new GoogleGenAI({ apiKey: activeKey });
                const res = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: prompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
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
                textResponse = res.text;
            }
            if (!textResponse) throw new Error("No response from AI");

            let extractedData;
            try {
                extractedData = JSON.parse(textResponse);
            } catch (e) {
                const cleanText = textResponse.replace(/```(?:json)?\n?|\n?```/g, '').trim();
                extractedData = JSON.parse(cleanText);
            }

            if (!Array.isArray(extractedData)) {
                extractedData = [extractedData];
            }
            onExtracted(extractedData);

        } catch (err) {
            console.error("Text extraction failed:", err);
            setError('Failed to extract events: ' + err.message);
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

            const prompt = `Analyze this document/image (it is likely a travel ticket, booking confirmation, receipt, or itinerary). 
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
                textResponse = await callAppleAI(prompt, "json", base64Data, selectedFile.type);
            } else {
                if (!activeKey) {
                    setError("Please enter a valid Gemini API Key in the Settings.");
                    setLoading(false);
                    return;
                }

                const ai = new GoogleGenAI({ apiKey: activeKey });
                const res = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: [
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: selectedFile.type
                            }
                        },
                        prompt
                    ],
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
            setError('Failed to extract information: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-start justify-center p-4 sm:p-6 animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-neutral-900 rounded-[2rem] w-full max-w-lg shadow-2xl my-auto overflow-hidden animate-in zoom-in-95 duration-200 transition-colors">
                <div className="bg-indigo-600 dark:bg-purple-600 px-6 sm:px-8 py-6 sm:py-8 pb-4 sm:pb-6 text-white text-center relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-indigo-200 dark:text-purple-200 hover:text-white bg-indigo-700/50 dark:bg-purple-700/50 hover:bg-indigo-700 dark:hover:bg-purple-700 p-2 rounded-full transition-colors"><X size={20} /></button>
                    <div className="bg-white/20 w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 backdrop-blur">
                        <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-extrabold">Magic Add</h3>

                    <div className="flex bg-indigo-800/50 dark:bg-purple-900/50 p-1 rounded-xl mt-4 sm:mt-6 shadow-inner">
                        <button onClick={() => setMagicMode('text')} className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${magicMode === 'text' ? 'bg-white dark:bg-neutral-800 text-indigo-700 dark:text-purple-400 shadow-sm' : 'text-indigo-100 dark:text-purple-100 hover:text-white hover:bg-indigo-700 dark:hover:bg-purple-700'}`}>Text Prompt</button>
                        <button onClick={() => setMagicMode('link')} className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${magicMode === 'link' ? 'bg-white dark:bg-neutral-800 text-indigo-700 dark:text-purple-400 shadow-sm' : 'text-indigo-100 dark:text-purple-100 hover:text-white hover:bg-indigo-700 dark:hover:bg-purple-700'}`}>Map Link</button>
                        <button onClick={() => setMagicMode('image')} className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors ${magicMode === 'image' ? 'bg-white dark:bg-neutral-800 text-indigo-700 dark:text-purple-400 shadow-sm' : 'text-indigo-100 dark:text-purple-100 hover:text-white hover:bg-indigo-700 dark:hover:bg-purple-700'}`}>Receipt/Doc</button>
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
                                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1 px-1"><MapPin size={12} /> Map Link</label>
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
                                <div className="border-2 border-dashed border-slate-300 dark:border-neutral-800 rounded-3xl p-8 sm:p-10 text-center hover:bg-white dark:hover:bg-neutral-950 hover:border-indigo-400 dark:hover:border-purple-600 hover:shadow-md transition-all cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                                    <div className="bg-slate-200 dark:bg-neutral-800 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:bg-indigo-100 dark:group-hover:bg-purple-900/50 transition-colors">
                                        <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500 dark:text-neutral-500 group-hover:text-indigo-600 dark:group-hover:text-purple-400 transition-colors" />
                                    </div>
                                    <p className="text-sm sm:text-base text-slate-700 dark:text-neutral-300 font-bold mb-1">Click to upload image or PDF</p>
                                    <p className="text-slate-400 dark:text-neutral-600 text-[10px] sm:text-xs font-medium">JPG, PNG, PDF</p>
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf" value="" onChange={handleFileChange} />
                                </div>
                            ) : (
                                <div className="space-y-4 sm:space-y-6">
                                    <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-neutral-800 bg-slate-200 dark:bg-neutral-950 h-40 sm:h-56 flex items-center justify-center group shadow-inner">
                                        {selectedFile?.type === 'application/pdf' ? (
                                            <div className="flex flex-col items-center justify-center text-slate-500">
                                                <FileText size={48} className="mb-2 text-indigo-400" />
                                                <p className="text-sm font-medium">{selectedFile.name}</p>
                                            </div>
                                        ) : (
                                            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                                        )}
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
