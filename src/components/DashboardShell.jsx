import { LogOut } from "lucide-react";

function DashboardShell({ brand, navItems, activeTab, onTabChange, onLogout, children }) {
  return (
    <div className="min-h-screen bg-paper lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between bg-brand-900 px-4 py-6 lg:flex">
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
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <div>
            <span className="font-display text-lg font-semibold leading-tight text-brand-800">Payday</span>
            <p className="max-w-[72vw] truncate text-[11px] leading-tight text-ink-500">{brand}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-500 hover:bg-surface-alt"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        </header>

        <main className="min-w-0 flex-1 px-3 py-4 pb-24 sm:px-5 lg:px-8 lg:py-8 lg:pb-8">{children}</main>

        <nav
          aria-label="Dashboard navigation"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 px-1 pt-1 shadow-[0_-8px_24px_-18px_rgba(28,25,23,0.3)] backdrop-blur lg:hidden"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                aria-current={active ? "page" : undefined}
                aria-label={`${item.label}${item.count > 0 ? `, ${item.count}` : ""}`}
                className={`relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[10px] font-medium leading-tight ${
                  active ? "text-brand-800" : "text-ink-500"
                }`}
              >
                {active && <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-brand-700" />}
                <span className="relative">
                  <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                  {typeof item.count === "number" && item.count > 0 && (
                    <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-accent-500 px-1 text-center text-[9px] font-bold leading-4 text-white">
                      {item.count > 99 ? "99+" : item.count}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default DashboardShell;
