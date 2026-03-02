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
            where: { userId: session.user.id, provider: "google" }
        });

        if (!account || !account.access_token) {
            return NextResponse.json({ error: "Google Drive permission not granted. Please re-login." }, { status: 401 });
        }

        // 2. Extract file and optional folderId from FormData
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        let folderIdString = formData.get("folderId") as string | null;

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
            refresh_token: account.refresh_token
        });
        const drive = google.drive({ version: "v3", auth: oauth2Client });

        // Find or create "File Box" root folder
        const folderName = "File Box";
        let rootFolderId = "";

        try {
            const folderQuery = await drive.files.list({
                q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
                fields: "files(id, name)",
                spaces: "drive",
            });

            if (folderQuery.data.files && folderQuery.data.files.length > 0) {
                rootFolderId = folderQuery.data.files[0].id!;
            } else {
                console.log(`Creating folder: ${folderName}`);
                const folderResponse = await drive.files.create({
                    requestBody: {
                        name: folderName,
                        mimeType: "application/vnd.google-apps.folder",
                    },
                    fields: "id",
                });
                rootFolderId = folderResponse.data.id!;
            }
        } catch (folderError) {
            console.error("Error finding or creating folder:", folderError);
            throw new Error("Failed to configure Google Drive folder.");
        }

        let targetDriveFolderId = rootFolderId;

        if (folderIdString) {
            // Find the precise drive Folder ID given the SQLite folder ID
            const dbFolder = await prisma.folder.findUnique({
                where: { id: folderIdString }
            });
            if (dbFolder) {
                targetDriveFolderId = dbFolder.driveFolderId;
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

        // 6. Initialize Gemini SDK
        const ai = new GoogleGenAI({ apiKey });

        console.log("Uploading file to Gemini File API:", tempFilePath);

        // 7. Upload to Gemini File API
        const cleanMimeType = file.type ? file.type.split(';')[0].trim() : "text/plain";
        const uploadResult = await ai.files.upload({
            file: tempFilePath,
            config: {
                mimeType: cleanMimeType,
                displayName: `file-${crypto.randomUUID()}`
            }
        });

        console.log("File uploaded successfully. Generating content...");

        // 6. Generate content using the uploaded file
        const result = await ai.models.generateContent({
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
