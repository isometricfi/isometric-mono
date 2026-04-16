"use client";

import { Book, FileText, Mail, Shield } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { LEGAL_LINKS, RESOURCE_LINKS, SOCIAL_LINKS, TelegramIcon, XIcon } from "@/lib/site-links";

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
              </ul>
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
