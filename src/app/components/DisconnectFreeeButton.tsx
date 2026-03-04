"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DisconnectFreeeButton() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleDisconnect = async () => {
        if (!confirm("freeeとの連携を解除しますか？")) return;

        setIsLoading(true);
        try {
            await fetch("/api/freee/disconnect", {
                method: "POST"
            });
            router.refresh(); // Refresh the page to show the connect button again
        } catch (error) {
            console.error("Failed to disconnect freee", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleDisconnect}
            disabled={isLoading}
            className="text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 px-3 py-1.5 rounded-full shadow-sm transition-colors flex items-center ml-2 disabled:opacity-50"
            title="freee連携を解除する"
        >
            {isLoading ? "解除中..." : "解除"}
        </button>
    );
}
