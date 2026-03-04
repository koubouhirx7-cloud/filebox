import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await prisma.freeeAccount.delete({
            where: { userId: session.user.id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Freee disconnect error:", error);
        // It might fail if the record doesn't exist, which is fine, we just want it gone.
        return NextResponse.json({ success: true });
    }
}
