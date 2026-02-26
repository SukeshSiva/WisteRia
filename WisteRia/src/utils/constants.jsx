import { Plane, Bus, Train, Coffee, BedDouble, Map, FileText, Footprints, Sofa, Utensils } from 'lucide-react';

export const CURRENCIES = [
    { code: 'USD', symbol: '$', label: 'US Dollar' },
    { code: 'EUR', symbol: '€', label: 'Euro' },
    { code: 'GBP', symbol: '£', label: 'British Pound' },
    { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
    { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
    { code: 'CAD', symbol: '$', label: 'Canadian Dollar' },
    { code: 'AUD', symbol: '$', label: 'Australian Dollar' }
];

export const EVENT_ICONS = {
    flight: <Plane size={20} />,
    bus: <Bus size={20} />,
    train: <Train size={20} />,
    food: <Utensils size={20} />,
    coffee: <Coffee size={20} />,
    lodging: <BedDouble size={20} />,
    activity: <Map size={20} />,
    walking: <Footprints size={20} />,
    rest: <Sofa size={20} />,
    other: <FileText size={20} />
};

export const EVENT_COLORS = {
    flight: 'bg-blue-500/20 dark:bg-blue-500/30 text-blue-700 dark:text-blue-400 border-blue-500/30',
    bus: 'bg-emerald-500/20 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    train: 'bg-indigo-500/20 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
    food: 'bg-orange-500/20 dark:bg-orange-500/30 text-orange-700 dark:text-orange-400 border-orange-500/30',
    coffee: 'bg-yellow-600/20 dark:bg-yellow-600/30 text-yellow-800 dark:text-yellow-500 border-yellow-600/30',
    lodging: 'bg-purple-500/20 dark:bg-purple-500/30 text-purple-700 dark:text-purple-400 border-purple-500/30',
    activity: 'bg-pink-500/20 dark:bg-pink-500/30 text-pink-700 dark:text-pink-400 border-pink-500/30',
    walking: 'bg-teal-500/20 dark:bg-teal-500/30 text-teal-700 dark:text-teal-400 border-teal-500/30',
    rest: 'bg-amber-500/20 dark:bg-amber-500/30 text-amber-700 dark:text-amber-400 border-amber-500/30',
    other: 'bg-slate-500/20 dark:bg-slate-500/40 text-slate-700 dark:text-slate-300 border-slate-500/30'
};
