import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import { prisma } from "@/app/lib/prisma";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";

export async function POST(request: NextRequest) {
    let tempFilePath = "";

    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
        }

        const account = await prisma.account.findFirst({
            where: { userId: session.user.id, provider: "google" },
            include: { user: true }
        });

        if (!account || !account.access_token) {
            return NextResponse.json({ error: "Google Drive permission not granted. Please re-login." }, { status: 401 });
        }

        // 2. Extract file and optional folderId from FormData
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        let folderIdString = formData.get("folderId") as string | null;
        let analyzeOnUploadString = formData.get("analyzeOnUpload") as string | null;
        const analyzeOnUpload = analyzeOnUploadString === "true";

        // Ensure empty string is treated as null
        if (folderIdString === "null" || folderIdString === "") {
            folderIdString = null;
        }

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Server configuration error: Gemini API Key missing" }, { status: 500 });
        }

        // 3. Save file temporarily
        const buffer = Buffer.from(await file.arrayBuffer());
        // Sanitize filename and create unique temp path
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        tempFilePath = path.join(os.tmpdir(), `${crypto.randomUUID()}-${sanitizedFileName}`);
        await fs.writeFile(tempFilePath, buffer);

        // 4. Upload to Google Drive using accessToken
        console.log("Uploading to Google Drive...");
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
        });
        const drive = google.drive({ version: "v3", auth: oauth2Client });

        let targetDriveFolderId = "";

        if (folderIdString) {
            // Find the precise drive Folder ID given the SQLite folder ID
            const dbFolder = await prisma.folder.findUnique({
                where: { id: folderIdString }
            });
            if (dbFolder) {
                targetDriveFolderId = dbFolder.driveFolderId;
            }
        }

        // If no targetDriveFolderId is set, it means we are uploading to the root.
        if (!targetDriveFolderId) {
            targetDriveFolderId = account.user.rootDriveFolderId || "";

            // If not cached, find or create "File Box" root folder
            if (!targetDriveFolderId) {
                const folderName = "ファイルボックス";
                try {
                    const folderQuery = await drive.files.list({
                        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
                        fields: "files(id, name)",
                        spaces: "drive",
                    });

                    if (folderQuery.data.files && folderQuery.data.files.length > 0) {
                        targetDriveFolderId = folderQuery.data.files[0].id!;
                    } else {
                        console.log(`Creating folder: ${folderName}`);
                        const folderResponse = await drive.files.create({
                            requestBody: {
                                name: folderName,
                                mimeType: "application/vnd.google-apps.folder",
                            },
                            fields: "id",
                        });
                        targetDriveFolderId = folderResponse.data.id!;
                    }

                    // Cache it for next time
                    if (targetDriveFolderId) {
                        await prisma.user.update({
                            where: { id: session.user.id },
                            data: { rootDriveFolderId: targetDriveFolderId }
                        });
                    }
                } catch (folderError) {
                    console.error("Error finding or creating folder:", folderError);
                    throw new Error("Failed to configure Google Drive folder.");
                }
            }
        }

        const driveResponse = await drive.files.create({
            requestBody: {
                name: file.name,
                parents: [targetDriveFolderId], // Save inside "File Box" folder or specific subfolder
            },
            media: {
                mimeType: file.type,
                body: Readable.from(buffer),
            },
            fields: "id",
        });

        const driveFileId = driveResponse.data.id;
        if (!driveFileId) {
            throw new Error("Failed to get Google Drive file ID after upload.");
        }

        console.log("Saving document metadata to local DB...");
        // 5. Save Document metadata manually to SQLite through Prisma
        const document = await prisma.document.create({
            data: {
                filename: file.name,
                driveFileId: driveFileId,
                mimeType: file.type,
                userId: session.user.id,
                folderId: folderIdString, // Optional subfolder ID
            },
        });

        if (!analyzeOnUpload) {
            console.log("Skipping AI analysis as requested by user.");
            await fs.unlink(tempFilePath);
            tempFilePath = "";
            return NextResponse.json({ summary: "AI要約はスキップされました。個別ファイルを選択してチャットで質問できます。", documentId: document.id });
        }

        // 6. Initialize Gemini SDK
        const ai = new GoogleGenAI({ apiKey });

        console.log("Uploading file to Gemini File API:", tempFilePath);

        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // 7. Upload to Gemini File API
        const cleanMimeType = file.type ? file.type.split(';')[0].trim() : "text/plain";
        let uploadResult;
        let uploadRetries = 3;
        while (uploadRetries > 0) {
            try {
                uploadResult = await ai.files.upload({
                    file: tempFilePath,
                    config: {
                        mimeType: cleanMimeType,
                        displayName: `file-${crypto.randomUUID()}`
                    }
                });
                break;
            } catch (uploadError: any) {
                if (uploadError.status === 429 || (uploadError.message && uploadError.message.includes('429'))) {
                    console.warn(`Rate limit hit during upload. Retries left: ${uploadRetries - 1}. Sleeping for 15s...`);
                    uploadRetries--;
                    if (uploadRetries === 0) throw uploadError;
                    await sleep(15000);
                } else {
                    throw uploadError;
                }
            }
        }

        if (!uploadResult) throw new Error("Upload failed completely.");

        console.log("File uploaded successfully. Generating content...");

        // 6. Generate content using the uploaded file
        let result;
        let generateRetries = 3;
        while (generateRetries > 0) {
            try {
                result = await ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: [
                        {
                            fileData: {
                                mimeType: uploadResult.mimeType || cleanMimeType,
                                fileUri: uploadResult.uri,
                            }
                        },
                        "このドキュメントの内容を日本語で分かりやすく要約してください。",
                    ],
                });
                break;
            } catch (generateError: any) {
                if (generateError.status === 429 || (generateError.message && generateError.message.includes('429'))) {
                    console.warn(`Rate limit hit during generation. Retries left: ${generateRetries - 1}. Sleeping for 15s...`);
                    generateRetries--;
                    if (generateRetries === 0) throw generateError;
                    await sleep(15000);
                } else {
                    throw generateError;
                }
            }
        }

        if (!result) throw new Error("Generation failed completely.");

        // 9. Clean up temp file
        await fs.unlink(tempFilePath);
        tempFilePath = ""; // clear so finally block doesn't try again

        return NextResponse.json({ summary: result.text, documentId: document.id });
    } catch (error: any) {
        console.error("Error processing file:", error);

        // Attempt cleanup on error
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
            } catch (cleanupError) {
                console.error("Failed to clean up temp file:", cleanupError);
            }
        }

        return NextResponse.json({ error: error.message || "Failed to process file with AI" }, { status: 500 });
    }
}
