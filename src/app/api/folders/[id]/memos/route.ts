import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: folderId } = await params;
        const body = await request.json();
        const { content } = body;

        // Verify folder exists and belongs to user
        const folder = await prisma.folder.findUnique({
            where: { id: folderId }
        });

        if (!folder || folder.userId !== session.user.id) {
            return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        }

        if (!content || content.trim() === "") {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        const memo = await prisma.memo.create({
            data: {
                content: content.trim(),
                folderId
            }
        });

        return NextResponse.json({ memo });

    } catch (error: any) {
        console.error("Error creating memo:", error);
        if (error.message === "invalid_grant") {
            return NextResponse.json({ error: "Google Driveの認証期限が切れました。一度ログアウトし、再度ログインしてください。" }, { status: 401 });
        }
        return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
    }
}
