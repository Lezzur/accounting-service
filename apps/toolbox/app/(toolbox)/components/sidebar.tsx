"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Kanban,
  Users,
  CheckSquare,
  FileText,
  Table2,
  BarChart3,
  Calculator,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
  Building2,
  Briefcase,
} from "lucide-react";
import { cn } from "@numera/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type Module = "crm" | "workdesk";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const CRM_NAV: NavItem[] = [
  { label: "Pipeline", href: "/crm/pipeline", icon: Kanban },
  { label: "Clients", href: "/crm/clients", icon: Users },
  { label: "Tasks", href: "/crm/tasks", icon: CheckSquare },
  { label: "Invoices", href: "/crm/invoices", icon: FileText },
];

const WORKDESK_NAV: NavItem[] = [
  { label: "Transactions", href: "/workdesk", icon: Table2 },
  { label: "Reports", href: "/workdesk/reports", icon: BarChart3 },
  { label: "Tax Prep", href: "/workdesk/tax-prep", icon: Calculator },
  { label: "Deadlines", href: "/workdesk/deadlines", icon: CalendarClock },
];

const MODULE_DEFAULTS: Record<Module, boolean> = {
  crm: false,      // 240px expanded by default
  workdesk: true,  // 64px collapsed by default
};

const storageKey = (module: Module) => `numera_sidebar_collapsed_${module}`;

// ─── Tooltip wrapper ──────────────────────────────────────────────────────────

function Tooltip({
  label,
  children,
  show,
}: {
  label: string;
  children: React.ReactNode;
  show: boolean;
}) {
  if (!show) return <>{children}</>;
  return (
    <span className="relative flex items-center group/tooltip">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-full ml-3 z-50",
          "whitespace-nowrap rounded-md px-2 py-1",
          "bg-slate-900 text-white text-xs",
          "opacity-0 group-hover/tooltip:opacity-100",
          "transition-opacity duration-150 delay-200",
        )}
      >
        {label}
      </span>
    </span>
  );
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavLink({
  item,
  isActive,
  isCollapsed,
}: {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium",
        "relative transition-colors duration-[200ms]",
        isActive
          ? [
              "bg-teal-100 text-teal-600",
              "before:absolute before:left-0 before:top-0 before:bottom-0",
              "before:w-0.5 before:bg-teal-600 before:rounded-r-full",
            ]
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        isCollapsed && "justify-center px-2",
      )}
    >
      <Tooltip label={item.label} show={isCollapsed}>
        <Icon
          size={20}
          className={cn(
            "shrink-0",
            isActive ? "text-teal-600" : "text-slate-500",
          )}
          aria-hidden="true"
        />
      </Tooltip>
      {!isCollapsed && <span>{item.label}</span>}
    </Link>
  );
}

// ─── Module tab ───────────────────────────────────────────────────────────────

function ModuleTab({
  label,
  icon: Icon,
  isActive,
  isCollapsed,
  href,
}: {
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  isCollapsed: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
        "transition-colors duration-[200ms]",
        isActive
          ? "bg-teal-100 text-teal-600"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
        isCollapsed && "justify-center px-2",
      )}
    >
      <Tooltip label={label} show={isCollapsed}>
        <Icon size={20} className="shrink-0" aria-hidden="true" />
      </Tooltip>
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();

  // Determine active module from URL
  const activeModule: Module = pathname.startsWith("/crm") ? "crm" : "workdesk";

  // Collapsed state per module; hydrated from localStorage after mount
  const [collapsedState, setCollapsedState] = useState<Record<Module, boolean>>(
    MODULE_DEFAULTS,
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const crmStored = localStorage.getItem(storageKey("crm"));
    const wdStored = localStorage.getItem(storageKey("workdesk"));

    // At tablet width (768–1279px) default to collapsed if no stored preference
    const isTablet =
      window.innerWidth >= 768 && window.innerWidth < 1280;

    setCollapsedState({
      crm:
        crmStored !== null
          ? crmStored === "true"
          : isTablet
            ? true
            : MODULE_DEFAULTS.crm,
      workdesk:
        wdStored !== null ? wdStored === "true" : MODULE_DEFAULTS.workdesk,
    });
    setMounted(true);
  }, []);

  const isCollapsed = collapsedState[activeModule];

  const toggleCollapsed = () => {
    setCollapsedState((prev) => {
      const next = { ...prev, [activeModule]: !prev[activeModule] };
      localStorage.setItem(storageKey(activeModule), String(next[activeModule]));
      return next;
    });
  };

  const navItems = activeModule === "crm" ? CRM_NAV : WORKDESK_NAV;

  // Placeholder user initials — replace with auth context when available
  const userInitials = "NU";

  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        // Hidden on mobile, visible md+
        "hidden md:flex flex-col h-full",
        "bg-white border-r border-slate-200",
        "transition-[width] duration-[200ms] ease-in-out",
        // Width driven by collapsed state — suppress flash before mount
        mounted
          ? isCollapsed
            ? "w-16"
            : "w-60"
          : activeModule === "crm"
            ? "w-60"
            : "w-16",
      )}
    >
      {/* Wordmark */}
      <div
        className={cn(
          "flex items-center h-14 px-3 border-b border-slate-200 shrink-0",
          isCollapsed ? "justify-center" : "gap-2",
        )}
      >
        <span
          className={cn(
            "font-semibold text-teal-600 select-none",
            isCollapsed ? "text-base" : "text-lg",
          )}
          aria-label="Numera"
        >
          {isCollapsed ? "N" : "Numera"}
        </span>
      </div>

      {/* Module switcher */}
      <div
        className={cn(
          "flex p-2 border-b border-slate-200 shrink-0",
          isCollapsed ? "flex-col gap-1" : "gap-1",
        )}
      >
        <ModuleTab
          label="CRM"
          icon={Building2}
          isActive={activeModule === "crm"}
          isCollapsed={isCollapsed}
          href="/crm/pipeline"
        />
        <ModuleTab
          label="Workdesk"
          icon={Briefcase}
          isActive={activeModule === "workdesk"}
          isCollapsed={isCollapsed}
          href="/workdesk"
        />
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <ul role="list" className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                isActive={
                  item.href === "/workdesk"
                    ? pathname === "/workdesk"
                    : pathname.startsWith(item.href)
                }
                isCollapsed={isCollapsed}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom: settings, avatar, sign-out, toggle */}
      <div className="shrink-0 border-t border-slate-200 p-2 space-y-0.5">
        {/* Settings */}
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium",
            "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            "transition-colors duration-[200ms]",
            isCollapsed && "justify-center px-2",
          )}
        >
          <Tooltip label="Settings" show={isCollapsed}>
            <Settings size={20} className="shrink-0 text-slate-500" aria-hidden="true" />
          </Tooltip>
          {!isCollapsed && <span>Settings</span>}
        </Link>

        {/* User avatar + sign-out */}
        <div
          className={cn(
            "flex items-center px-3 py-2 gap-3",
            isCollapsed && "justify-center px-2",
          )}
        >
          <Tooltip label={userInitials} show={isCollapsed}>
            <span
              className={cn(
                "shrink-0 flex items-center justify-center",
                "w-7 h-7 rounded-full bg-teal-100 text-teal-700 text-xs font-semibold select-none",
              )}
              aria-label="User account"
            >
              {userInitials}
            </span>
          </Tooltip>
          {!isCollapsed && (
            <button
              type="button"
              className={cn(
                "ml-auto flex items-center gap-1 text-xs text-slate-500",
                "hover:text-slate-900 transition-colors duration-[200ms]",
              )}
              aria-label="Sign out"
            >
              <LogOut size={14} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          )}
        </div>

        {/* Toggle button */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "w-full flex items-center px-3 py-2 rounded-md text-sm",
            "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
            "transition-colors duration-[200ms]",
            isCollapsed ? "justify-center px-2" : "gap-3",
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Tooltip label={isCollapsed ? "Expand" : ""} show={isCollapsed}>
            {isCollapsed ? (
              <ChevronRight size={20} aria-hidden="true" />
            ) : (
              <>
                <ChevronLeft size={20} aria-hidden="true" />
                <span>Collapse</span>
              </>
            )}
          </Tooltip>
        </button>
      </div>
    </aside>
  );
}

// ─── Bottom tab bar (mobile) ──────────────────────────────────────────────────

export function BottomTabBar() {
  const pathname = usePathname();
  const activeModule: Module = pathname.startsWith("/crm") ? "crm" : "workdesk";

  const tabs = [
    {
      label: "CRM",
      icon: Building2,
      href: "/crm/pipeline",
      isActive: activeModule === "crm",
    },
    {
      label: "Workdesk",
      icon: Briefcase,
      href: "/workdesk",
      isActive: activeModule === "workdesk",
    },
    {
      label: "Settings",
      icon: Settings,
      href: "/settings",
      isActive: pathname.startsWith("/settings"),
    },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Mobile navigation"
      className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-40",
        "flex items-stretch h-[44px]",
        "bg-white border-t border-slate-200",
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.isActive ? "page" : undefined}
            aria-label={tab.label}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5",
              "min-h-[44px] min-w-[44px] text-[10px] font-medium",
              "transition-colors duration-[200ms]",
              tab.isActive
                ? "text-teal-600"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <Icon
              size={20}
              className={tab.isActive ? "text-teal-600" : "text-slate-500"}
              aria-hidden="true"
            />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
