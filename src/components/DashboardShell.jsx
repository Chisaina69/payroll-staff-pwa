import { LogOut } from "lucide-react";
import { TabPill } from "./ui";

export default function DashboardShell({ brand, navItems, activeTab, onTabChange, onLogout, children }) {
  return (
    <div className="flex min-h-screen bg-paper">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col justify-between bg-brand-900 px-4 py-6 md:flex">
        <div>
          <span className="font-display px-2 text-2xl font-semibold text-white">Payday</span>
          <p className="mb-8 px-2 mt-1 text-xs text-brand-200">{brand}</p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onTabChange(item.key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-white text-brand-800" : "text-brand-100 hover:bg-brand-800"
                  }`}
                >
                  <Icon size={17} strokeWidth={2.2} />
                  {item.label}
                  {typeof item.count === "number" && item.count > 0 && (
                    <span
                      className={`ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                        active ? "bg-brand-100 text-brand-800" : "bg-brand-700 text-brand-50"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-100 hover:bg-brand-800"
        >
          <LogOut size={17} /> Log Out
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header + horizontally scrolling tabs */}
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <div>
            <span className="font-display text-xl font-semibold text-brand-800">Payday</span>
            <p className="text-xs text-ink-500">{brand}</p>
          </div>
          <button onClick={onLogout} className="rounded-lg p-2 text-ink-500 hover:bg-surface-alt">
            <LogOut size={18} />
          </button>
        </header>
        <div className="scrollbar-thin flex gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-2.5 md:hidden">
          {navItems.map((item) => (
            <TabPill
              key={item.key}
              active={activeTab === item.key}
              onClick={() => onTabChange(item.key)}
              count={item.count}
            >
              {item.label}
            </TabPill>
          ))}
        </div>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
