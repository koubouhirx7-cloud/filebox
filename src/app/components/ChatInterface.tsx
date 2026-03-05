"use client";
import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FileUpload from "./FileUpload";

// Custom Searchable Dropdown Component
function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "選択してください",
    name
}: {
    options: { id: string | number; name: string }[];
    value: string;
    onChange: (e: any) => void;
    placeholder?: string;
    name: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.name.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = options.find(opt => String(opt.id) === String(value));

    return (
        <div ref={wrapperRef} className="relative w-full text-sm">
            {/* Standard hidden input to hold the actual value for form compatibility */}
            <input type="hidden" name={name} value={value} />

            {/* Trigger Button */}
            <div
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white flex justify-between items-center cursor-pointer focus-within:ring-2 focus-within:ring-blue-200"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`truncate ${selectedOption ? "text-gray-900" : "text-gray-400"}`}>
                    {selectedOption ? selectedOption.name : placeholder}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 flex flex-col">
                    <div className="p-2 border-b border-gray-100 flex-shrink-0">
                        <input
                            type="text"
                            className="w-full px-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                            placeholder="名前で検索..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                        />
                    </div>
                    <ul className="overflow-y-auto w-full">
                        <li
                            className={`px-3 py-2 cursor-pointer hover:bg-gray-50 text-gray-500 ${!value ? "bg-blue-50 text-blue-700 font-medium" : ""}`}
                            onClick={() => {
                                onChange({ target: { name, value: "" } });
                                setIsOpen(false);
                                setSearch("");
                            }}
                        >
                            未選択
                        </li>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <li
                                    key={opt.id}
                                    className={`px-3 py-2 cursor-pointer hover:bg-gray-50 text-gray-800 ${String(value) === String(opt.id) ? "bg-blue-50 text-blue-700 font-medium" : ""}`}
                                    onClick={() => {
                                        onChange({ target: { name, value: String(opt.id) } });
                                        setIsOpen(false);
                                        setSearch("");
                                    }}
                                >
                                    {opt.name}
                                </li>
                            ))
                        ) : (
                            <li className="px-3 py-3 text-center text-gray-400">見つかりませんでした</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

interface ChatInterfaceProps {
    selectedDocs: string[];
    selectedDocNames?: string[];
    folderId: string;
    reloadTrigger?: number;
    documents?: any[];
}

export default function ChatInterface({ selectedDocs, selectedDocNames = [], folderId, reloadTrigger = 0, documents = [] }: ChatInterfaceProps) {
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
        const [partners, setPartners] = useState<any[]>([]);
        const [isLoadingItems, setIsLoadingItems] = useState(true);
        const [partnersError, setPartnersError] = useState("");

        useEffect(() => {
            const fetchItemsAndPartners = async () => {
                try {
                    const [itemsRes, partnersRes] = await Promise.all([
                        fetch("/api/freee/account_items"),
                        fetch("/api/freee/partners")
                    ]);

                    if (itemsRes.ok) {
                        const itemsData = await itemsRes.json();
                        setAccountItems(itemsData.items || []);

                        // Auto-select a sensible default if none provided
                        if (!initialData.accountItemId && itemsData.items && itemsData.items.length > 0) {
                            const isIncome = data.dealType === "income";
                            let bestMatch = null;
                            if (isIncome) {
                                bestMatch = itemsData.items.find((i: any) => i.name.includes("売上高") || i.name.includes("売上"));
                            } else {
                                bestMatch = itemsData.items.find((i: any) => i.name.includes("仕入高") || i.name.includes("仕入") || i.name.includes("消耗品費") || i.name.includes("雑費"));
                            }
                            if (bestMatch) {
                                setData((prev: any) => ({ ...prev, accountItemId: bestMatch.id }));
                            } else {
                                setData((prev: any) => ({ ...prev, accountItemId: itemsData.items[0].id }));
                            }
                        }
                    }

                    if (partnersRes.ok) {
                        const partnersData = await partnersRes.json();
                        const fetchedPartners = partnersData.partners || [];
                        setPartners(fetchedPartners);

                        // Auto-match partnerName from AI to a fetched partner
                        if (initialData.partnerName && fetchedPartners.length > 0) {
                            const exactMatch = fetchedPartners.find((p: any) => p.name === initialData.partnerName || p.name.includes(initialData.partnerName) || initialData.partnerName.includes(p.name));
                            if (exactMatch) {
                                setData((prev: any) => ({ ...prev, partnerId: exactMatch.id }));
                            }
                        }
                    } else {
                        setPartnersError("⚠️ 取引先の取得に失敗しました。freeeアプリ設定内で「取引先の参照」権限が許可されているかご確認ください。");
                    }
                } catch (e) { }
                setIsLoadingItems(false);
            };
            fetchItemsAndPartners();
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

        const handleMarkAsRegistered = async () => {
            if (!data.documentId) return;
            setStatus("loading");
            try {
                const res = await fetch(`/api/files/${data.documentId}/register`, {
                    method: "PATCH",
                });
                if (!res.ok) {
                    throw new Error("更新に失敗しました");
                }
                setStatus("success");
                if (onRegister) onRegister();
                // trigger a reload so the parent component refetches data
                setTimeout(() => window.location.reload(), 1500);
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
                            <SearchableSelect
                                name="accountItemId"
                                value={data.accountItemId || ""}
                                onChange={handleChange}
                                options={accountItems}
                                placeholder="-- 勘定科目を選択 --"
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">取引先名 (Partner)</label>
                        {/* @ts-ignore - implicitly typed any for isLoadingPartners */}
                        {isLoadingItems ? (
                            <div className="text-xs text-gray-500 py-2 animate-pulse">取引先を読み込み中...</div>
                        ) : (
                            <div className="space-y-2">
                                {partnersError && (
                                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">{partnersError}</div>
                                )}
                                <div>
                                    <SearchableSelect
                                        name="partnerId"
                                        value={data.partnerId || ""}
                                        onChange={handleChange}
                                        options={partners}
                                        placeholder="-- 取引先を選択 (未選択) --"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">※プルダウンで選択された取引先が優先してfreeeに登録されます。</p>
                                </div>
                                <input placeholder="新規作成・直接入力の場合はこちら" className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-200 focus:outline-none text-sm ${data.partnerId ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-gray-50 border-gray-300"}`} name="partnerName" value={data.partnerName || ""} onChange={handleChange} title={data.partnerId ? "プルダウンが選択されているため、こちらのテキスト入力欄は無視されます" : ""} />
                            </div>
                        )}
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
                    <div className="flex flex-col gap-2 mt-4">
                        <button onClick={handleSubmit} disabled={status === "loading"} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-colors flex justify-center items-center">
                            {status === "loading" ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    処理中...
                                </>
                            ) : "内容を確認して freeeへ登録"}
                        </button>

                        {data.documentId && (
                            <button onClick={handleMarkAsRegistered} disabled={status === "loading"} className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 font-medium py-2 rounded-lg transition-colors text-xs flex justify-center items-center">
                                freee連携せず、「登録済み」として非表示にする
                            </button>
                        )}
                    </div>
                    {status === "error" && <p className="text-red-500 text-xs mt-2 p-2 bg-red-50 rounded">❌ エラー: {errorMsg}</p>}
                </div>
            </div>
        )
    }

    const renderMessageContent = (content: string) => {
        let accountingDataList: any[] = [];
        let textContent = content;

        // More robust JSON extraction: find any complete JSON array or object
        // that looks like it could be our accounting data.
        const extractJSON = (text: string) => {
            const results: any[] = [];
            let cleanText = text;
            try {
                // First try matching standard markdown code blocks
                const blockRegex = /```(?:json)?\n([\s\S]*?)\n```/g;
                let match;
                while ((match = blockRegex.exec(text)) !== null) {
                    const parsed = JSON.parse(match[1]);
                    if (Array.isArray(parsed) && parsed.some(p => p.isAccountingData)) {
                        results.push(...parsed.filter(p => p.isAccountingData));
                        cleanText = cleanText.replace(match[0], '');
                    } else if (parsed && typeof parsed === 'object' && parsed.isAccountingData) {
                        results.push(parsed);
                        cleanText = cleanText.replace(match[0], '');
                    }
                }

                // If strict JSON.parse failed, try a very aggressive regex-based extraction
                // since AI often generates malformed JSON (e.g., trailing commas, unquoted keys, raw text)
                if (results.length === 0) {
                    const findValue = (str: string, key: string) => {
                        const regex = new RegExp(`"${key}"\\s*:\\s*(?:"([^"]+)"|([^,}]+))`);
                        const match = str.match(regex);
                        if (match) {
                            return match[1] !== undefined ? match[1].trim() : match[2].trim();
                        }
                        return null;
                    };

                    // Look for blocks that look like our objects
                    const objectBlocks = text.match(/\{[^{}]*"isAccountingData"[^{}]*\}/g);
                    if (objectBlocks) {
                        for (const block of objectBlocks) {
                            try {
                                // Try normal parse first
                                const parsed = JSON.parse(block);
                                if (parsed && parsed.isAccountingData) {
                                    results.push(parsed);
                                    cleanText = cleanText.replace(block, '');
                                    continue;
                                }
                            } catch (e) {
                                // Fallback to manual regex extraction for malformed JSON
                                const isAccountingData = block.includes('"isAccountingData": true');
                                if (isAccountingData) {
                                    const amountStr = findValue(block, "amount");
                                    const amount = amountStr ? parseInt(amountStr.replace(/[^0-9-]/g, ''), 10) : 0;

                                    results.push({
                                        isAccountingData: true,
                                        documentId: findValue(block, "documentId") || "",
                                        partnerName: findValue(block, "partnerName") || "",
                                        issueDate: findValue(block, "issueDate") || "",
                                        amount: amount,
                                        description: findValue(block, "description") || "",
                                        taxRate: findValue(block, "taxRate") || "10",
                                    });
                                    cleanText = cleanText.replace(block, '');
                                }
                            }
                        }
                    }
                }

                // --- STRICT FILTERING OF ALREADY REGISTERED DOCUMENTS ---
                const registeredSelectedIds = new Set(
                    selectedDocs.filter(id => {
                        const doc = documents.find(d => d.id === id);
                        return doc?.isRegisteredToFreee;
                    })
                );

                // If ALL selected documents are registered, we can safely drop all AI JSON results
                // This prevents AI hallucinating generic documentIds or omitting them
                if (registeredSelectedIds.size === selectedDocs.length && selectedDocs.length > 0) {
                    return { data: [], cleanText: text }; // Return original text without stripping if it was all registered
                }

                // If a mix, filter out any results that explicitly map to a registered document
                const filteredResults = results.filter(r => {
                    if (r.documentId && registeredSelectedIds.has(r.documentId)) return false;
                    return true;
                });

                return { data: filteredResults, cleanText: cleanText.trim() };

            } catch (e) {
                console.error("Failed to parse JSON from AI response:", e);
                return { data: results, cleanText: cleanText.trim() };
            }
        };

        const extracted = extractJSON(content);
        accountingDataList = extracted.data;
        textContent = extracted.cleanText;

        return (
            <div className="space-y-4 w-full">
                <div className="prose prose-sm prose-indigo max-w-none prose-table:border-collapse prose-th:border prose-th:border-gray-200 prose-td:border prose-td:border-gray-200 prose-th:p-2 prose-td:p-2 prose-th:bg-gray-50">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {textContent}
                    </ReactMarkdown>
                </div>

                {/* Render suggestion buttons separately if they were extracted from text, or we can let markdown handle lists. For this app, let's keep the custom buttons by extracting them from textContent */}
                {textContent.split('\n').map((line, i) => {
                    const match = line.match(/^[-*]\s*おすすめ:\s*(.+)/);
                    if (match) {
                        const suggestion = match[1].replace(/^「|」$/g, '');
                        return (
                            <button
                                key={`sug-${i}`}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="block w-full text-left bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 px-4 py-2 rounded-xl text-sm transition-colors mt-2 mb-1 shadow-sm"
                            >
                                <span className="font-bold mr-2">✨</span>
                                {suggestion}
                            </button>
                        );
                    }
                    return null;
                })}

                {accountingDataList.length > 0 && (
                    <div className="space-y-4 pt-2">
                        {accountingDataList.map((data, idx) => {
                            const augmentedData = { ...data };
                            if (!augmentedData.documentId && selectedDocs.length === 1) {
                                augmentedData.documentId = selectedDocs[0];
                            }
                            return <FreeeRegistrationCard key={idx} initialData={augmentedData} />;
                        })}
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
                    <div className={`flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 ${isLoading ? 'animate-pulse' : ''}`}>
                        {isLoading && (
                            <span className="relative flex h-2 w-2 mr-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                        )}
                        <span className="truncate max-w-[150px] md:max-w-xs block">
                            {selectedDocNames.length > 0 ? selectedDocNames.join(', ') : `${selectedDocs.length}個のソース`}
                        </span>
                        <span className="ml-1 flex-shrink-0">{isLoading ? 'を分析中' : 'を選択中'}</span>
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
