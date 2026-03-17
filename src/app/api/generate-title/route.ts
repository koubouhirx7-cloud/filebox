import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { GoogleGenAI } from "@google/genai";

const geminiApiKey = process.env.GEMINI_API_KEY;

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!geminiApiKey) {
            return NextResponse.json({ error: "Gemini API key is not configured" }, { status: 500 });
        }

        const data = await request.json();
        const { image, mimeType } = data; // image should be base64 encoded string

        if (!image || !mimeType) {
            return NextResponse.json({ error: "Image data and mimeType are required" }, { status: 400 });
        }

        // Clean base64 string if it contains the data URI prefix
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

        const ai = new GoogleGenAI({ apiKey: geminiApiKey });

        const prompt = `この画像の内容を簡潔に表すタイトル（ファイル名用）を日本語で15文字以内で生成してください。
拡張子は含めず、タイトルのみを出力してください。
例: 〇〇タクシー領収書, 会議室ホワイトボード, 〇〇様名刺, 〇〇購入レシート`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: mimeType
                            }
                        },
                        { text: prompt }
                    ]
                }
            ]
        });

        let title = response.text || "画像ファイル";
        title = title.trim().replace(/\n/g, ""); // Remove any newlines
        // Remove quotes if gemini added them
        title = title.replace(/^["'「]+|["'」]+$/g, "");

        // Truncate if too long, just in case
        if (title.length > 20) {
            title = title.substring(0, 20);
        }

        return NextResponse.json({ title });
    } catch (error: any) {
        console.error("Title generation explicitly failed:", error);
        return NextResponse.json({ error: "Title generation failed", details: error.message || String(error) }, { status: 500 });
    }
}
