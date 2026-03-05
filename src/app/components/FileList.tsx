"use client";
import { useState } from "react";

interface FileListProps {
    documents: any[];
    folders?: any[];
    selectedDocs: Set<string>;
    onToggleSelection: (id: string) => void;
    onDeleteDocument?: (id: string) => void;
}

export default function FileList({ documents, folders = [], selectedDocs, onToggleSelection, onDeleteDocument }: FileListProps) {
    const rootDocs = documents.filter(d => !d.folderId);

    // State for bulk preview modal
    const [previewDocs, setPreviewDocs] = useState<any[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);

    const openBulkPreview = () => {
        const docsToPreview = documents.filter(d => selectedDocs.has(d.id));
        if (docsToPreview.length > 0) {
            setPreviewDocs(docsToPreview);
            setPreviewIndex(0);
        }
    };

    const closeBulkPreview = () => {
        setPreviewDocs([]);
    };

    // Group docs by folderId
    const docsByFolder: Record<string, any[]> = {};
    folders.forEach(f => {
        docsByFolder[f.id] = documents.filter(d => d.folderId === f.id);
    });
    return (
        <div className="w-full flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">ソース ({documents.length})</h3>
                <div className="flex gap-2">
                    {selectedDocs.size > 0 && (
                        <button
                            onClick={openBulkPreview}
                            className="text-xs flex items-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                        >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            選択をプレビュー
                        </button>
                    )}
                    <span className="text-xs text-gray-400 self-center">すべて選択</span>
                </div>
            </div>

            {documents.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 flex flex-col items-center justify-center">
                    <svg className="w-6 h-6 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="text-xs">追加されたソースはありません</p>
                </div>
            ) : (
                <div className="space-y-2 overflow-y-auto pb-4 flex-1 overscroll-contain">
                    {folders.length === 0 ? (
                        <div className="flex flex-col gap-4">
                            {Object.entries(
                                documents.reduce((acc: Record<string, any[]>, doc) => {
                                    const date = new Date(doc.createdAt);
                                    const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;
                                    if (!acc[monthKey]) acc[monthKey] = [];
                                    acc[monthKey].push(doc);
                                    return acc;
                                }, {})
                            ).map(([month, docs]: [string, any]) => (
                                <div key={month}>
                                    <div className="text-xs font-bold text-gray-500 mb-2 border-b pb-1">{month}</div>
                                    <div className="flex flex-col gap-2 pl-1">
                                        {docs.map((doc: any) => (
                                            <DocumentItem
                                                key={doc.id} doc={doc}
                                                isSelected={selectedDocs.has(doc.id)}
                                                onToggle={() => onToggleSelection(doc.id)}
                                                onDelete={() => onDeleteDocument && onDeleteDocument(doc.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Render Root Documents */}
                            {rootDocs.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {rootDocs.map((doc) => (
                                        <DocumentItem
                                            key={doc.id} doc={doc}
                                            isSelected={selectedDocs.has(doc.id)}
                                            onToggle={() => onToggleSelection(doc.id)}
                                            onDelete={() => onDeleteDocument && onDeleteDocument(doc.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Render Folders and their Documents */}
                            {folders.map((folder) => {
                                const folderDocs = docsByFolder[folder.id] || [];
                                if (folderDocs.length === 0) return null; // Only show folders with files in this simple view

                                return (
                                    <div key={folder.id} className="border rounded-xl p-3 bg-gray-50 border-gray-200">
                                        <div className="flex items-center text-gray-700 font-semibold mb-2">
                                            <svg className="w-5 h-5 mr-2 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>
                                            {folder.name}
                                            <span className="ml-2 text-xs font-normal text-gray-400">({folderDocs.length})</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                                            {folderDocs.map(doc => (
                                                <DocumentItem
                                                    key={doc.id} doc={doc}
                                                    isSelected={selectedDocs.has(doc.id)}
                                                    onToggle={() => onToggleSelection(doc.id)}
                                                    onDelete={() => onDeleteDocument && onDeleteDocument(doc.id)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )}

            {/* Bulk Preview Modal */}
            {previewDocs.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-8">
                    <div className="bg-white w-full max-w-6xl h-full flex flex-col rounded-2xl shadow-2xl overflow-hidden relative">
                        {/* Header */}
                        <div className="flex justify-between items-center px-4 py-3 border-b bg-gray-50 shrink-0">
                            <div className="flex items-center">
                                <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-md mr-3">
                                    {previewIndex + 1} / {previewDocs.length}
                                </span>
                                <h3 className="font-bold text-gray-800 truncate max-w-sm sm:max-w-md">
                                    {previewDocs[previewIndex].filename}
                                </h3>
                            </div>
                            <button onClick={closeBulkPreview} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-gray-100 relative">
                            {/* Previous Button */}
                            <button
                                onClick={() => setPreviewIndex(prev => Math.max(0, prev - 1))}
                                disabled={previewIndex === 0}
                                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 hover:bg-white text-gray-800 rounded-full shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>

                            <iframe
                                src={`https://drive.google.com/file/d/${previewDocs[previewIndex].driveFileId}/preview`}
                                className="w-full h-full border-0"
                                allow="autoplay"
                            ></iframe>

                            {/* Next Button */}
                            <button
                                onClick={() => setPreviewIndex(prev => Math.min(previewDocs.length - 1, prev + 1))}
                                disabled={previewIndex === previewDocs.length - 1}
                                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 hover:bg-white text-gray-800 rounded-full shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>

                        {/* Thumbnail Footer */}
                        <div className="h-20 bg-gray-800 flex items-center px-4 overflow-x-auto gap-2 shrink-0 no-scrollbar">
                            {previewDocs.map((doc, idx) => (
                                <button
                                    key={doc.id}
                                    onClick={() => setPreviewIndex(idx)}
                                    className={`h-14 min-w-[100px] border-2 rounded-lg px-2 flex items-center justify-center text-xs truncate transition-all ${idx === previewIndex ? 'border-indigo-400 bg-gray-700 text-white' : 'border-transparent bg-gray-900 text-gray-400 hover:bg-gray-700'}`}
                                    title={doc.filename}
                                >
                                    <span className="truncate w-full text-center">{doc.filename}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper component for identical document rows
function DocumentItem({ doc, isSelected, onToggle, onDelete }: { doc: any, isSelected: boolean, onToggle: () => void, onDelete?: () => void }) {
    const [isViewing, setIsViewing] = useState(false);

    const handleView = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isViewing) return;

        setIsViewing(true);
        try {
            const res = await fetch(`/api/files/${doc.id}/link`);
            if (res.ok) {
                const data = await res.json();
                if (data.link) {
                    window.open(data.link, '_blank');
                } else {
                    alert("プレビューリンクが見つかりませんでした。");
                }
            } else {
                const errorData = await res.json().catch(() => ({}));
                alert(errorData.error || "プレビューリンクの取得に失敗しました。");
                if (res.status === 404) {
                    window.location.reload(); // Reload to clear the zombie file from the UI
                }
            }
        } catch (error) {
            console.error("View Error:", error);
            alert("エラーが発生しました。");
        } finally {
            setIsViewing(false);
        }
    };

    return (
        <div className={`p-2.5 rounded-lg border flex items-center group transition-all ${isSelected ? "bg-white border-indigo-300 shadow-sm" : "bg-white border-transparent hover:bg-gray-100 hover:border-gray-200"}`}>
            <label className="flex items-center flex-1 cursor-pointer min-w-0">
                <input
                    type="checkbox"
                    className="w-4 h-4 text-indigo-600 rounded bg-gray-100 border-gray-300 focus:ring-indigo-500 mr-3 accent-indigo-600 flex-shrink-0"
                    checked={isSelected}
                    onChange={onToggle}
                />
                <div className="flex-1 min-w-0 pr-2">
                    <button
                        onClick={handleView}
                        disabled={isViewing}
                        className={`text-xs font-semibold truncate hover:underline text-left block w-full ${isSelected ? 'text-indigo-900' : 'text-gray-700'} ${isViewing ? 'opacity-50 cursor-wait' : ''}`}
                        title="クリックしてプレビューを開く"
                    >
                        {isViewing ? 'リンク取得中...' : doc.filename}
                    </button>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(doc.createdAt).toLocaleDateString("ja-JP")}
                    </p>
                </div>
            </label>
            {onDelete && (
                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all flex-shrink-0"
                    title="ソースを削除"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            )}
        </div>
    );
}
