"use client";
import { useState } from "react";

interface ChatInterfaceProps {
    selectedDocs: string[];
}

export default function ChatInterface({ selectedDocs }: ChatInterfaceProps) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || selectedDocs.length === 0) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    documentIds: selectedDocs,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
            } else {
                setMessages((prev) => [...prev, { role: "ai", content: `❌ エラー: ${data.error}` }]);
            }
        } catch (e: any) {
            setMessages((prev) => [...prev, { role: "ai", content: `❌ 通信エラーが発生しました` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full flex flex-col h-full">
            <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 flex items-center text-gray-800 pb-3 md:pb-4 border-b">
                <svg className="w-6 h-6 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                チャット
            </h2>

            <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-1 md:pr-2 overscroll-contain">
                {selectedDocs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <svg className="w-10 h-10 md:w-12 md:h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        <p className="text-sm md:text-base text-center px-4">上部のリストからチャットで参照したいファイルを選択してください</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        <p className="text-sm md:text-base text-center px-4 bg-gray-50 rounded-full py-2 px-6">選択したファイルについて何でも質問してください</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} px-1 md:px-2`}>
                            <div className={`max-w-[85%] md:max-w-[75%] px-4 py-2.5 md:py-3 rounded-2xl text-sm md:text-base shadow-sm ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-gray-100 border border-gray-200 text-gray-800 rounded-tl-sm whitespace-pre-wrap"}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && (
                    <div className="flex justify-start px-1 md:px-2">
                        <div className="bg-gray-100 text-gray-500 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center space-x-2 shadow-sm border border-gray-200">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={handleSend} className="mt-auto relative group flex items-center bg-gray-100 rounded-full pr-1 shadow-inner focus-within:ring-2 focus-within:ring-indigo-200 focus-within:bg-white transition-all">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={selectedDocs.length === 0 || isLoading}
                    placeholder={selectedDocs.length > 0 ? "質問を入力してください..." : "ファイルを選択してください"}
                    className="w-full px-5 py-3.5 md:py-4 bg-transparent border-transparent rounded-full focus:outline-none text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                    type="submit"
                    disabled={selectedDocs.length === 0 || isLoading || !input.trim()}
                    className="flex-shrink-0 p-2 md:p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors m-1 active:scale-95"
                >
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
            </form>
        </div>
    );
}
