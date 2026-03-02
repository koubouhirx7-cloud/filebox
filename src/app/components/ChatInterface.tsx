"use client";
import { useState, useEffect } from "react";

interface ChatInterfaceProps {
    selectedDocs: string[];
    folderId: string;
}

export default function ChatInterface({ selectedDocs, folderId }: ChatInterfaceProps) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch history
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/chat?folderId=${folderId}`);
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.messages || []);
                }
            } catch (e) {
                console.error("Failed to fetch chat history", e);
            }
        };
        if (folderId) fetchHistory();
    }, [folderId]);

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
                    folderId: folderId
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
            <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 flex items-center justify-between text-gray-800 pb-3 md:pb-4 border-b">
                <div className="flex items-center">
                    <svg className="w-6 h-6 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    チャット
                </div>
                {selectedDocs.length > 0 && (
                    <div className="flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 animate-pulse">
                        <span className="relative flex h-2 w-2 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        {selectedDocs.length}個のソースを分析中
                    </div>
                )}
            </h2>

            <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-1 md:pr-2 overscroll-contain">
                {selectedDocs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <svg className="w-10 h-10 md:w-12 md:h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <p className="text-sm md:text-base text-center px-4">分析対象のソースがありません。ファイルをアップロードしてください。</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        <p className="text-sm md:text-base text-center px-4 bg-gray-50 rounded-full py-2 px-6">全てのソースを把握しています。何でも質問してください。</p>
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
