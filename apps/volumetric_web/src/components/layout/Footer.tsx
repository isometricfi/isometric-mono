"use client";

import { Book, FileText, Github, Mail, MessageCircleQuestionMark, Shield } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

const SOCIAL_LINKS = {
  telegram: "https://t.me/isometricfi",
  x: "https://x.com/isometric",
  email: "mailto:support@isometric.fi",
};

const RESOURCE_LINKS = {
  docs: "https://docs.isometric.fi",
  support: "/support",
  github: "https://github.com/volumetrichq/volumetric-mono",
};

const LEGAL_LINKS = {
  privacy: "/privacy",
  terms: "/terms",
};

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

export function Footer() {
  const t = useTranslations("Footer");
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mx-auto mt-auto w-full max-w-5xl px-0 pb-6 pt-16">
      <div className="border-border border-t">
        <div className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="md:col-span-2 lg:pr-24">
              <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
                <Image
                  src="/logo.svg"
                  alt="Isometric"
                  width={28}
                  height={28}
                  className="min-w-[28px] min-h-[28px]"
                />
                <span>Isometric</span>
              </Link>
              <p className="mt-3 text-sm text-muted-foreground">{t("tagline")}</p>
              <p className="text-xs text-muted-foreground mt-4 md:block hidden">
                {t("copyright", { year: currentYear })}
              </p>
            </div>

            <div>
              <h3 className="font-medium text-sm mb-3">{t("legal")}</h3>
              <ul className="space-y-2.5">
                <li>
                  <Link
                    href={LEGAL_LINKS.privacy}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <Shield className="size-4" />
                    {t("privacyPolicy")}
                  </Link>
                </li>
                <li>
                  <Link
                    href={LEGAL_LINKS.terms}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <FileText className="size-4" />
                    {t("termsOfService")}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-sm mb-3">{t("resources")}</h3>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href={RESOURCE_LINKS.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <Book className="size-4" />
                    {t("documentation")}
                  </a>
                </li>
                <li>
                  <a
                    href={RESOURCE_LINKS.support}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <MessageCircleQuestionMark className="size-4" />
                    {t("support")}
                  </a>
                </li>
                <li>
                  <a
                    href={RESOURCE_LINKS.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <Github className="size-4" />
                    {t("github")}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-sm mb-3">{t("connect")}</h3>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href={SOCIAL_LINKS.email}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <Mail className="size-4" />
                    {t("email")}
                  </a>
                </li>
                <li>
                  <a
                    href={SOCIAL_LINKS.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <TelegramIcon className="size-4" />
                    {t("telegram")}
                  </a>
                </li>
                <li>
                  <a
                    href={SOCIAL_LINKS.x}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <XIcon className="size-4" />
                    {t("x")}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-4 flex flex-col md:flex-row justify-center items-center gap-4 md:hidden">
            <p className="text-xs text-muted-foreground">{t("copyright", { year: currentYear })}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
