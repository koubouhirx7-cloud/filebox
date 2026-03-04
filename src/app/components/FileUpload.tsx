"use client";
import { useState, useEffect } from "react";

interface FileUploadProps {
    onUploadSuccess?: () => void;
    folders?: any[];
}

export default function FileUpload({ onUploadSuccess, folders = [] }: FileUploadProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string>(folders.length === 1 ? folders[0].id : "null");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analyzeOnUpload, setAnalyzeOnUpload] = useState(false);

    // Sync folder ID when switching views
    useEffect(() => {
        if (folders.length === 1) {
            setSelectedFolderId(folders[0].id);
        }
    }, [folders]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (files.length === 0) return;

        setLoading(true);
        setError(null);

        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        try {
            let successCount = 0;
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const formData = new FormData();
                formData.append("file", f);
                formData.append("folderId", selectedFolderId);
                formData.append("analyzeOnUpload", analyzeOnUpload ? "true" : "false");

                // Update error state temporarily to act as a progress indicator
                setError(`アップロード中... (${i + 1}/${files.length})`);

                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(`ファイル「${f.name}」でエラー: ${data.error || "Upload failed"}`);
                }

                successCount++;

                // Throttling: To prevent Gemini API Rate Limits (15 RPM free tier)
                // Wait 4 seconds between files if we have multiple
                if (analyzeOnUpload && i < files.length - 1) {
                    await sleep(4000);
                }
            }

            setFiles([]);
            setError(null);
            if (onUploadSuccess && successCount > 0) {
                onUploadSuccess();
            }
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
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
