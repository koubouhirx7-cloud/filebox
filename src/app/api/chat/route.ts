import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

export async function POST(request: NextRequest) {
    const tempFiles: string[] = [];
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

        const { message, documentIds } = await request.json();

        if (!message || !documentIds || documentIds.length === 0) {
            return NextResponse.json({ error: "Missing message or documents" }, { status: 400 });
        }

        // 1. Fetch DB records
        const documents = await prisma.document.findMany({
            where: {
                id: { in: documentIds },
                userId: session.user.id,
            },
        });

        if (documents.length === 0) {
            return NextResponse.json({ error: "No valid documents found." }, { status: 404 });
        }

        // 2. Init Google Drive
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: account.access_token });
        const drive = google.drive({ version: "v3", auth: oauth2Client });

        // 3. Init Gemini
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const geminiContents: any[] = [];

        // 4. Download files from Drive and Upload to Gemini
        for (const doc of documents) {
            const tempPath = path.join(os.tmpdir(), `${crypto.randomUUID()}-${doc.filename}`);
            tempFiles.push(tempPath);

            // Download from Google Drive
            const response = await drive.files.get(
                { fileId: doc.driveFileId, alt: "media" },
                { responseType: "arraybuffer" }
            );

            const buffer = Buffer.from(response.data as ArrayBuffer);
            await fs.writeFile(tempPath, buffer);

            // Upload to Gemini
            console.log(`Uploading ${doc.filename} to Gemini...`);
            const uploadResult = await ai.files.upload({
                file: tempPath,
                config: {
                    mimeType: doc.mimeType,
                },
            });

            geminiContents.push({
                fileData: {
                    mimeType: doc.mimeType,
                    fileUri: uploadResult.uri,
                }
            });
        }

        // Add user's text message
        geminiContents.push(message);

        // 5. Generate Content
        console.log("Generating chat response...");
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: geminiContents,
        });

        // Clean up local temp files
        for (const tFile of tempFiles) {
            try { await fs.unlink(tFile); } catch (e) { }
        }

        return NextResponse.json({ reply: result.text });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        for (const tFile of tempFiles) {
            try { await fs.unlink(tFile); } catch (e) { }
        }
        return NextResponse.json({ error: error.message || "Failed to process chat" }, { status: 500 });
    }
}
