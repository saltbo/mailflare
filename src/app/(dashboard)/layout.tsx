"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { ComposeProvider } from "@/components/compose/compose-context";
import { FloatingComposer } from "@/components/compose/floating-composer";
import { MailSearchInput } from "@/components/mail-search/mail-search-input";
import { MailSearchProvider } from "@/components/mail-search/mail-search-context";
import { MailboxProvider } from "@/components/mailbox-provider";
import { MailboxSelector } from "@/components/mailbox-selector";
import { LicenseIndicator } from "@/components/license-indicator";
import { DashboardNav } from "@/components/dashboard-nav";
import { SidebarProvider } from "@/components/sidebar-state";
import { SidebarAside, MobileMenuButton } from "@/components/sidebar-aside";
import { SidebarResizeBoundary } from "@/components/sidebar-resize-boundary";
import { ShortcutsProvider } from "@/components/shortcuts";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requireMailbox>
      <SidebarProvider mobileOverlay>
        <MailboxProvider>
          <ComposeProvider>
            <MailSearchProvider>
              <ShortcutsProvider>
                <div className="grid h-dvh grid-cols-[minmax(0,1fr)] overflow-hidden bg-[#f6f8fc] transition-[grid-template-columns] md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]" style={{ transitionDuration: "var(--sidebar-transition-duration)" }}>
                  <SidebarAside>
                    <div className="h-full">
                      <DashboardNav />
                    </div>
                    <SidebarResizeBoundary />
                  </SidebarAside>
                  <div className="flex min-h-0 min-w-0 flex-col">
                    <header className="flex h-16 w-full shrink-0 items-center gap-3 pr-4 text-sm">
                      <MobileMenuButton className="ml-2" />
                      <MailSearchInput />
                      {/* <Link
                        href="/settings/account"
                        className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-200"
                        title="Account Settings"
                      >
                        <HelpCircle className="h-5 w-5" />
                      </Link> */}
                      <LicenseIndicator />
                      <MailboxSelector />
                    </header>
                    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-t-3xl bg-white overscroll-contain scrollbar-gutter-stable">
                          {children}
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
