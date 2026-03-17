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

function InteractiveCheckbox({ initialChecked }: { initialChecked: boolean }) {
    const [checked, setChecked] = useState(initialChecked);
    return (
        <input
            type="checkbox"
            checked={checked}
            onChange={() => setChecked(!checked)}
            className="w-4 h-4 text-indigo-600 rounded bg-gray-100 border-gray-300 focus:ring-indigo-500 mr-1.5 accent-indigo-600 cursor-pointer align-middle"
        />
    );
}

interface ChatInterfaceProps {
    selectedDocs: string[];
    selectedDocNames?: string[];
    folderId: string;
    reloadTrigger?: number;
    documents?: any[];
}

function FreeeRegistrationCard({ initialData, onRegister, onPreview }: { initialData: any, onRegister?: () => void, onPreview: (id: string) => void }) {
    const [data, setData] = useState({
        dealType: "expense",
        settlementStatus: "unsettled",
        ...initialData
    });
    const [accountItems, setAccountItems] = useState<any[]>([]);
    const [partners, setPartners] = useState<any[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(true);
    const [partnersError, setPartnersError] = useState("");
    const [itemsError, setItemsError] = useState("");

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
                } else {
                    try {
                        const errData = await itemsRes.json();
                        setItemsError(`取得失敗: ${errData.details || errData.error}`);
                    } catch {
                        setItemsError("勘定科目の取得に失敗しました");
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
                    try {
                        const errData = await partnersRes.json();
                        const errorText = errData.details || errData.error || "";
                        // Add a fallback generic message if it fails silently
                        if (errorText.includes("権限")) {
                            setPartnersError("⚠️ freeeアプリ設定内で「取引先の参照」権限が許可されているかご確認ください。");
                        } else {
                            setPartnersError(`取得失敗: ${errorText}`);
                        }
                    } catch {
                        setPartnersError("取引先の取得に失敗しました");
                    }
                }
            } catch (e) {
                setPartnersError("通信エラーが発生しました");
                setItemsError("通信エラーが発生しました");
            }
            setIsLoadingItems(false);
        };
        fetchItemsAndPartners();
    }, []);

    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    // Sync initialData (crucial for hot-reloads and deferred state updates)
    useEffect(() => {
        if (initialData.documentId && data.documentId !== initialData.documentId) {
            setData((prev: any) => ({ ...prev, documentId: initialData.documentId }));
        }
    }, [initialData.documentId]);

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
            setTimeout(() => window.location.reload(), 1500);
        } catch (e: any) {
            setStatus("error");
            setErrorMsg(e.message);
        }
    };

    const handleMarkAsRegistered = async () => {
        let targetDocId = data.documentId || initialData.documentId;
        if (!targetDocId) {
            alert("対象のファイルが特定できないため、登録済みにできません。該当のファイルのみを単独でアタッチして再度お試しください。");
            return;
        }
        setStatus("loading");
        try {
            const res = await fetch(`/api/files/${targetDocId}/register`, {
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

    const validDocumentId = data.documentId || initialData.documentId;

    return (
        <div className="bg-white border border-blue-200 rounded-xl p-4 md:p-5 mt-4 shadow-sm text-sm text-gray-800">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
                <h4 className="font-bold text-blue-700 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                    freee 取引登録（AI抽出結果）
                </h4>
                {validDocumentId && (
                    <button
                        onClick={(e) => { e.preventDefault(); onPreview(validDocumentId); }}
                        className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-3 rounded-full transition-colors font-medium border border-gray-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        画像を確認
                    </button>
                )}
            </div>
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
                        <div className="space-y-2">
                            {itemsError && (
                                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">{itemsError}</div>
                            )}
                            <SearchableSelect
                                name="accountItemId"
                                value={data.accountItemId || ""}
                                onChange={handleChange}
                                options={accountItems}
                                placeholder="-- 勘定科目を選択 --"
                            />
                        </div>
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


export default function ChatInterface({ selectedDocs, selectedDocNames = [], folderId, reloadTrigger = 0, documents = [] }: ChatInterfaceProps) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

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

    const loadPreview = async (docId: string) => {
        setIsPreviewLoading(true);
        try {
            const res = await fetch(`/api/files/${docId}/link`);
            if (res.ok) {
                const data = await res.json();
                if (data.link) {
                    setPreviewUrl(data.link);
                }
            } else {
                alert("プレビューの取得に失敗しました");
            }
        } catch (e) {
            console.error("Preview failed", e);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleSaveToMemo = async (content: string) => {
        if (!folderId) {
            alert("ノートブックが選択されていません。");
            return;
        }
        try {
            // Remove Markdown formatting like json blocks before saving to memo if we want (optional, but keep it simple for now)
            const res = await fetch(`/api/folders/${folderId}/memos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: content.substring(0, 1000) }) // truncate if too long just in case, or save full
            });
            if (res.ok) {
                alert("ノートブックのメモに保存しました！");
                // Assuming we want to reflect this in the dashboard, we might not need to do anything here if Dashboard auto-fetches on mount,
                // but since they are side by side, Dashboard state might be stale. We're in ChatInterface, so let's just show a success alert.
            } else {
                alert("メモの保存に失敗しました");
            }
        } catch (e) {
            console.error("Failed to save memo", e);
            alert("通信エラーが発生しました");
        }
    };

    const renderMessageContent = (content: string, role: string) => {
        let accountingDataList: any[] = [];
        let textContent = content;

        // More robust JSON extraction
        const extractJSON = (text: string) => {
            const results: any[] = [];
            let cleanText = text;
            try {
                // 1. Try matching markdown code blocks more flexibly
                const blockRegex = /```[a-zA-Z]*\s*([\s\S]*?)```/g;
                let match;
                while ((match = blockRegex.exec(text)) !== null) {
                    try {
                        let jsonStr = match[1].trim();
                        // AI sometimes outputs trailing commas, remove them before parsing
                        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
                        const parsed = JSON.parse(jsonStr);
                        if (Array.isArray(parsed)) {
                            const validItems = parsed.filter(p => p && (p.isAccountingData === true || p.isAccountingData === "true"));
                            if (validItems.length > 0) {
                                results.push(...validItems);
                                cleanText = cleanText.replace(match[0], '');
                            }
                        } else if (parsed && (parsed.isAccountingData === true || parsed.isAccountingData === "true")) {
                            results.push(parsed);
                            cleanText = cleanText.replace(match[0], '');
                        }
                    } catch (e) {
                        console.error("Failed to parse code block JSON:", match[1], e);
                    }
                }

                // 2. Fallback: extract [{ ... }] arrays anywhere in text if code block regex failed
                if (results.length === 0) {
                    const fallbackArrayRegex = /\[\s*\{[\s\S]*"isAccountingData"[\s\S]*\}\s*\]/g;
                    const fallbackMatch = fallbackArrayRegex.exec(cleanText);
                    if (fallbackMatch) {
                        try {
                            let jsonStr = fallbackMatch[0];
                            jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
                            const parsed = JSON.parse(jsonStr);
                            if (Array.isArray(parsed)) {
                                const validItems = parsed.filter(p => p && (p.isAccountingData === true || p.isAccountingData === "true"));
                                if (validItems.length > 0) {
                                    results.push(...validItems);
                                    cleanText = cleanText.replace(fallbackMatch[0], '');
                                }
                            }
                        } catch (e) {
                            console.error("Fallback array regex parsing failed", e);
                        }
                    }
                }

                // 3. Last resort: aggressive greedy block extraction
                if (results.length === 0) {
                    const objectBlocks = cleanText.match(/\{[\s\S]*?"isAccountingData"[\s\S]*?\}/g);
                    if (objectBlocks) {
                        for (const block of objectBlocks) {
                            const isAcc = block.includes('"isAccountingData"');
                            if (isAcc) {
                                const findValue = (str: string, key: string) => {
                                    const regex = new RegExp(`"${key}"\\s*:\\s*(?:"([^"]+)"|([^,}]+))`);
                                    const m = str.match(regex);
                                    return m ? (m[1] !== undefined ? m[1].trim() : m[2].trim()) : null;
                                };
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
                        // Clean up leftover empty brackets and backticks
                        cleanText = cleanText.replace(/```[a-zA-Z]*\s*\[\s*\]\s*```/g, '');
                        cleanText = cleanText.replace(/\[\s*\]/g, '');
                    }
                }

                // --- STRICT FILTERING OF ALREADY REGISTERED DOCUMENTS ---
                const registeredSelectedIds = new Set(
                    selectedDocs.filter(id => {
                        const doc = documents?.find(d => d.id === id);
                        return doc?.isRegisteredToFreee;
                    })
                );

                if (registeredSelectedIds.size === selectedDocs.length && selectedDocs.length > 0) {
                    return { data: [], cleanText: text };
                }

                const filteredResults = results.filter(r => {
                    const rDocId = String(r.documentId || "").trim();
                    if (rDocId && registeredSelectedIds.has(rDocId)) return false;
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
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            a: ({ node, ...props }) => {
                                const href = props.href || "";
                                if (href.startsWith("doc=")) {
                                    const docId = href.replace("doc=", "");
                                    const fileName = String(props.children);
                                    const targetDoc = documents.find(d => d.id === docId);
                                    const isRegistered = targetDoc?.isRegisteredToFreee;
                                    return (
                                        <span className="inline-flex items-center gap-1 mx-1">
                                            <button
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    try {
                                                        const res = await fetch(`/api/files/${docId}/link`);
                                                        if (!res.ok) throw new Error("Failed to get link");
                                                        const data = await res.json();
                                                        if (data.link) window.open(data.link, '_blank');
                                                    } catch (err) {
                                                        console.error("Failed to open file:", err);
                                                        alert("ファイルを開けませんでした");
                                                    }
                                                }}
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors border ${isRegistered ? 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'}`}
                                                title="クリックしてファイルを確認"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                {fileName}
                                            </button>
                                            {isRegistered && (
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold ml-1 flex items-center gap-0.5">
                                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                    freee登録済
                                                </span>
                                            )}
                                        </span>
                                    );
                                }
                                return <a {...props} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" />;
                            },
                            input: ({ node, ...props }) => {
                                if (props.type === "checkbox") {
                                    return <InteractiveCheckbox initialChecked={Boolean(props.checked || props.defaultChecked)} />;
                                }
                                return <input {...props} />;
                            }
                        }}
                    >
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
                            return <FreeeRegistrationCard key={idx} initialData={augmentedData} onPreview={loadPreview} />;
                        })}
                    </div>
                )}
                {role === "ai" && folderId && (
                    <div className="w-full flex justify-end mt-2 pt-2 border-t border-gray-100">
                        <button
                            onClick={() => handleSaveToMemo(content)}
                            className="text-[11px] flex items-center gap-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors font-medium border border-transparent hover:border-indigo-100"
                            title="この回答をダッシュボードのメモにピン留めする"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                            メモに保存
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col md:flex-row gap-4">
            {/* Context/Preview Pane (Left side on Desktop, Top on Mobile) */}
            {previewUrl && (
                <div className="md:w-1/2 flex flex-col border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm relative h-[40vh] md:h-full">
                    <div className="bg-gray-100 border-b border-gray-200 p-2 flex justify-between items-center text-sm font-medium text-gray-700">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            プレビュー
                        </div>
                        <button
                            onClick={() => setPreviewUrl(null)}
                            className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    {isPreviewLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    )}
                    <iframe
                        src={previewUrl}
                        className="w-full flex-1 border-none bg-gray-50"
                        title="Document Preview"
                        onLoad={() => setIsPreviewLoading(false)}
                    />
                </div>
            )}

            {/* Chat Pane (Right side on Desktop, Bottom on Mobile) */}
            <div className={`flex flex-col h-full bg-white rounded-xl transition-all duration-300 ${previewUrl ? 'md:w-1/2 border border-gray-200 shadow-sm p-3 md:p-4' : 'w-full'}`}>
                <h2 className={`text-xl md:text-2xl font-bold mb-3 flex items-center justify-between text-gray-800 pb-3 border-b ${previewUrl ? 'text-lg md:text-xl' : ''}`}>
                    <div className="flex items-center">
                        <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        チャット
                    </div>
                    {selectedDocs.length > 0 && (
                        <div className={`flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 ${isLoading ? 'animate-pulse' : ''} ${previewUrl ? 'hidden xl:flex' : ''}`}>
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
                            <p className="text-sm md:text-base text-center px-4">分析対象のソースがありません。<br />ファイルをアップロードしてください。</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            <p className="text-sm md:text-base text-center px-4 bg-gray-50 rounded-full py-2 px-6">全てのソースを把握しています。<br />何でも質問してください。</p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} px-1 md:px-2`}>
                                <div className={`max-w-[90%] md:max-w-[85%] px-4 py-2.5 md:py-3 rounded-2xl text-sm md:text-base shadow-sm ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-gray-100 border border-gray-200 text-gray-800 rounded-tl-sm whitespace-pre-wrap"}`}>
                                    {msg.role === "ai" ? renderMessageContent(msg.content, msg.role) : msg.content}
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
                        placeholder={selectedDocs.length > 0 ? "質問を入力してください..." : "ファイルを選択..."}
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
        </div>
    );
}
