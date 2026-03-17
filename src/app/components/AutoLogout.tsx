"use client";
import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

export default function AutoLogout({ timeoutMinutes = 60 }: { timeoutMinutes?: number }) {
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const resetTimer = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        
        timerRef.current = setTimeout(async () => {
            // User has been idle for the specified minutes
            console.log(`User inactive for ${timeoutMinutes} minutes. Logging out...`);
            await signOut({ redirect: false });
            window.location.href = "https://accounts.google.com/Logout";
        }, timeoutMinutes * 60 * 1000);
    };

    useEffect(() => {
        // Initialize timer
        resetTimer();

        // Events to monitor for activity
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        
        const handleActivity = () => resetTimer();

        events.forEach(event => {
            window.addEventListener(event, handleActivity);
        });

        // Cleanup
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [timeoutMinutes]);

    // Renders nothing visible
    return null;
}
