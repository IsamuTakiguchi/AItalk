import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

type Props = {
  titleJa: string;
  subtitleJa?: string;
  back?: boolean;
  action?: ReactNode;
  children: ReactNode;
};

/** Shared page chrome: sticky header, padded body, consistent side gutters. */
export function Screen({ titleJa, subtitleJa, back, action, children }: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-full flex-col">
      <header className="glass-strong sticky top-0 z-10 border-x-0 border-t-0 px-4 py-3">
        <div className="flex items-center gap-2">
          {back && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="戻る"
              className="press -ml-1 flex h-9 w-9 items-center justify-center rounded-full text-lg text-ink-500 active:bg-ink-400/10"
            >
              ‹
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{titleJa}</h1>
            {subtitleJa && <p className="truncate text-xs text-ink-500">{subtitleJa}</p>}
          </div>
          {action}
        </div>
      </header>
      <div className="screen-in flex-1 space-y-4 px-4 py-4">{children}</div>
    </div>
  );
}
