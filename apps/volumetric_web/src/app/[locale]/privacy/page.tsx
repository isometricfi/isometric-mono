import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { generatePageMetadata } from "@/lib/metadata";
import { PrivacyContentEN, PrivacyContentZH } from "./_components/PrivacyContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return generatePageMetadata({ params }, "Metadata.privacy", "/privacy");
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const isZH = locale === "zh";

  return (
    <div className="mx-auto max-w-4xl py-12">
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            {isZH ? "隐私政策" : "Privacy Policy"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isZH ? "最后更新：2026年5月3日" : "Last updated: May 3, 2026"}
          </p>
          {isZH && (
            <div className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ 本隐私政策为翻译版本，仅供参考。英文版本为具有法律约束力的正式版本。
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                This is a translated version for reference only. The{" "}
                <Link href="/privacy" locale="en" className="underline font-medium">
                  English version
                </Link>{" "}
                is the legally binding version.
              </p>
            </div>
          )}
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          {isZH ? <PrivacyContentZH /> : <PrivacyContentEN />}

          <div className="mt-12 pt-8 border-t">
            <Link href="/" className="text-primary hover:underline">
              {isZH ? "← 返回首页" : "← Back to home"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
