"use client";
import { useState, useEffect, useRef } from "react";

interface FileUploadProps {
    onUploadSuccess: (fakeIdToRemove?: string, realDocId?: string, analyze?: boolean) => void;
    onUploadStart?: (fakeDoc: any) => void;
    onTitleGenerated?: (fakeId: string, newTitle: string) => void;
    folderId?: string;
    folderCategory?: string;
}

export default function FileUpload({ onUploadSuccess, onUploadStart, onTitleGenerated, folderId, folderCategory }: FileUploadProps) {
    const [files, setFiles] = useState<File[]>([]);
    // Removed selectedFolderId state as it's now passed via prop folderId
    const [loading, setLoading] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analyzeOnUpload, setAnalyzeOnUpload] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Browser-side image compression for fast upload and AI processing
    const compressImage = async (file: File): Promise<File> => {
        if (!file.type.startsWith('image/')) return file;

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    // 1200x1600 is plenty for Gemini to read A4 text accurately
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1600;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height = Math.round((height *= MAX_WIDTH / width));
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width = Math.round((width *= MAX_HEIGHT / height));
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(file);
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress with JPEG at 0.7 quality
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(newFile);
                        } else {
                            resolve(file);
                        }
                    }, 'image/jpeg', 0.7);
                };
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        });
    };

    const handleFileSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setIsCompressing(true);
        setError("画像を最適化しています...");

        try {
            const newFiles = Array.from(e.target.files);
            const processedFiles: File[] = [];

            for (const file of newFiles) {
                if (file.type.startsWith('image/')) {
                    const compressed = await compressImage(file);
                    processedFiles.push(compressed);
                } else {
                    processedFiles.push(file);
                }
            }

            setFiles(prev => [...prev, ...processedFiles]);
            setError(null);

            // clear the input so the same file/camera action can be triggered again easily
            e.target.value = "";
        } catch (err) {
            console.error("Compression error:", err);
            setError("画像の最適化中にエラーが発生しました");
        } finally {
            setIsCompressing(false);
        }
    };

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

            // Update error state temporarily to act as progress indicator
            setError(`アップロード中... (${i + 1}/${files.length})`);

            // 3. Fire-and-forget the actual heavy upload in the background
            uploadInBackground(fileToUpload, folderId || null, tempId, analyzeOnUpload);
        }

        // 2. Clear UI state immediately so user can upload more things instantly.
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (cameraInputRef.current) cameraInputRef.current.value = "";
        setLoading(false); // Set loading to false after initiating all background uploads
        setError(null); // Clear general error message

        // The onUploadSuccess for the overall component is now handled by individual background uploads
        // If we need a single success callback for all, we'd need to track all background uploads.
        // For now, onUploadSuccess is called per file in uploadInBackground.
    };

    // Direct Resumable Upload
    const uploadInBackground = async (file: File, folderId: string | null, tempId: string, shouldAnalyze: boolean) => {
        try {
            let uploadFilename = file.name;

            // --- Phase 28: Configure Automatic Title For Images ---
            if (file.type.startsWith('image/')) {
                try {
                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });

                    const titleRes = await fetch("/api/generate-title", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ image: base64, mimeType: file.type })
                    });

                    if (titleRes.ok) {
                        const { title } = await titleRes.json();
                        if (title) {
                            const ext = file.name.split('.').pop() || 'jpg';
                            uploadFilename = `${title}.${ext}`;
                            if (onTitleGenerated) {
                                onTitleGenerated(tempId, uploadFilename);
                            }
                        }
                    } else {
                        const errData = await titleRes.json().catch(() => ({}));
                        console.error("AI Title generation HTTP Error:", errData);
                        alert(`タイトル生成に失敗しました: ${errData.details || errData.error || titleRes.statusText}`);
                    }
                } catch (e: any) {
                    console.error("AI Title generation caught exception:", e);
                    alert(`タイトル生成処理でエラーが発生しました: ${e.message || String(e)}`);
                }
            }

            // Step 1: Request upload session URL from our backend
            const initResponse = await fetch("/api/upload/url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: uploadFilename,
                    mimeType: file.type,
                    folderId: folderId,
                })
            });

            if (!initResponse.ok) {
                const initData = await initResponse.json().catch(() => ({}));
                throw new Error(initData.error || "アップロード用URLの取得に失敗しました");
            }

            const { uploadUrl } = await initResponse.json();

            // Step 2: Directly PUT the file to Google Drive
            const uploadResponse = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                    "Content-Type": file.type || "application/octet-stream"
                },
                body: file
            });

            if (!uploadResponse.ok) {
                throw new Error(`Google Driveへの直接アップロードに失敗しました (${uploadResponse.status})`);
            }

            // Google Drive returns the created file metadata including ID
            const driveData = await uploadResponse.json();
            const driveFileId = driveData.id;

            if (!driveFileId) {
                throw new Error("アップロードは成功しましたが、Drive File IDが取得できませんでした");
            }

            // Step 3: Tell our backend to save the metadata to Prisma DB
            const completeResponse = await fetch("/api/upload/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    driveFileId,
                    filename: uploadFilename,
                    mimeType: file.type,
                    folderId: folderId
                })
            });

            const responseData = await completeResponse.json();

            // Successfully uploaded and saved locally
            const realDocId = responseData.document?.id;
            onUploadSuccess(tempId, realDocId, shouldAnalyze);

        } catch (error: any) {
            console.error("Direct Upload Error:", error);
            onUploadSuccess(tempId); // Still call success to clear the pending visual
            alert(`「${file.name}」のアップロードに失敗しました\nエラー内容: ${error.message || "不明なエラー"}`);
        }
    };

    return (
        <div className="w-full">
            <form onSubmit={handleUpload} className="space-y-3">
                <div className="flex gap-2">
                    <label
                        htmlFor="file-upload"
                        className="flex-1 border border-gray-300 rounded-lg py-2 px-2 text-center cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-center text-xs sm:text-sm font-semibold text-gray-700 bg-white shadow-sm"
                    >
                        <svg className="w-4 h-4 mr-1 sm:mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        ソース追加
                    </label>
                    <label
                        htmlFor="camera-upload"
                        className="flex-1 border border-indigo-200 rounded-lg py-2 px-2 text-center cursor-pointer hover:bg-indigo-50 transition-colors flex items-center justify-center text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50/50 shadow-sm"
                    >
                        <svg className="w-4 h-4 mr-1 sm:mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        カメラ撮影
                    </label>
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileSelection}
                        disabled={isCompressing || loading}
                    />
                    <input
                        type="file"
                        id="camera-upload"
                        className="hidden"
                        accept="image/*"
                        capture="environment"
                        ref={cameraInputRef}
                        onChange={handleFileSelection}
                        disabled={isCompressing || loading}
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
