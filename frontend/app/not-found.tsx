"use client";

/**
 * not-found.tsx — 404 page (issue #356)
 *
 * Improvements over the previous static version:
 *   • All text is translated via next-intl (4 locales: en, yo, ig, ha).
 *   • Authenticated users see additional quick-links: "Sell an asset" and
 *     "View your wallet". Guest users see the sign-in / create-account links
 *     instead — giving every visitor an actionable next step.
 *   • Styled consistently with the rest of the app (Tailwind + dark mode).
 */

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "./hooks/useAuth";

export default function NotFound() {
  const t = useTranslations("NotFound");
  const { user, isLoading } = useAuth();

  const isAuthenticated = !isLoading && user !== null;

  /**
   * Quick-link rows shown beneath the primary CTAs.
   * Guests see the sign-in / create-account links; authenticated users see
   * the marketplace, sell, and wallet pages instead.
   */
  const quickLinks = isAuthenticated
    ? [
        { href: "/",       label: t("marketplace") },
        { href: "/sell",   label: t("sellAirtime") },
        { href: "/wallet", label: t("viewWallet") },
      ]
    : [
        { href: "/",            label: t("marketplace") },
        { href: "/sell",        label: t("sellAirtime") },
        { href: "/auth/signup", label: t("createAccount") },
        { href: "/auth/verify", label: t("signIn") },
      ];

  return (
    <div className="flex flex-1 flex-col bg-gray-50 dark:bg-gray-900">
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-lg text-center">
          {/* Decorative large "404" */}
          <p
            aria-hidden="true"
            className="text-[8rem] font-extrabold leading-none tracking-tighter text-gray-100 select-none dark:text-gray-800"
          >
            404
          </p>

          <span aria-hidden="true" className="mt-2 block text-5xl">
            🔍
          </span>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            {t("heading")}
          </h1>

          <p className="mt-3 text-sm text-gray-500 leading-relaxed max-w-sm mx-auto dark:text-gray-400">
            {t("body")}
          </p>

          {/* Primary CTAs — always visible */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              {t("browseListings")}
            </Link>

            {/* Authenticated: sell + wallet. Guest: sell only (wallet requires auth) */}
            {!isLoading && (
              <>
                <Link
                  href="/sell"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
                >
                  {t("sellAsset")}
                </Link>

                {isAuthenticated && (
                  <Link
                    href="/wallet"
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
                  >
                    {t("viewWallet")}
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Secondary quick-links */}
          <div className="mt-10 border-t border-gray-100 pt-8 dark:border-gray-700">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {t("youMightBeLookingFor")}
            </p>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {quickLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-violet-600 hover:text-violet-800 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 rounded transition-colors dark:text-violet-400 dark:hover:text-violet-300"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
          <div className="flex gap-5 text-sm text-gray-400 dark:text-gray-500">
            <a
              href="https://github.com/arflexx/Airflex"
              target="_blank"
              rel="noreferrer"
              className="hover:text-gray-600 transition-colors dark:hover:text-gray-300"
            >
              {t("github")}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
