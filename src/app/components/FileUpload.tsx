"use client";
import { useState, useEffect, useRef } from "react";

interface FileUploadProps {
    onUploadSuccess: (fakeIdToRemove?: string) => void;
    onUploadStart?: (fakeDoc: any) => void;
    folderId?: string;
    folderCategory?: string;
}

export default function FileUpload({ onUploadSuccess, onUploadStart, folderId, folderCategory }: FileUploadProps) {
    const [files, setFiles] = useState<File[]>([]);
    // Removed selectedFolderId state as it's now passed via prop folderId
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analyzeOnUpload, setAnalyzeOnUpload] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Removed useEffect for syncing folder ID as folders prop is removed

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (files.length === 0) return;

        setLoading(true);
        setError(null);

        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        let successCount = 0;
        const tempIds: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const fileToUpload = files[i];
            const tempId = `temp-${Date.now()}-${i}`; // Unique temp ID for each file

            // 1. Immediately create a "Pending (Fake)" document for Optimistic UI
            const fakeDoc = {
                id: tempId,
                filename: fileToUpload.name,
                mimeType: fileToUpload.type,
                folderId: folderId, // Use prop folderId
                createdAt: new Date().toISOString(),
                isPending: true,
            };

            if (onUploadStart) {
                onUploadStart(fakeDoc);
            }
            tempIds.push(tempId);

            const formData = new FormData();
            formData.append("file", fileToUpload);
            formData.append("folderId", folderId || "null"); // Use prop folderId, default to "null" if not provided
            formData.append("analyzeOnUpload", analyzeOnUpload ? "true" : "false");

            // Update error state temporarily to act as a progress indicator
            setError(`アップロード中... (${i + 1}/${files.length})`);

            // 3. Fire-and-forget the actual heavy upload in the background
            // We'll handle success/failure for each file individually
            uploadInBackground(fileToUpload, formData, tempId);

            // Throttling: To prevent Gemini API Rate Limits (20 RPM free tier)
            // Wait 7 seconds between files if we have multiple and analyzeOnUpload is true
            if (analyzeOnUpload && i < files.length - 1) {
                await sleep(7000);
            }
        }

        // 2. Clear UI state immediately so user can upload more things instantly.
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setLoading(false); // Set loading to false after initiating all background uploads
        setError(null); // Clear general error message

        // The onUploadSuccess for the overall component is now handled by individual background uploads
        // If we need a single success callback for all, we'd need to track all background uploads.
        // For now, onUploadSuccess is called per file in uploadInBackground.
    };

    const uploadInBackground = async (file: File, formData: FormData, tempId: string) => {
        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                // Background upload done! Tell Dashboard to replace tempId with real data.
                onUploadSuccess(tempId);
            } else {
                const data = await response.json().catch(() => ({}));
                // If it failed, we still call onUploadSuccess with tempId to remove the pending visual
                // and potentially display an error state for that specific item in the parent component.
                onUploadSuccess(tempId);
                const errorMsg = data.error || '不明なエラー';
                console.error(`ファイル「${file.name}」のアップロード失敗: ${errorMsg}`);
                alert(`アップロード失敗: ${errorMsg}`);
            }
        } catch (error: any) {
            console.error("Upload Error:", error);
            // If it failed, we still call onUploadSuccess with tempId to remove the pending visual
            onUploadSuccess(tempId);
            alert(`「${file.name}」の通信エラー: ${error.message || 'サーバーに接続できません'}`);
        }
    };

    return (
        <div className="w-full">
            <form onSubmit={handleUpload} className="space-y-3">
                <div className="flex items-center justify-between">
                    <label
                        htmlFor="file-upload"
                        className="flex-1 border border-gray-300 rounded-full py-2 px-4 text-center cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-center text-sm font-semibold text-gray-700 bg-white shadow-sm"
                    >
                        <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        ソースを追加
                    </label>
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        multiple
                        onChange={(e) => {
                            if (e.target.files) {
                                setFiles(Array.from(e.target.files));
                            }
                        }}
                    />
                </div>

                {error && <p className="text-red-500 text-xs text-center">{error}</p>}

                {files.length > 0 && (
                    <div className="text-xs text-gray-500 bg-white border border-gray-100 p-3 rounded-xl shadow-sm">
                        <p className="font-semibold text-gray-700 mb-2 truncate">
                            {files.length} 個のファイルを選択中
                        </p>
                        <ul className="list-disc pl-4 max-h-20 overflow-y-auto space-y-1 mb-3">
                            {files.map((f, i) => (
                                <li key={i} className="truncate" title={f.name}>{f.name}</li>
                            ))}
                        </ul>

                        <div className="flex items-center justify-between mb-4 mt-2 px-1">
                            <label className="text-gray-700 text-xs font-medium flex items-start cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={analyzeOnUpload}
                                    onChange={(e) => setAnalyzeOnUpload(e.target.checked)}
                                    className="mt-0.5 mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                                    disabled={loading}
                                />
                                <span className="flex flex-col">
                                    <span className="group-hover:text-indigo-600 transition-colors">同時にAIでファイル内容を要約・解析する</span>
                                    <span className="text-[10px] text-gray-400 font-normal leading-tight mt-1">※オフにするとアップロードが瞬時に完了します。チャット内で後から解析可能です。</span>
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-2 px-4 rounded-full text-white font-bold transition-all text-sm
                    ${loading ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 shadow-sm"}`}
                        >
                            {loading ? "アップロード中..." : "アップロードを実行"}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
