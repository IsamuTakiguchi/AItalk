import { Link } from "react-router-dom";
import { Screen } from "../components/Screen";
import { MockModeBanner } from "../components/UnsupportedBrowserNotice";
import { TALK_TOPICS } from "../content";
import { useAiEnabled } from "../lib/useHealth";

export function FreeTalk() {
  const aiEnabled = useAiEnabled();

  return (
    <Screen titleJa="フリートーク" subtitleJa="好きな話題でAI講師と話しましょう">
      {aiEnabled === false && <MockModeBanner />}
      <div className="grid grid-cols-2 gap-3">
        {TALK_TOPICS.map((t, i) => (
          <Link
            key={t.id}
            to={`/talk/${t.id}`}
            className="rise-in flex flex-col gap-1 rounded-2xl glass p-4 press"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <span className="text-3xl">{t.emoji}</span>
            <span className="text-sm font-semibold">{t.titleJa}</span>
          </Link>
        ))}
      </div>
    </Screen>
  );
}
