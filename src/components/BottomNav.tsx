import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", icon: "🏠", label: "ホーム" },
  { to: "/courses", icon: "📚", label: "コース" },
  { to: "/talk", icon: "💬", label: "フリートーク" },
  { to: "/me", icon: "👤", label: "マイページ" },
] as const;

/**
 * The bar's own height, excluding the safe-area inset below it. `App` reserves
 * this much scroll padding, so the two must stay in step — exported rather than
 * duplicated as a magic number.
 */
export const NAV_HEIGHT = 58;

export function BottomNav({ reviewCount }: { reviewCount: number }) {
  return (
    <nav
      // Overlaid, not stacked in a row: the content scrolling beneath is what
      // the backdrop blur has to work with.
      className="glass-strong absolute inset-x-0 bottom-0 z-20 border-x-0 border-b-0"
      // Keeps the tab row clear of the iPhone home indicator.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-[480px]" style={{ height: NAV_HEIGHT }}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              `press relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                // ink-500 rather than the dimmer ink-400 an inactive tab
                // usually gets: at 10px over translucent glass, ink-400 falls
                // under 3:1 and the label stops being readable.
                isActive ? "text-brand-600" : "text-ink-500"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* A soft pill behind the active tab, rather than colour alone. */}
                <span
                  aria-hidden
                  className="absolute inset-x-3 top-1 bottom-1 -z-10 rounded-2xl bg-brand-500/12"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? "scale(1)" : "scale(0.86)",
                    transition:
                      "opacity 0.28s var(--ease-glide), transform 0.36s var(--ease-spring)",
                  }}
                />
                <span
                  className="text-xl leading-none"
                  style={{
                    transform: isActive ? "translateY(-1px) scale(1.12)" : "none",
                    transition: "transform 0.36s var(--ease-spring)",
                  }}
                >
                  {tab.icon}
                </span>
                {tab.label}
                {tab.to === "/" && reviewCount > 0 && (
                  <span className="absolute top-1 right-[22%] flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[9px] font-bold text-white">
                    {reviewCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
