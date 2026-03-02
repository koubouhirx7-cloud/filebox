export function getEmojiForTitle(title: string): string {
    const t = title.toLowerCase();

    // 1. Specific domain mapping for this app
    if (t.includes("自転車") || t.includes("bicycle") || t.includes("bike") || t.includes("整備") || t.includes("組立") || t.includes("ロードバイク") || t.includes("ハイランダー")) return "🚲";
    if (t.includes("経済") || t.includes("economy") || t.includes("金融") || t.includes("finance") || t.includes("投資")) return "📈";
    if (t.includes("顧客") || t.includes("カスタマー") || t.includes("customer") || t.includes("ユーザー")) return "👥";
    if (t.includes("費用") || t.includes("cost") || t.includes("お金") || t.includes("売上") || t.includes("見積") || t.includes("請求") || t.includes("銀行") || t.includes("保険")) return "💴";
    if (t.includes("ai") || t.includes("人工知能") || t.includes("bot") || t.includes("チャット") || t.includes("chat")) return "🤖";
    if (t.includes("ファイル") || t.includes("file") || t.includes("ドキュメント") || t.includes("document") || t.includes("資料") || t.includes("論文")) return "📄";
    if (t.includes("写真") || t.includes("photo") || t.includes("画像") || t.includes("image") || t.includes("カメラ") || t.includes("adobe")) return "📷";
    if (t.includes("録音") || t.includes("音声") || t.includes("mic") || t.includes("ジャーナル") || t.includes("diary")) return "🎙️";
    if (t.includes("ツール") || t.includes("設定") || t.includes("system") || t.includes("システム") || t.includes("開発") || t.includes("dev")) return "⚙️";
    if (t.includes("アイデア") || t.includes("idea") || t.includes("メモ") || t.includes("memo") || t.includes("ノート") || t.includes("note")) return "💡";
    if (t.includes("連絡") || t.includes("contact") || t.includes("メール") || t.includes("mail")) return "✉️";
    if (t.includes("家") || t.includes("home") || t.includes("不動産") || t.includes("住まい")) return "🏠";
    if (t.includes("生物") || t.includes("biology") || t.includes("科学") || t.includes("science")) return "🧬";
    if (t.includes("本") || t.includes("書籍") || t.includes("book") || t.includes("読書")) return "📚";
    if (t.includes("音楽") || t.includes("music") || t.includes("曲") || t.includes("sound")) return "🎵";

    // 2. Fallbacks based on string length / hash to keep it deterministic
    const fallbacks = ["📁", "📘", "📓", "📝", "📌", "💼", "📦", "🧩"];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % fallbacks.length;

    return fallbacks[index];
}
