"use client";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ComposeProvider } from "@/components/compose/compose-context";
import { FloatingComposer } from "@/components/compose/floating-composer";
import { LicenseIndicator } from "@/components/license-indicator";
import { MailSearchProvider } from "@/components/mail-search/mail-search-context";
import { MailboxProvider } from "@/components/mailbox-provider";
import { MailboxSelector } from "@/components/mailbox-selector";
import { SidebarAside, MobileMenuButton } from "@/components/sidebar-aside";
import { SidebarHeader } from "@/components/sidebar-header";
import { SidebarProvider } from "@/components/sidebar-state";
import { ShortcutsProvider } from "@/components/shortcuts";
import { CalendarMobileUpcoming } from "./calendar-mobile-upcoming";

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <AuthGuard>
      <SidebarProvider mobileOverlay>
        <MailboxProvider>
          <ComposeProvider>
            <MailSearchProvider>
              <ShortcutsProvider>
              <div className="grid h-dvh grid-cols-[minmax(0,1fr)] overflow-hidden bg-[#f6f8fc]">
                <SidebarAside className="md:hidden"><CalendarMobileUpcoming /></SidebarAside>
                <div className="flex min-h-0 min-w-0 flex-col">
                  <header className="flex h-16 w-full shrink-0 items-center gap-3 pr-4 text-sm max-md:h-auto max-md:flex-wrap max-md:gap-x-2 max-md:gap-y-2 max-md:pb-2 max-md:pr-2 max-md:pt-1">
                    <MobileMenuButton className="ml-1" />
                    <div className="hidden shrink-0 px-3 md:block [&>div]:mb-0" style={{ width: "calc(var(--sidebar-width) + 1.5rem)" }}><SidebarHeader href="/inbox" /></div>
                    <div className="min-w-0 flex-1 basis-0 md:hidden"><div className="relative w-fit max-w-full"><select aria-label="Calendar section" value={pathname === "/booking" ? "/booking" : "/calendar"} onChange={(event) => router.push(event.target.value)} className="h-8 max-w-full appearance-none rounded-full border-0 bg-white pl-3 pr-8 text-sm font-medium text-neutral-700"><option value="/booking">Bookings</option><option value="/calendar">Calendar</option></select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" /></div></div>
                    <div className="flex min-w-0 flex-1 items-center gap-3 md:overflow-x-auto max-md:contents">
                      <nav aria-label="Calendar sections" className="flex shrink-0 max-md:hidden items-center rounded-full bg-white p-1">
                        <Link href="/booking" aria-current={pathname === "/booking" ? "page" : undefined} className={clsx("rounded-full px-4 py-2 text-sm font-medium transition-colors", pathname === "/booking" ? "bg-blue-600 text-white" : "text-neutral-600 hover:bg-neutral-100")}>Bookings</Link>
                        <Link href="/calendar" aria-current={pathname === "/calendar" ? "page" : undefined} className={clsx("rounded-full px-4 py-2 text-sm font-medium transition-colors", pathname === "/calendar" ? "bg-blue-600 text-white" : "text-neutral-600 hover:bg-neutral-100")}>Calendar</Link>
                      </nav>
                      <div id="calendar-header-slot" className="flex min-w-0 flex-1 items-center md:min-w-max max-md:order-last max-md:basis-full max-md:pl-3 max-md:empty:hidden" />
                    </div>
                    <LicenseIndicator />
                    <MailboxSelector />
                  </header>
                  <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                      <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[#f6f8fc] overscroll-contain scrollbar-gutter-stable">
                        <div key={pathname} className="page-transition-enter h-full min-h-0">{children}</div>
                      </main>
                  </div>
                </div>
                <FloatingComposer />
              </div>
              </ShortcutsProvider>
            </MailSearchProvider>
          </ComposeProvider>
        </MailboxProvider>
      </SidebarProvider>
    </AuthGuard>
  );
}
