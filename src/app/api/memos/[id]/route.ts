import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // Verify memo exists and belongs to user's folder
        const memo = await prisma.memo.findUnique({
            where: { id },
            include: { folder: true }
        });

        if (!memo || memo.folder.userId !== session.user.id) {
            return NextResponse.json({ error: "Memo not found" }, { status: 404 });
        }

        await prisma.memo.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Error deleting memo:", error);
        return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
    }
}
