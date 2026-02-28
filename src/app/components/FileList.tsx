"use client";

interface FileListProps {
    documents: any[];
    folders?: any[];
    selectedDocs: Set<string>;
    onToggleSelection: (id: string) => void;
}

export default function FileList({ documents, folders = [], selectedDocs, onToggleSelection }: FileListProps) {
    const rootDocs = documents.filter(d => !d.folderId);

    // Group docs by folderId
    const docsByFolder: Record<string, any[]> = {};
    folders.forEach(f => {
        docsByFolder[f.id] = documents.filter(d => d.folderId === f.id);
    });
    return (
        <div className="w-full flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">ソース ({documents.length})</h3>
                <span className="text-xs text-gray-400">すべて選択</span>
            </div>

            {documents.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 flex flex-col items-center justify-center">
                    <svg className="w-6 h-6 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="text-xs">追加されたソースはありません</p>
                </div>
            ) : (
                <div className="space-y-2 overflow-y-auto pb-4 flex-1 overscroll-contain">
                    {/* Render Root Documents */}
                    {rootDocs.length > 0 && (
                        <div className="space-y-2">
                            {rootDocs.map((doc) => (
                                <DocumentItem
                                    key={doc.id} doc={doc}
                                    isSelected={selectedDocs.has(doc.id)}
                                    onToggle={() => onToggleSelection(doc.id)}
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
                                <div className="space-y-2 pl-2">
                                    {folderDocs.map(doc => (
                                        <DocumentItem
                                            key={doc.id} doc={doc}
                                            isSelected={selectedDocs.has(doc.id)}
                                            onToggle={() => onToggleSelection(doc.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Helper component for identical document rows
function DocumentItem({ doc, isSelected, onToggle }: { doc: any, isSelected: boolean, onToggle: () => void }) {
    return (
        <label
            className={`p-2.5 rounded-lg border flex items-center cursor-pointer transition-all active:scale-[0.98] ${isSelected ? "bg-white border-indigo-300 shadow-sm" : "bg-white border-transparent hover:bg-gray-100 hover:border-gray-200"
                }`}
        >
            <input
                type="checkbox"
                className="w-4 h-4 text-indigo-600 rounded bg-gray-100 border-gray-300 focus:ring-indigo-500 mr-3 accent-indigo-600"
                checked={isSelected}
                onChange={onToggle}
            />
            <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold truncate ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                    {doc.filename}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(doc.createdAt).toLocaleDateString("ja-JP")}
                </p>
            </div>
        </label>
    );
}
