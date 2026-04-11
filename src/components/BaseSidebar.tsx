"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarLink {
  href: string;
  label: string;
  exact?: boolean;
}

interface BaseSidebarProps {
  links: SidebarLink[];
  headerContent: ReactNode;
  mobileTopbar: ReactNode;
}

export default function BaseSidebar({ links, headerContent, mobileTopbar }: BaseSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <>
      {headerContent}
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                active
                  ? "bg-sidebar-active text-white font-semibold shadow-sm"
                  : "text-white/75 hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile topbar */}
      <div className="md:hidden bg-sidebar-bg text-white p-3 flex items-center justify-between">
        {mobileTopbar}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg hover:bg-sidebar-hover transition-colors"
          aria-label={mobileOpen ? "Stäng meny" : "Öppna meny"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed top-0 left-0 w-64 bg-sidebar-bg text-white min-h-screen p-5 flex flex-col gap-1 z-50 animate-slide-in">
            {navContent}
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-sidebar-bg text-white min-h-screen p-5 flex-col gap-1">
        {navContent}
      </aside>
    </>
  );
}
