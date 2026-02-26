import React, { useEffect, useState } from 'react';

export default function StartupSplashScreen({ userName, darkMode, onComplete }) {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        // 0: Initial state
        // 1: Logo appears (0.2s)
        // 2: "Wisteria" text scales out from behind (0.8s)
        // 3: Logo and text slide UP slightly (1.5s)
        // 4: "Welcome" text fades in (1.8s)
        // 5: Entire overlay fades out (2.6s)

        const schedule = [
            { p: 1, t: 200 },
            { p: 2, t: 800 },
            { p: 3, t: 1500 },
            { p: 4, t: 1800 },
            { p: 5, t: 2600 },
            { p: 6, t: 3000 } // Final unmount
        ];

        const timeouts = schedule.map(({ p, t }) => setTimeout(() => setPhase(p), t));

        return () => timeouts.forEach(clearTimeout);
    }, []);

    useEffect(() => {
        if (phase === 6) {
            onComplete();
        }
    }, [phase, onComplete]);

    if (phase === 6) return null;

    const bgStyle = darkMode ? 'bg-[#0a0a0a]' : 'bg-[#f8fafc]';
    const textColor = darkMode ? 'text-white' : 'text-slate-900';
    const subTextColor = darkMode ? 'text-purple-300' : 'text-indigo-600';

    // Opacity for the entire overlay fading out at the end
    const containerOpacity = phase >= 5 ? 'opacity-0' : 'opacity-100';

    // Logo sizing and position
    // In phase < 3, it's centered. In phase >= 3, it translates up relative to the container.
    // Calculations: Logo is 128px (r=64px), Text is ~48px (r=24px), Welcome is ~24px (r=12px)
    const shiftUpClass = phase >= 3 ? '-translate-y-[50px] sm:-translate-y-[60px]' : 'translate-y-0';
    const logoScale = phase >= 1 ? 'scale-100 opacity-100' : 'scale-50 opacity-0';

    // Wisteria Text: hidden behind logo initially, then moves down & scales up
    const textTitleStyles = phase >= 2
        ? 'translate-y-[86px] sm:translate-y-[104px] scale-100 opacity-100'
        : 'translate-y-0 scale-50 opacity-0';

    // Welcome Text
    const welcomeOpacity = phase >= 4
        ? 'opacity-100 translate-y-[128px] sm:translate-y-[152px]'
        : 'opacity-0 translate-y-[100px] sm:translate-y-[120px]';

    const logoSrc = darkMode ? '/app-icon-dark.png' : '/app-icon-light.png';

    return (
        <div className={`fixed inset-0 z-[100] overflow-hidden flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${bgStyle} ${containerOpacity}`}>
            <div className={`relative flex flex-col w-full px-4 items-center justify-center transition-transform duration-700 ease-in-out ${shiftUpClass}`}>

                {/* Animated App Icon */}
                <div className={`z-10 absolute transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${logoScale}`}>
                    <img src={logoSrc} alt="Wisteria Logo" className="w-28 h-28 sm:w-32 sm:h-32 drop-shadow-2xl" />
                </div>

                {/* Wisteria Title Text sliding from behind the logo */}
                <h1 className={`absolute text-center w-full px-4 font-black tracking-tight text-4xl sm:text-5xl transition-all duration-700 ease-out z-0 ${textColor} ${textTitleStyles}`}>
                    WisteRia
                </h1>

                {/* Welcome Greeting */}
                <p className={`absolute text-center w-full px-4 font-medium text-lg sm:text-xl transition-all duration-700 ease-out z-10 ${subTextColor} ${welcomeOpacity}`}>
                    {userName ? `Welcome back, ${userName}` : 'Welcome Setup'}
                </p>

            </div>
        </div>
    );
}
