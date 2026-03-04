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

        const data = await request.json();
        const { partnerName, issueDate, amount, description, taxRate } = data;

        if (!issueDate || !amount) {
            return NextResponse.json({ error: "Missing required fields (date, amount)" }, { status: 400 });
        }

        // 1. Get Freee token
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

        // 2. Get Company ID
        // In a real app we might cache this, but for prototype we fetch on the fly
        const meRes = await fetch("https://api.freee.co.jp/api/1/users/me", { headers });
        if (!meRes.ok) {
            const err = await meRes.text();
            console.error("Failed to fetch user:", err);
            return NextResponse.json({ error: "Failed to fetch freee company info" }, { status: 500 });
        }
        const meData = await meRes.json();
        const companyId = meData.user?.companies?.[0]?.id;

        if (!companyId) {
            return NextResponse.json({ error: "No company found for this freee account" }, { status: 400 });
        }

        // 3. Fetch Account Items to find a default expense account (e.g., 消耗品費 or 雑費 or just first expense)
        const accountItemsRes = await fetch(`https://api.freee.co.jp/api/1/account_items?company_id=${companyId}`, { headers });
        if (!accountItemsRes.ok) throw new Error("Failed to fetch account items");
        const accountItemsData = await accountItemsRes.json();
        const expenseItems = accountItemsData.account_items.filter((item: any) => item.account_category === "expense" || item.account_category === "cost");
        const accountItemId = expenseItems.length > 0 ? expenseItems[0].id : null;

        if (!accountItemId) {
            return NextResponse.json({ error: "No default expense account item found in freee" }, { status: 400 });
        }

        // 4. Fetch Tax Codes to find the matching tax code
        const taxesRes = await fetch(`https://api.freee.co.jp/api/1/taxes?company_id=${companyId}`, { headers });
        if (!taxesRes.ok) throw new Error("Failed to fetch taxes");
        const taxesData = await taxesRes.json();

        let targetTaxCode = null;
        const targetRate = parseInt(String(taxRate).replace(/[^0-9]/g, "")) || 10;

        // Very basic matching based on name and rate (simplified for prototype)
        // Freee taxes list is complex (課税仕入, etc). We will look for 課税仕入 string and matching rate.
        const expenseTaxes = taxesData.taxes.filter((t: any) => t.name.includes("課税仕入") || t.name.includes("対象外"));
        for (const t of expenseTaxes) {
            if (targetRate === 10 && t.name.includes("10%")) targetTaxCode = t.code;
            if (targetRate === 8 && t.name.includes("8%")) targetTaxCode = t.code;
            if (targetRate === 0 && t.name.includes("対象外")) targetTaxCode = t.code;
        }
        // Fallback to first code if not found
        if (!targetTaxCode && expenseTaxes.length > 0) targetTaxCode = expenseTaxes[0].code;

        // 5. Create Deal (未決済取引)
        const dealPayload = {
            issue_date: issueDate,
            type: "expense",
            company_id: companyId,
            due_amount: parseInt(amount, 10),
            details: [
                {
                    tax_code: targetTaxCode,
                    account_item_id: accountItemId,
                    amount: parseInt(amount, 10),
                    description: `${partnerName ? partnerName + " - " : ""}${description || "自動登録"}`
                }
            ]
        };

        const dealsRes = await fetch("https://api.freee.co.jp/api/1/deals", {
            method: "POST",
            headers,
            body: JSON.stringify(dealPayload)
        });

        if (!dealsRes.ok) {
            const errData = await dealsRes.json();
            console.error("Failed to create freee deal:", errData);
            return NextResponse.json({ error: "freeeへの登録に失敗しました。APIエラー。", details: errData }, { status: 500 });
        }

        const createdDeal = await dealsRes.json();

        return NextResponse.json({ success: true, deal: createdDeal });

    } catch (error: any) {
        console.error("Freee deals API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to process freee deal" }, { status: 500 });
    }
}
