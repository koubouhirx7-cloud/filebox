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
        const { deadline, title } = body;

        // Verify folder exists and belongs to user
        const folder = await prisma.folder.findUnique({
            where: { id: folderId }
        });

        if (!folder || folder.userId !== session.user.id) {
            return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        }

        if (!deadline) {
            return NextResponse.json({ error: "Deadline is required" }, { status: 400 });
        }

        const paymentDeadline = await prisma.paymentDeadline.create({
            data: {
                title: title?.trim() || "無題の支払い",
                deadline: new Date(deadline),
                folderId
            }
        });

        return NextResponse.json({ paymentDeadline });

    } catch (error: any) {
        console.error("Error creating payment deadline:", error);
        return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
    }
}
