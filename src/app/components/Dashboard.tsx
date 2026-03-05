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
    const [pendingDocs, setPendingDocs] = useState<any[]>([]); // Plan B: Optimistic UI
    const [folders, setFolders] = useState<any[]>([]);
    const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
    const [isReloading, setIsReloading] = useState(false);
    const [reloadTrigger, setReloadTrigger] = useState(0);

    // UI State
    const [activeFolder, setActiveFolder] = useState<any>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const uniqueCategories = Array.from(new Set(folders.map(f => f.category).filter(Boolean))) as string[];
    const filteredFolders = selectedCategory ? folders.filter(f => f.category === selectedCategory) : folders;

    const fetchDocuments = async () => {
        try {
            const res = await fetch(`/api/files?t=${Date.now()}`, { cache: "no-store" });
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
            const res = await fetch(`/api/folders?t=${Date.now()}`, { cache: "no-store" });
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
        if (activeFolder) {
            try {
                await fetch(`/api/chat?folderId=${activeFolder.id}`, { method: "DELETE" });
            } catch (e) {
                console.error("Failed to delete chat history", e);
            }
        }
        await Promise.all([fetchDocuments(), fetchFolders()]);
        setReloadTrigger(prev => prev + 1);
        setIsReloading(false);
    };

    useEffect(() => {
        fetchDocuments();
        fetchFolders();
    }, []);

    // Auto-select all documents in the active folder when opened
    useEffect(() => {
        if (activeFolder) {
            const folderDocs = documents.filter(d => d.folderId === activeFolder.id);
            setSelectedDocs(new Set(folderDocs.map(d => d.id)));
        } else {
            setSelectedDocs(new Set());
        }
    }, [activeFolder, documents]);

    // Keep activeFolder in sync with updated folders data
    useEffect(() => {
        if (activeFolder) {
            const updated = folders.find(f => f.id === activeFolder.id);
            if (updated) {
                // Only update if references are different or data changed
                setActiveFolder(updated);
            }
        }
    }, [folders]);

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

    const handleUploadStart = (fakeDoc: any) => {
        setPendingDocs(prev => [fakeDoc, ...prev]);
    };

    const handleUploadSuccess = async (fakeIdToRemove?: string) => {
        if (fakeIdToRemove) {
            setPendingDocs(prev => prev.filter(p => p.id !== fakeIdToRemove));
        }
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

    const handleUpdateCategory = async (id: string, currentCategory: string | null) => {
        const newCategory = prompt("新しいカテゴリ名を入力してください（空欄で未分類になります）", currentCategory || "");
        if (newCategory === null) return; // Cancelled

        try {
            const res = await fetch(`/api/folders/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category: newCategory })
            });

            if (res.ok) {
                const data = await res.json();
                fetchFolders();
                if (activeFolder && activeFolder.id === id) {
                    setActiveFolder(data.folder);
                }
            } else {
                const data = await res.json();
                alert(`カテゴリの変更に失敗しました: ${data.error}`);
            }
        } catch (error) {
            console.error("Failed to update category", error);
        }
    };

    const handleAddMemo = async (id: string, content: string) => {
        if (!content.trim()) return;
        try {
            const res = await fetch(`/api/folders/${id}/memos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content })
            });
            if (res.ok) fetchFolders();
        } catch (error) { console.error("Failed to add memo", error); }
    };

    const handleDeleteFolder = async (id: string, name: string) => {
        if (!confirm(`本当にノートブック「${name}」を削除してよろしいですか？\n※関連する全ソースやメモも一緒に削除され、元に戻せません。`)) return;
        try {
            const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchFolders();
                setActiveFolder(null);
                setSelectedDocs(new Set());
            } else {
                alert("ノートブックの削除に失敗しました。");
            }
        } catch (error) {
            console.error("Failed to delete folder", error);
            alert("削除中にエラーが発生しました。");
        }
    };

    const handleDeleteMemo = async (memoId: string) => {
        try {
            const res = await fetch(`/api/memos/${memoId}`, { method: "DELETE" });
            if (res.ok) fetchFolders();
        } catch (error) { console.error("Failed to delete memo", error); }
    };

    const handleAddDeadline = async (id: string, deadline: string, title?: string) => {
        if (!deadline) return;
        try {
            const res = await fetch(`/api/folders/${id}/deadlines`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deadline, title })
            });
            if (res.ok) fetchFolders();
        } catch (error) { console.error("Failed to add deadline", error); }
    };

    const handleDeleteDeadline = async (deadlineId: string) => {
        try {
            const res = await fetch(`/api/deadlines/${deadlineId}`, { method: "DELETE" });
            if (res.ok) fetchFolders();
        } catch (error) { console.error("Failed to delete deadline", error); }
    };

    const handleDeleteDocument = async (documentId: string) => {
        if (!confirm("本当にこのソースを削除してよろしいですか？")) return;
        try {
            const res = await fetch(`/api/files/${documentId}`, { method: "DELETE" });
            if (res.ok) {
                // Update local state without waiting for full reload
                const newDocs = documents.filter(d => d.id !== documentId);
                // Cannot directly set documents as it's passed as prop, so trigger a reload
                fetchDocuments();
                fetchFolders();
            } else {
                alert("削除に失敗しました。");
            }
        } catch (error) {
            console.error("Failed to delete document", error);
            alert("削除中にエラーが発生しました。");
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

    // Calculate overall upcoming deadlines
    const upcomingDeadlines = folders
        .flatMap(f => (f.deadlines || []).map((d: any) => ({ ...d, folderName: f.name, folderId: f.id })))
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        .slice(0, 5);

    // HOME VIEW (Notebook Grid)
    if (!activeFolder) {
        return (
            <div className="w-full text-left space-y-8 max-w-[95rem] mx-auto">

                {/* Global Upcoming Deadlines Section */}
                <div className="mb-10 bg-white/60 p-5 rounded-3xl border border-red-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </span>
                        <h2 className="text-xl font-bold text-gray-800">直近の支払い期日</h2>
                    </div>
                    {upcomingDeadlines.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {upcomingDeadlines.map((dl: any) => (
                                <div key={dl.id} onClick={() => setActiveFolder(folders.find(f => f.id === dl.folderId))} className="cursor-pointer bg-white p-3 rounded-2xl border border-red-100 shadow-sm hover:shadow-md hover:border-red-300 transition-all flex flex-col group">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{dl.title}</span>
                                        <span className="text-xs font-medium text-gray-500">{new Date(dl.deadline).toLocaleDateString("ja-JP")}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-800 truncate group-hover:text-red-700 transition-colors">📂 {dl.folderName}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500 italic px-2">直近（設定済み）の支払い期日はありません。</div>
                    )}
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-800">すべてのノートブック</h2>

                    {/* Category Filter */}
                    {uniqueCategories.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === null ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                            >
                                すべて
                            </button>
                            {uniqueCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-400">📝 各ノートブックからカテゴリを設定すると、ここに絞り込みタブが出現します。</div>
                    )}
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
                    {filteredFolders.map((folder, i) => {
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

                                {folder.category && (
                                    <div className="mt-1 flex items-center space-x-1 text-xs font-semibold text-gray-600/80">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                        <span>{folder.category}</span>
                                    </div>
                                )}

                                <div className="mt-auto pt-3">


                                    {/* Previews for deadlines/memos */}
                                    <div className="flex flex-col gap-1 mb-3 max-h-16 overflow-hidden">
                                        {folder.deadlines && folder.deadlines.length > 0 && (
                                            <div className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-md line-clamp-1 font-medium border border-red-200" title={folder.deadlines[0].title}>
                                                🗓 {folder.deadlines[0].title} ({new Date(folder.deadlines[0].deadline).toLocaleDateString("ja-JP")}) {folder.deadlines.length > 1 ? `他${folder.deadlines.length - 1}件` : ''}
                                            </div>
                                        )}
                                        {folder.memos && folder.memos.length > 0 && (
                                            <div className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-md line-clamp-1 border border-amber-200">
                                                📝 {folder.memos[0].content}
                                            </div>
                                        )}
                                    </div>
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
        <div className="w-full flex flex-col md:flex-row gap-6 max-w-[95rem] mx-auto" style={{ height: "calc(100vh - 12rem)" }}>
            {/* Column 1: Metadata (Deadlines, Memos, Category) */}
            <div className="w-full md:w-72 lg:w-80 flex flex-col bg-gray-50/50 rounded-3xl p-5 shadow-sm border border-gray-100 h-[600px] md:h-full overflow-y-auto">
                <button
                    onClick={() => { setActiveFolder(null); setSelectedDocs(new Set()); }}
                    className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors w-fit bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100"
                >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    ノートブック一覧
                </button>

                <div className="flex flex-col items-start gap-4 mb-6 px-1 text-left w-full">
                    <h2 className="font-bold text-2xl text-gray-900 flex items-center leading-tight break-all">
                        <span className="mr-2 text-3xl flex-shrink-0">{getEmojiForTitle(activeFolder.name)}</span>
                        {activeFolder.name}
                    </h2>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100 self-start">
                        <button
                            onClick={() => handleUpdateCategory(activeFolder.id, activeFolder.category)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors flex items-center gap-1 px-3"
                            title="カテゴリを設定"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span className="text-xs font-semibold">{activeFolder.category ? 'カテゴリ変更' : 'カテゴリ追加'}</span>
                        </button>
                        <div className="w-px h-5 bg-gray-200" />
                        <button
                            onClick={() => handleRenameFolder(activeFolder.id, activeFolder.name)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                            title="ノートブック名を変更"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                        <div className="w-px h-5 bg-gray-200" />
                        <button
                            onClick={() => handleDeleteFolder(activeFolder.id, activeFolder.name)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                            title="ノートブックを削除"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Category Badge if exists */}
                {activeFolder.category && (
                    <div className="mb-6 px-1 flex">
                        <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-full flex items-center shadow-sm">
                            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            {activeFolder.category}
                        </span>
                    </div>
                )}

                {/* Payment Memo & Deadline Section */}
                <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 shadow-inner space-y-4">

                    {/* Deadlines List */}
                    <div>
                        <span className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center mb-2">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            支払い期日
                        </span>
                        <div className="space-y-1 mb-2">
                            {activeFolder.deadlines?.map((dl: any) => (
                                <div key={dl.id} className="flex justify-between items-center text-sm bg-white border border-red-200 rounded px-2 py-1 text-red-900 group">
                                    <span className="flex gap-2">
                                        <span className="font-semibold text-xs bg-red-50 text-red-700 px-1.5 rounded">{dl.title}</span>
                                        <span>{new Date(dl.deadline).toLocaleDateString("ja-JP")}</span>
                                    </span>
                                    <button onClick={() => handleDeleteDeadline(dl.id)} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <input
                                type="text"
                                id="new-deadline-title"
                                placeholder="タイトル (例: 月額サーバー代)"
                                className="w-full text-xs bg-white border border-red-200 rounded px-2 py-1.5 text-red-900 focus:outline-none focus:ring-1 focus:ring-red-400 placeholder-red-300"
                            />
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    id="new-deadline"
                                    className="flex-1 text-xs bg-white border border-red-200 rounded px-2 py-1 text-red-900 focus:outline-none focus:ring-1 focus:ring-red-400"
                                />
                                <button
                                    onClick={() => {
                                        const titInput = document.getElementById('new-deadline-title') as HTMLInputElement;
                                        const input = document.getElementById('new-deadline') as HTMLInputElement;
                                        handleAddDeadline(activeFolder.id, input.value, titInput.value);
                                        titInput.value = '';
                                        input.value = '';
                                    }}
                                    className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded font-medium transition-colors border border-red-200"
                                >追加</button>
                            </div>
                        </div>
                    </div>

                    {/* Memos List */}
                    <div className="pt-3 border-t border-amber-200/50">
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center mb-2">
                            <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                            メモ
                        </span>
                        <div className="space-y-1 mb-2">
                            {activeFolder.memos?.map((memo: any) => (
                                <div key={memo.id} className="flex justify-between items-start text-xs bg-white border border-amber-200 rounded px-2 py-1.5 text-amber-900 group">
                                    <span className="whitespace-pre-wrap">{memo.content}</span>
                                    <button onClick={() => handleDeleteMemo(memo.id)} className="text-amber-300 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2">✕</button>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-2">
                            <textarea
                                id="new-memo"
                                placeholder="メモを入力..."
                                className="w-full text-xs bg-white border border-amber-200 rounded px-2 py-1.5 text-amber-900 placeholder-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400 h-10 resize-none shadow-sm"
                            />
                            <button
                                onClick={() => {
                                    const input = document.getElementById('new-memo') as HTMLTextAreaElement;
                                    handleAddMemo(activeFolder.id, input.value);
                                    input.value = '';
                                }}
                                className="self-end text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded font-medium transition-colors border border-amber-200"
                            >追加</button>
                        </div>
                    </div>

                </div>
            </div>

            {/* Column 2: Sources Panel */}
            <div className="w-full md:w-72 lg:w-80 flex flex-col bg-gray-50/50 rounded-3xl p-5 shadow-sm border border-gray-100 h-[600px] md:h-full">

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
                        pendingDocs={pendingDocs.filter(d => d.folderId === activeFolder.id)}
                        folders={[]}
                        selectedDocs={selectedDocs}
                        onToggleSelection={toggleDocumentSelection}
                        onDeleteDocument={handleDeleteDocument}
                    />
                </div>

                <div className="pt-3 border-t border-gray-200 mt-3 flex-shrink-0">
                    <FileUpload
                        onUploadSuccess={handleUploadSuccess}
                        onUploadStart={handleUploadStart}
                        folderId={activeFolder.id}
                        folderCategory={activeFolder.category}
                    />
                </div>
            </div>

            {/* Column 3: Main Area (Chat) */}
            <div className="flex-1 flex flex-col h-[700px] md:h-full bg-white rounded-3xl shadow-sm border border-gray-100 p-2 md:p-4 min-w-[300px]">
                <ChatInterface
                    selectedDocs={Array.from(selectedDocs)}
                    selectedDocNames={Array.from(selectedDocs).map(id => documents.find(d => d.id === id)?.filename || "名称未設定")}
                    folderId={activeFolder.id}
                    reloadTrigger={reloadTrigger}
                />
            </div>
        </div>
    );
}
