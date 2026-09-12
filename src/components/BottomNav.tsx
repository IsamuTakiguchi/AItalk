import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", icon: "🏠", label: "ホーム" },
  { to: "/courses", icon: "📚", label: "コース" },
  { to: "/talk", icon: "💬", label: "フリートーク" },
  { to: "/me", icon: "👤", label: "マイページ" },
] as const;

export function BottomNav({ reviewCount }: { reviewCount: number }) {
  return (
    <nav
      className="sticky bottom-0 z-20 border-t border-ink-400/15 bg-white/95 backdrop-blur"
      // Keeps the tab row clear of the iPhone home indicator.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-[480px]">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                isActive ? "text-brand-600" : "text-ink-400"
              }`
            }
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            {tab.label}
            {tab.to === "/" && reviewCount > 0 && (
              <span className="absolute top-1 right-[22%] flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[9px] font-bold text-white">
                {reviewCount}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
