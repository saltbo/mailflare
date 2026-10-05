"use client";

import { DatabaseBackup, Globe2, Activity, Settings, Palette, BadgeDollarSign, Route, Webhook,  } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavItem } from "./components-nav";
import { NavSectionHeader, useSectionOpen } from "./nav-section-header";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarHeader } from "./sidebar-header";
import { SidebarScaffold } from "./sidebar-scaffold";
import { useSidebar } from "./sidebar-state";

type AdminLinkPermission = "primary" | "domains" | "users";

type AdminNavLink = {
  href: string;
  label: string;
  icon: typeof Settings;
};

const sections: { label?: string; links: AdminNavLink[] }[] = [
  {
    // label: "Overview",
    links: [{ href: "/admin", label: "Overview", icon: Settings }],
  },
  {
    label: "Email",
    links: [
      { href: "/domains", label: "Domains", icon: Globe2 },
      { href: "/routing", label: "Routing", icon: Route },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
    ],
  },
  {
    label: "Administration",
    links: [
      { href: "/general", label: "General", icon: Settings },
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/backups", label: "Backups", icon: DatabaseBackup },
    ],
  },
  {
    label: "Product",
    links: [
      { href: "/branding", label: "Branding", icon: Palette },
      { href: "/licenses", label: "Licenses", icon: BadgeDollarSign },
    ],
  },
];

function AdminSection({ label, links, showDivider, minimal }: { label?: string; links: AdminNavLink[]; showDivider: boolean; minimal: boolean }) {
  const [open, toggle] = useSectionOpen(`mailflare:nav:admin-section-open:${label ?? ""}`);
  // Unlabelled sections have nothing to toggle; the icon rail always shows everything.
  const expanded = minimal || !label || open;
  return (
    <section>
      {showDivider && <hr className="mx-6 mb-3 border-neutral-200/70" />}
      {!minimal && label && <NavSectionHeader label={label} open={open} onToggle={toggle} />}
      {expanded && (
        <div className="space-y-px">
          {links.map((link) => (
            <NavItem link={link} key={link.href} />
          ))}
        </div>
      )}
    </section>
  );
}

export function AdminNav({ className }: { className?: string }) {
  const { minimal } = useSidebar();


  return (
    <SidebarScaffold className={className} header={<SidebarHeader href="/inbox" label="Admin" />} footer={<SidebarFooter />}>
      <div className={cn("space-y-4", minimal && "space-y-2 pl-1")}>
        {sections.map((section, sectionIndex) => {
          const links = section.links;
          if (links.length === 0) return null;

          return (
            // The first section has no label, so fall back to its first href for a stable key.
            <AdminSection key={section.label ?? links[0].href} label={section.label} links={links} showDivider={minimal && sectionIndex > 0} minimal={minimal} />
          );
        })}
      </div>
    </SidebarScaffold>
  );
}
