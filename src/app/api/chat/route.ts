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

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const folderId = searchParams.get("folderId");

        if (!folderId) {
            return NextResponse.json({ error: "Missing folderId" }, { status: 400 });
        }

        const messages = await prisma.message.findMany({
            where: {
                folderId,
                userId: session.user.id
            },
            orderBy: { createdAt: "asc" }
        });

        return NextResponse.json({ messages });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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

        const { message, documentIds, folderId, isInitialRequest } = await request.json();

        if (!message || !documentIds || documentIds.length === 0 || !folderId) {
            return NextResponse.json({ error: "Missing message, documents, or folderId" }, { status: 400 });
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
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({
            access_token: account.access_token,
            refresh_token: account.refresh_token
        });
        const drive = google.drive({ version: "v3", auth: oauth2Client });

        // 3. Init Gemini
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const geminiContents: any[] = [];

        // 4. Download files from Drive and Upload to Gemini in parallel
        const uploadPromises = documents.map(async (doc) => {
            // Avoid Japanese characters in tempPath to prevent Gemini SDK ByteString error
            const ext = path.extname(doc.filename);
            const tempPath = path.join(os.tmpdir(), `${crypto.randomUUID()}${ext}`);
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

            // Strictly sanitize mimeType to prevent ByteString errors from Japanese chars in parameters
            const cleanMimeType = doc.mimeType ? doc.mimeType.split(';')[0].trim() : "text/plain";

            const uploadResult = await ai.files.upload({
                file: tempPath,
                config: {
                    mimeType: cleanMimeType,
                    displayName: `file-${crypto.randomUUID()}`
                },
            });

            return {
                fileData: {
                    mimeType: cleanMimeType,
                    fileUri: uploadResult.uri,
                },
                filenameMessage: `(上記のファイルは「${doc.filename}」という名前のファイルです)`
            };
        });

        const uploadResults = await Promise.all(uploadPromises);

        for (const result of uploadResults) {
            geminiContents.push({ fileData: result.fileData });
            geminiContents.push(result.filenameMessage);
        }

        // Add user's text message or special initial prompt
        if (isInitialRequest) {
            geminiContents.push("これらのソースの内容を踏まえて、全体像を3〜4行で要約してください。その後、ユーザーがさらに深掘りして尋ねるべき「おすすめの質問」を3つ提案してください。提案は必ず箇条書きで改行し「- おすすめ: [質問文]」という正確な形式で出力してください。");
        } else {
            geminiContents.push(message);
        }

        // Prepend system instruction to avoid SDK ByteString encoding bug
        const systemPrompt = `システム指示: あなたは優秀なデータ分析のプロフェッショナルであり、的確な経理アシスタントです。
提供された全てのソース（ファイルやドキュメント）を統合的に把握し、それらの情報を中心に多角的かつ論理的な回答を行ってください。
もしユーザーが「freeeに登録」「仕訳して」「抽出して」等と要請した場合、または明らかに経理書類（請求書、領収書、納品書など）のデータ入力を目的としている場合は、回答の最後に以下のJSONフォーマットで抽出データをMarkdownのコードブロック（\`\`\`json ... \`\`\`）として出力してください。

\`\`\`json
{
  "isAccountingData": true,
  "partnerName": "取引先名（株式会社などはそのまま）",
  "issueDate": "YYYY-MM-DD（不明な場合はソースの日付から推測または今日の日付）",
  "amount": 税込金額（数値のみ、カンマなし）,
  "description": "品目や摘要（簡潔に）",
  "taxRate": 消費税率（数値のみ、例: 10 または 8。軽減税率の明記があれば8）
}
\`\`\`
通常の質問に対するテキスト回答と、上記のJSONコードブロックは両方出力して構いません。`;

        geminiContents.unshift(systemPrompt);

        // 5. Generate Content
        console.log("Generating chat response...");
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: geminiContents
        });

        const replyText = result.text || "";

        // Save Messages (Only if initial request)
        if (isInitialRequest) {
            await prisma.message.create({
                data: {
                    role: "ai",
                    content: replyText,
                    userId: session.user.id,
                    folderId
                }
            });
        }

        // Clean up local temp files
        for (const tFile of tempFiles) {
            try { await fs.unlink(tFile); } catch (e) { }
        }

        return NextResponse.json({ reply: replyText });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        for (const tFile of tempFiles) {
            try { await fs.unlink(tFile); } catch (e) { }
        }
        return NextResponse.json({ error: error.message || "Failed to process chat" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const folderId = searchParams.get("folderId");

        if (!folderId) {
            return NextResponse.json({ error: "Missing folderId" }, { status: 400 });
        }

        // Delete all messages in the folder (which should only be the initial summary)
        await prisma.message.deleteMany({
            where: {
                folderId,
                userId: session.user.id
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
