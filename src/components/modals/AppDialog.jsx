import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Info, Edit3, Trash2, X } from 'lucide-react';

/**
 * In-app dialog component replacing window.confirm, window.prompt, and alert.
 * 
 * Props:
 *   open       - boolean, whether dialog is visible
 *   type       - 'confirm' | 'prompt' | 'alert'
 *   title      - dialog title
 *   message    - dialog message/description
 *   defaultValue - default input value for prompt type
 *   placeholder  - input placeholder for prompt type
 *   confirmText  - text for confirm button (default: 'Confirm')
 *   cancelText   - text for cancel button (default: 'Cancel')
 *   danger       - boolean, if true uses red/destructive styling
 *   icon         - optional icon override (React element)
 *   onConfirm    - callback(value?) called on confirm. For prompt, passes input value
 *   onCancel     - callback() called on cancel or dismiss
 */
export default function AppDialog({
    open,
    type = 'confirm',
    title = '',
    message = '',
    defaultValue = '',
    placeholder = '',
    confirmText,
    cancelText = 'Cancel',
    danger = false,
    icon,
    onConfirm,
    onCancel
}) {
    const [inputValue, setInputValue] = useState(defaultValue);
    const inputRef = useRef(null);
    const dialogRef = useRef(null);

    useEffect(() => {
        if (open) {
            setInputValue(defaultValue);
            // Focus input for prompt, or dialog for keyboard handling
            setTimeout(() => {
                if (type === 'prompt' && inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.select();
                } else if (dialogRef.current) {
                    dialogRef.current.focus();
                }
            }, 50);
        }
    }, [open, defaultValue, type]);

    if (!open) return null;

    const handleConfirm = () => {
        if (type === 'prompt') {
            onConfirm?.(inputValue);
        } else {
            onConfirm?.();
        }
    };

    const handleCancel = () => {
        onCancel?.();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            handleCancel();
        } else if (e.key === 'Enter' && type !== 'prompt') {
            handleConfirm();
        }
    };

    const handlePromptKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    const resolvedConfirmText = confirmText || (type === 'alert' ? 'OK' : danger ? 'Delete' : 'Confirm');

    const getIcon = () => {
        if (icon) return icon;
        if (danger) return <AlertTriangle size={22} className="text-red-500" />;
        if (type === 'prompt') return <Edit3 size={22} className="text-indigo-500 dark:text-purple-400" />;
        if (type === 'alert') return <Info size={22} className="text-amber-500" />;
        return <Info size={22} className="text-indigo-500 dark:text-purple-400" />;
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={handleCancel}
            />

            {/* Dialog */}
            <div
                ref={dialogRef}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                className="relative z-10 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-700 w-[90vw] max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 outline-none"
            >
                {/* Header */}
                <div className="flex items-start gap-3 p-5 pb-2">
                    <div className="shrink-0 mt-0.5 p-2 rounded-xl bg-slate-100 dark:bg-neutral-800">
                        {getIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-neutral-50 leading-snug">
                            {title}
                        </h3>
                        {message && (
                            <p className="text-sm font-medium text-slate-500 dark:text-neutral-400 mt-1.5 leading-relaxed whitespace-pre-line">
                                {message}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleCancel}
                        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Prompt Input */}
                {type === 'prompt' && (
                    <div className="px-5 pt-2 pb-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={handlePromptKeyDown}
                            placeholder={placeholder}
                            className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 p-5 pt-4">
                    {type !== 'alert' && (
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        className={`px-5 py-2.5 rounded-xl text-sm font-extrabold text-white transition-all shadow-sm ${danger
                                ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                                : 'bg-indigo-600 dark:bg-purple-600 hover:bg-indigo-700 dark:hover:bg-purple-700 active:bg-indigo-800'
                            }`}
                    >
                        {resolvedConfirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
