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
        if (!companiesRes.ok) {
            const errText = await companiesRes.text();
            console.error("Freee companies fetch error:", companiesRes.status, errText);
            if (companiesRes.status === 401) {
                return NextResponse.json({ error: "freeeの連携有効期限が切れました。画面右上の「freee連携済み」ボタンから一度解除し、再度連携を行ってください。" }, { status: 401 });
            }
            return NextResponse.json({ error: "Failed to fetch company", details: errText }, { status: 500 });
        }

        const companiesData = await companiesRes.json();
        const companyId = companiesData.companies?.[0]?.id;

        if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

        const limit = 100;

        try {
            const accountItemsRes = await fetch(`https://api.freee.co.jp/api/1/account_items?company_id=${companyId}&limit=${limit}`, { headers });

            if (!accountItemsRes.ok) {
                const errText = await accountItemsRes.text();
                console.error("Freee API Error (account_items):", accountItemsRes.status, errText);
                return NextResponse.json({ error: "Failed to fetch account items", details: errText }, { status: accountItemsRes.status });
            }

            const data = await accountItemsRes.json();
            const allItems = data.account_items || [];

            // Filter out walletables (banks, cash, etc)
            const validItems = allItems.filter((item: any) => !item.walletable_id);

            return NextResponse.json({ items: validItems });
        } catch (fetchErr: any) {
            console.error("Fetch Exception (account_items):", fetchErr);
            return NextResponse.json({ error: "Fetch exception", details: fetchErr.message }, { status: 500 });
        }

    } catch (error: any) {
        if (error.message === "invalid_grant") {
            return NextResponse.json({ error: "Google Driveの認証期限が切れました。一度ログアウトし、再度ログインしてください。" }, { status: 401 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
