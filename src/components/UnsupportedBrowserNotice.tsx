export function UnsupportedBrowserNotice({ reasonJa }: { reasonJa: string }) {
  return (
    <div className="rounded-xl border border-near/30 bg-near/5 p-3">
      <p className="text-xs font-semibold text-near">音声入力が使えません</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-600">{reasonJa}</p>
    </div>
  );
}

export function MockModeBanner() {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
      <p className="text-xs font-semibold text-brand-700">モックモードで動作中</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-600">
        ANTHROPIC_API_KEY が設定されていないため、AI講師の応答は固定のサンプルです。
        キーを設定すると、実際の Claude による会話と添削になります。
      </p>
    </div>
  );
}
