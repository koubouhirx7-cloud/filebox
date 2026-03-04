import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const freeeAccount = await prisma.freeeAccount.findUnique({
            where: { userId: session.user.id }
        });

        if (!freeeAccount || !freeeAccount.accessToken) {
            return NextResponse.json({ error: "Freee account not linked" }, { status: 400 });
        }

        const headers = {
            "Authorization": `Bearer ${freeeAccount.accessToken}`,
            "Content-Type": "application/json"
        };

        const companiesRes = await fetch("https://api.freee.co.jp/api/1/companies", { headers });
        if (!companiesRes.ok) return NextResponse.json({ error: "Failed to fetch company" }, { status: 500 });

        const companiesData = await companiesRes.json();
        const companyId = companiesData.companies?.[0]?.id;

        if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

        const accountItemsRes = await fetch(`https://api.freee.co.jp/api/1/account_items?company_id=${companyId}`, { headers });
        if (!accountItemsRes.ok) return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });

        const data = await accountItemsRes.json();
        const items = data.account_items || [];

        // Filter out walletables (banks, cash, etc)
        const validItems = items.filter((item: any) => !item.walletable_id);

        return NextResponse.json({ items: validItems });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
