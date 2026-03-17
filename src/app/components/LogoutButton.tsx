"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
    const handleLogout = async () => {
        await signOut({ redirect: false });
        // Redirect to Google's logout endpoint to log out of Google services
        window.location.href = "https://accounts.google.com/Logout";
    };

    return (
        <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors underline"
        >
            ログアウト
        </button>
    );
}
