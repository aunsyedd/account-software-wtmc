"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/app/actions";
import { BrandMark } from "./BrandMark";
import { BrandLoader } from "./BrandLoader";
import { Icon, type IconName } from "./Icon";
import { PageFade } from "./PageFade";
import { TableLabels } from "./TableLabels";

type NavItem = { href: string; label: string; icon: IconName };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Sales & Inventory",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/invoices", label: "Invoices", icon: "invoice" },
      { href: "/clients", label: "Clients", icon: "clients" },
      { href: "/products", label: "Products", icon: "products" },
      { href: "/reports", label: "Reports", icon: "reports" },
    ],
  },
  {
    label: "People",
    items: [{ href: "/employees", label: "Employees", icon: "employees" }],
  },
  {
    label: "Purchases",
    items: [
      { href: "/expenses", label: "Expenses", icon: "expenses" },
      { href: "/vendors", label: "Vendors", icon: "vendors" },
      { href: "/expense-dashboard", label: "Expense overview", icon: "pie" },
    ],
  },
  {
    label: "Administration",
    items: [{ href: "/settings", label: "Company & categories", icon: "settings" }],
  },
];

const sectionTitles: [string, string][] = [
  ["/dashboard", "Dashboard"],
  ["/invoices", "Invoices"],
  ["/clients", "Clients"],
  ["/products", "Products & Inventory"],
  ["/reports", "Reports"],
  ["/employees", "Employees"],
  ["/expenses", "Expenses"],
  ["/vendors", "Vendors"],
  ["/expense-dashboard", "Expense overview"],
  ["/settings", "Settings"],
];

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <>
      <button className="side-logout" type="submit" disabled={pending} title="Sign out">
        <Icon name="logout" />
        <span>Sign out</span>
      </button>
      {pending ? <BrandLoader label="Signing you out" /> : null}
    </>
  );
}

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => path === href || path.startsWith(href + "/");
  const section =
    sectionTitles.find(([href]) => path === href || path.startsWith(href + "/"))?.[1] ?? "Workspace";
  const initial = (email || "?").trim().charAt(0).toUpperCase();

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="shell">
      <div className={"backdrop" + (open ? " open" : "")} onClick={() => setOpen(false)} />
      <aside className={"sidebar" + (open ? " open" : "")} aria-label="Main navigation">
        <div className="side-brand">
          <Link href="/dashboard" className="side-brand-link">
            <span className="side-logo">
              <BrandMark />
            </span>
            <span className="side-brand-text">
              Washika Tabassum
              <small>Accounts Software</small>
            </span>
          </Link>
          <button className="side-close" type="button" aria-label="Close menu" onClick={() => setOpen(false)}>
            <Icon name="close" />
          </button>
        </div>

        <nav className="side-nav">
          {groups.map((g) => (
            <div className="side-group" key={g.label}>
              <div className="side-label">{g.label}</div>
              {g.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={"side-link" + (active(item.href) ? " active" : "")}
                  aria-current={active(item.href) ? "page" : undefined}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="side-user">
          <span className="avatar">{initial}</span>
          <span className="side-user-text">
            <strong>{email}</strong>
            <small>Signed in</small>
          </span>
          <form action={logoutAction}>
            <LogoutButton />
          </form>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="menu-btn" type="button" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Icon name="menu" size={20} />
          </button>
          <div className="topbar-title">
            <span className="crumb">Washika Tabassum</span>
            <span className="crumb-sep">/</span>
            <strong>{section}</strong>
          </div>
          <div className="top-right">
            <span className="avatar avatar-sm" title={email}>
              {initial}
            </span>
          </div>
        </header>
        <main className="main">
          <PageFade>{children}</PageFade>
        </main>
        <footer className="app-footer no-print">
          Developed &amp; Engineered by{" "}
          <a href="https://nexoratech.info" target="_blank" rel="noopener noreferrer">
            Nexora Tech
          </a>
        </footer>
        <TableLabels />
      </div>
    </div>
  );
}
