"use client";
import { useState, useEffect } from "react";

interface ChatInterfaceProps {
    selectedDocs: string[];
    selectedDocNames?: string[];
    folderId: string;
    reloadTrigger?: number;
}

export default function ChatInterface({ selectedDocs, selectedDocNames = [], folderId, reloadTrigger = 0 }: ChatInterfaceProps) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

    // Fetch history
    useEffect(() => {
        setIsHistoryLoaded(false);
        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/chat?folderId=${folderId}`);
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.messages || []);
                }
            } catch (e) {
                console.error("Failed to fetch chat history", e);
            } finally {
                setIsHistoryLoaded(true);
            }
        };
        if (folderId) fetchHistory();
    }, [folderId, reloadTrigger]);

    // Auto Summary Request
    useEffect(() => {
        const triggerInitialSummary = async () => {
            if (isHistoryLoaded && messages.length === 0 && selectedDocs.length > 0) {
                setIsLoading(true);
                setMessages([{ role: "ai", content: "ソースを読み込んで全体の概要とおすすめの質問を作成しています..." }]);

                try {
                    const res = await fetch("/api/chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            message: "INITIAL_REQUEST",
                            documentIds: selectedDocs,
                            folderId: folderId,
                            isInitialRequest: true
                        }),
                    });

                    const data = await res.json();
                    if (res.ok) {
                        setMessages([{ role: "ai", content: data.reply }]);
                    } else {
                        setMessages([{ role: "ai", content: `❌ エラー: ${data.error}` }]);
                    }
                } catch (e: any) {
                    setMessages([{ role: "ai", content: `❌ 通信エラーが発生しました` }]);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        triggerInitialSummary();
    }, [isHistoryLoaded, messages.length, selectedDocs, folderId]);

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

            if (!res.ok) {
                const errorData = await res.json();
                let displayError = errorData.error || "チャットサーバーでエラーが発生しました。";

                // Handle Gemini 503 Error gracefully
                if (typeof displayError === 'string' && displayError.includes('503') && displayError.includes('high demand')) {
                    displayError = "現在Gemini APIが大変混み合っており、回答を生成できません（503エラー）。恐れ入りますが、数分経ってから再度リロードしてお試しください。";
                } else if (typeof displayError === 'object') {
                    displayError = JSON.stringify(displayError);
                    if (displayError.includes('503') || displayError.includes('high demand')) {
                        displayError = "現在Gemini APIが大変混み合っており、回答を生成できません。恐れ入りますが、数分経ってから再度リロードしてお試しください。";
                    }
                }

                setMessages(prev => [...prev, { role: "ai", content: `❌ エラー: ${displayError}` }]);
                return;
            }
            const data = await res.json();
            setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
        } catch (e: any) {
            setMessages((prev) => [...prev, { role: "ai", content: `❌ 通信エラーが発生しました` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setInput(suggestion);
        setTimeout(() => {
            const form = document.getElementById("chat-form") as HTMLFormElement;
            if (form) form.requestSubmit();
        }, 50);
    };

    function FreeeRegistrationCard({ initialData, onRegister }: { initialData: any, onRegister?: () => void }) {
        const [data, setData] = useState({
            dealType: "expense",
            settlementStatus: "unsettled",
            ...initialData
        });
        const [accountItems, setAccountItems] = useState<any[]>([]);
        const [isLoadingItems, setIsLoadingItems] = useState(true);

        useEffect(() => {
            const fetchItems = async () => {
                try {
                    const res = await fetch("/api/freee/account_items");
                    if (res.ok) {
                        const data = await res.json();
                        setAccountItems(data.items || []);

                        // Auto-select a sensible default if none provided
                        if (!initialData.accountItemId && data.items && data.items.length > 0) {
                            const isIncome = data.dealType === "income";
                            let bestMatch = null;
                            if (isIncome) {
                                bestMatch = data.items.find((i: any) => i.name.includes("売上高") || i.name.includes("売上"));
                            } else {
                                bestMatch = data.items.find((i: any) => i.name.includes("仕入高") || i.name.includes("仕入") || i.name.includes("消耗品費") || i.name.includes("雑費"));
                            }
                            if (bestMatch) {
                                setData((prev: any) => ({ ...prev, accountItemId: bestMatch.id }));
                            } else {
                                setData((prev: any) => ({ ...prev, accountItemId: data.items[0].id }));
                            }
                        }
                    }
                } catch (e) { }
                setIsLoadingItems(false);
            };
            fetchItems();
        }, []);

        const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
        const [errorMsg, setErrorMsg] = useState("");

        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            const { name, value } = e.target;
            setData((prev: any) => ({ ...prev, [name]: value }));
        };

        const handleSubmit = async () => {
            setStatus("loading");
            try {
                const res = await fetch("/api/freee/deals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                if (!res.ok) {
                    const err = await res.json();
                    let errMsg = err.error || "登録に失敗しました";
                    // If Freee returned specific validation errors, append them
                    if (err.details && err.details.errors) {
                        const specificErrors = err.details.errors.map((e: any) => e.messages ? e.messages.join(", ") : "").filter(Boolean).join(" | ");
                        if (specificErrors) {
                            errMsg += ` 詳細: ${specificErrors}`;
                        }
                    }
                    throw new Error(errMsg);
                }
                setStatus("success");
                if (onRegister) onRegister();
            } catch (e: any) {
                setStatus("error");
                setErrorMsg(e.message);
            }
        };

        if (status === "success") {
            return <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 mt-3 shadow-sm text-sm flex items-center"><svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>freeeへの取引登録が完了しました！</div>
        }

        return (
            <div className="bg-white border border-blue-200 rounded-xl p-4 md:p-5 mt-4 shadow-sm text-sm text-gray-800">
                <h4 className="font-bold text-blue-700 mb-4 flex items-center border-b pb-2">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                    freee 取引登録（AI抽出結果）
                </h4>
                <div className="space-y-3">
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">収支状況 (Type)</label>
                            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-200 focus:outline-none" name="dealType" value={data.dealType || "expense"} onChange={handleChange}>
                                <option value="expense">支出 (Expense)</option>
                                <option value="income">収入 (Income)</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">決済ステータス (Status)</label>
                            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-200 focus:outline-none" name="settlementStatus" value={data.settlementStatus || "unsettled"} onChange={handleChange}>
                                <option value="unsettled">未決済 (Unsettled)</option>
                                <option value="settled">決済済み (Settled)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">勘定科目 (Account Item)</label>
                        {isLoadingItems ? (
                            <div className="text-xs text-gray-500 py-2 animate-pulse">勘定科目を読み込み中...</div>
                        ) : (
                            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-200 focus:outline-none" name="accountItemId" value={data.accountItemId || ""} onChange={handleChange}>
                                {accountItems.map((item: any) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">取引先名 (Partner)</label>
                        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-200 focus:outline-none" name="partnerName" value={data.partnerName || ""} onChange={handleChange} />
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">発生日 (Date)</label>
                            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-200 focus:outline-none" name="issueDate" value={data.issueDate || ""} onChange={handleChange} />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">税込金額 (Amount)</label>
                            <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-200 focus:outline-none" name="amount" value={data.amount || ""} onChange={handleChange} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">品目・摘要 (Description)</label>
                        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-200 focus:outline-none" name="description" value={data.description || ""} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">消費税 (Tax)</label>
                        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-200 focus:outline-none" name="taxRate" value={data.taxRate || "10"} onChange={handleChange}>
                            <option value="10">10%</option>
                            <option value="8">8% (軽減税率)</option>
                            <option value="0">対象外・不課税</option>
                        </select>
                    </div>
                    <button onClick={handleSubmit} disabled={status === "loading"} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg mt-4 transition-colors flex justify-center items-center">
                        {status === "loading" ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                登録処理中...
                            </>
                        ) : "内容を確認して freeeへ登録"}
                    </button>
                    {status === "error" && <p className="text-red-500 text-xs mt-2 p-2 bg-red-50 rounded">❌ エラー: {errorMsg}</p>}
                </div>
            </div>
        )
    }

    const renderMessageContent = (content: string) => {
        const jsonMatches = Array.from(content.matchAll(/```(?:json)?\n([\s\S]*?)\n```/g));
        let accountingDataList: any[] = [];
        let textContent = content;

        if (jsonMatches.length > 0) {
            for (const match of jsonMatches) {
                try {
                    const parsed = JSON.parse(match[1]);
                    if (Array.isArray(parsed)) {
                        const validItems = parsed.filter(p => p.isAccountingData);
                        if (validItems.length > 0) {
                            accountingDataList.push(...validItems);
                            textContent = textContent.replace(match[0], '').trim();
                        }
                    } else if (parsed.isAccountingData) {
                        accountingDataList.push(parsed);
                        textContent = textContent.replace(match[0], '').trim();
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }

        const lines = textContent.split('\n');
        return (
            <div className="space-y-1 w-full">
                {lines.map((line, i) => {
                    const match = line.match(/^[-*]\s*おすすめ:\s*(.+)/);
                    if (match) {
                        const suggestion = match[1].replace(/^「|」$/g, ''); // strip quotes if any
                        return (
                            <button
                                key={i}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="block w-full text-left bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 px-4 py-2 rounded-xl text-sm transition-colors mt-2 mb-1 shadow-sm"
                            >
                                <span className="font-bold mr-2">✨</span>
                                {suggestion}
                            </button>
                        );
                    }
                    return <p key={i} className="min-h-[1rem] leading-relaxed">{line}</p>;
                })}
                {accountingDataList.length > 0 && (
                    <div className="space-y-4">
                        {accountingDataList.map((data, idx) => (
                            <FreeeRegistrationCard key={idx} initialData={data} />
                        ))}
                    </div>
                )}
            </div>
        );
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
                        <span className="truncate max-w-[150px] md:max-w-xs block">
                            {selectedDocNames.length > 0 ? selectedDocNames.join(', ') : `${selectedDocs.length}個のソース`}
                        </span>
                        <span className="ml-1 flex-shrink-0">を分析中</span>
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
                                {msg.role === "ai" ? renderMessageContent(msg.content) : msg.content}
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

            <form id="chat-form" onSubmit={handleSend} className="mt-auto relative group flex items-center bg-gray-100 rounded-full pr-1 shadow-inner focus-within:ring-2 focus-within:ring-indigo-200 focus-within:bg-white transition-all">
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
