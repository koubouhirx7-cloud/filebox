"use client";
import { useState, useEffect } from "react";
import FileUpload from "./FileUpload";
import FileList from "./FileList";
import ChatInterface from "./ChatInterface";
import { getEmojiForTitle } from "../lib/emojiHelper";

const PASTEL_COLORS = [
    "#e0f2fe", // blue
    "#fce7f3", // pink
    "#dcfce7", // green
    "#fef08a", // yellow
    "#f3e8ff", // purple
    "#ffedd5", // orange
];

export default function Dashboard() {
    const [documents, setDocuments] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
    const [isReloading, setIsReloading] = useState(false);

    // UI State
    const [activeFolder, setActiveFolder] = useState<any>(null);

    const fetchDocuments = async () => {
        try {
            const res = await fetch("/api/files");
            if (res.ok) {
                const data = await res.json();
                setDocuments(data.documents || []);
            }
        } catch (e) {
            console.error("Failed to fetch documents", e);
        }
    };

    const fetchFolders = async () => {
        try {
            const res = await fetch("/api/folders");
            if (res.ok) {
                const resData = await res.json();
                setFolders(resData.folders || []);
            }
        } catch (e) {
            console.error("Failed to fetch folders", e);
        }
    };

    const handleReload = async () => {
        setIsReloading(true);
        await Promise.all([fetchDocuments(), fetchFolders()]);
        setIsReloading(false);
    };

    useEffect(() => {
        fetchDocuments();
        fetchFolders();
    }, []);

    // Auto-select all documents in active folder
    useEffect(() => {
        if (activeFolder) {
            const folderDocs = documents.filter(d => d.folderId === activeFolder.id);
            setSelectedDocs(new Set(folderDocs.map(d => d.id)));
        } else {
            setSelectedDocs(new Set());
        }
    }, [activeFolder, documents]);

    const handleCreateFolder = async (name: string) => {
        if (!name.trim()) return;
        try {
            const res = await fetch("/api/folders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folderName: name })
            });
            const data = await res.json();
            if (res.ok) {
                fetchFolders();
            } else {
                alert(`フォルダの作成に失敗しました: ${data.error || "Google Driveの認証期限切れ等のエラー"}\n一度ログアウトして再度ログインをお試しください。`);
            }
        } catch (error: any) {
            console.error("Failed to create folder", error);
            alert("ネットワークエラーが発生しました。");
        }
    };

    const handleUploadSuccess = async () => {
        await fetchDocuments();
    };

    const handleRenameFolder = async (id: string, currentName: string) => {
        const newName = prompt("新しいノートブック名を入力してください", currentName);
        if (!newName || newName.trim() === "" || newName === currentName) return;

        try {
            const res = await fetch(`/api/folders/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folderName: newName })
            });

            if (res.ok) {
                const data = await res.json();
                fetchFolders();
                if (activeFolder && activeFolder.id === id) {
                    setActiveFolder(data.folder);
                }
            } else {
                const data = await res.json();
                alert(`名前の変更に失敗しました: ${data.error}`);
            }
        } catch (error) {
            console.error("Failed to rename folder", error);
            alert("ネットワークエラーが発生しました。");
        }
    };

    const handleUpdateFolderMeta = async (id: string, updates: { memo?: string, paymentDeadline?: string | null }) => {
        try {
            const res = await fetch(`/api/folders/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });

            if (res.ok) {
                const data = await res.json();
                fetchFolders();
                if (activeFolder && activeFolder.id === id) {
                    setActiveFolder(data.folder);
                }
            }
        } catch (error) {
            console.error("Failed to update folder meta", error);
        }
    };

    const toggleDocumentSelection = (id: string) => {
        const newSelected = new Set(selectedDocs);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedDocs(newSelected);
    };

    // HOME VIEW (Notebook Grid)
    if (!activeFolder) {
        return (
            <div className="w-full text-left space-y-8 max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800">最近のノートブック</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {/* Create New Notebook Card */}
                    <div
                        onClick={() => {
                            const name = prompt("新しいノートブックの名前を入力してください", "未設定のノートブック");
                            if (name) handleCreateFolder(name);
                        }}
                        className="h-56 bg-white border border-gray-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <span className="font-semibold text-gray-700">ノートブックを新規作成</span>
                    </div>

                    {/* Folder Cards */}
                    {folders.map((folder, i) => {
                        const count = documents.filter(d => d.folderId === folder.id).length;
                        const bgColor = PASTEL_COLORS[i % PASTEL_COLORS.length];

                        return (
                            <div
                                key={folder.id}
                                onClick={() => setActiveFolder(folder)}
                                className="h-56 rounded-3xl p-6 flex flex-col cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-lg shadow-sm group relative overflow-hidden"
                                style={{ backgroundColor: bgColor }}
                            >
                                <div className="absolute top-4 right-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRenameFolder(folder.id, folder.name);
                                        }}
                                        className="p-2 hover:bg-white/80 rounded-full text-indigo-500 hover:text-indigo-700 transition"
                                        title="名前を変更"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="text-4xl mb-3 mt-1 select-none">
                                    {getEmojiForTitle(folder.name)}
                                </div>

                                <h3 className="font-bold text-xl text-gray-900 mt-2 line-clamp-2 leading-tight">{folder.name}</h3>

                                <div className="mt-auto text-sm font-medium text-gray-600 flex items-center bg-white/50 w-fit px-3 py-1 rounded-full">
                                    {count} 個のソース
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // WORKSPACE VIEW (Chat & Sources)
    return (
        <div className="w-full flex flex-col md:flex-row gap-6 max-w-7xl mx-auto" style={{ height: "calc(100vh - 12rem)" }}>
            {/* Left Sidebar (Sources) */}
            <div className="w-full md:w-80 lg:w-96 flex flex-col bg-gray-50/50 rounded-3xl p-5 shadow-sm border border-gray-100 h-[600px] md:h-full">
                <button
                    onClick={() => { setActiveFolder(null); setSelectedDocs(new Set()); }}
                    className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors w-fit bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100"
                >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    ノートブック一覧
                </button>

                <div className="flex items-center justify-between mb-6 px-1 group text-left">
                    <h2 className="font-bold text-2xl text-gray-900 flex items-center leading-tight">
                        <span className="mr-2 text-3xl flex-shrink-0">{getEmojiForTitle(activeFolder.name)}</span>
                        {activeFolder.name}
                    </h2>
                    <button
                        onClick={() => handleRenameFolder(activeFolder.id, activeFolder.name)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-full transition-all"
                        title="ノートブック名を変更"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>

                {/* Payment Memo Section */}
                <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 shadow-inner space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center">
                            <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                            支払い期日メモ
                        </span>
                    </div>

                    <div className="space-y-2 text-left">
                        <input
                            type="date"
                            value={activeFolder.paymentDeadline ? new Date(activeFolder.paymentDeadline).toISOString().split('T')[0] : ""}
                            onChange={(e) => handleUpdateFolderMeta(activeFolder.id, { paymentDeadline: e.target.value || null })}
                            className="text-sm bg-white border border-amber-200 rounded-lg px-2 py-1 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-400 w-full"
                        />
                        <textarea
                            placeholder="メモを入力..."
                            value={activeFolder.memo || ""}
                            onChange={(e) => handleUpdateFolderMeta(activeFolder.id, { memo: e.target.value })}
                            className="w-full text-sm bg-white border border-amber-200 rounded-lg px-3 py-2 text-amber-900 placeholder-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400 h-20 resize-none shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ソース一覧</h3>
                    <button
                        onClick={handleReload}
                        disabled={isReloading}
                        className="flex items-center text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors disabled:opacity-50"
                        title="最新の情報に更新"
                    >
                        <svg className={`w-3.5 h-3.5 mr-1 ${isReloading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        {isReloading ? '更新中...' : 'リロード'}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                    <FileList
                        documents={documents.filter(d => d.folderId === activeFolder.id)}
                        folders={[]}
                        selectedDocs={selectedDocs}
                        onToggleSelection={toggleDocumentSelection}
                    />
                </div>

                <div className="pt-3 border-t border-gray-200 mt-3 flex-shrink-0">
                    <FileUpload
                        onUploadSuccess={handleUploadSuccess}
                        folders={[activeFolder]}
                    />
                </div>
            </div>

            {/* Right Main Area (Chat) */}
            <div className="flex-1 flex flex-col h-[700px] md:h-full bg-white rounded-3xl shadow-sm border border-gray-100 p-2 md:p-4">
                <ChatInterface
                    selectedDocs={Array.from(selectedDocs)}
                    folderId={activeFolder.id}
                />
            </div>
        </div>
    );
}
