"use client";
import { useState, useEffect } from "react";
import FileUpload from "./FileUpload";
import FileList from "./FileList";
import ChatInterface from "./ChatInterface";

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

    useEffect(() => {
        fetchDocuments();
        fetchFolders();
    }, []);

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

    const handleUploadSuccess = () => {
        fetchDocuments();
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
                                    <svg className="w-5 h-5 bg-white rounded-full p-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                </div>

                                <div className="w-10 h-10 mb-2">
                                    <svg className="w-full h-full text-gray-700 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
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

                <h2 className="font-bold text-2xl text-gray-900 mb-6 px-1">{activeFolder.name}</h2>

                <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                    <FileList
                        documents={documents.filter(d => d.folderId === activeFolder.id)}
                        folders={[]} // Workspace shows files only for this folder
                        selectedDocs={selectedDocs}
                        onToggleSelection={toggleDocumentSelection}
                    />

                    <div className="pt-4 border-t border-gray-200">
                        <FileUpload
                            onUploadSuccess={handleUploadSuccess}
                            folders={[activeFolder]} // Only pass active folder to force uploading here
                        />
                    </div>
                </div>
            </div>

            {/* Right Main Area (Chat) */}
            <div className="flex-1 flex flex-col h-[600px] md:h-full bg-white rounded-3xl shadow-sm border border-gray-100 p-2 md:p-4">
                <ChatInterface selectedDocs={Array.from(selectedDocs)} />
            </div>
        </div>
    );
}
