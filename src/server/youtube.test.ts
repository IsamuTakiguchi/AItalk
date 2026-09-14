/**
 * Checks the filtering that stands between a raw search result and something
 * the app will actually embed. Videos that cannot be embedded render as an
 * error box inside the player, so they must never reach the client.
 *
 * No network: the API responses are fixtures.
 */
import { chooseVideo, parseDuration } from "./youtube";

let fails = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) fails++;
};

// --- duration parsing -------------------------------------------------------
check("parses minutes and seconds", parseDuration("PT7M31S") === 451);
check("parses hours", parseDuration("PT1H2M3S") === 3723);
check("parses seconds only", parseDuration("PT45S") === 45);
check("parses minutes only", parseDuration("PT10M") === 600);
check("unparseable duration is 0, not NaN", parseDuration("garbage") === 0);
check("live streams (no duration) are 0", parseDuration("P0D") === 0);

// --- candidate selection ----------------------------------------------------
type Candidate = Parameters<typeof chooseVideo>[0][number];
const make = (over: Partial<Candidate> & { id: string }): Candidate => ({
  id: over.id,
  snippet: {
    title: `title ${over.id}`,
    channelTitle: `channel ${over.id}`,
    thumbnails: { medium: { url: `https://img/${over.id}.jpg` } },
    ...over.snippet,
  },
  contentDetails: { duration: "PT8M", ...over.contentDetails },
  status: { embeddable: true, privacyStatus: "public", ...over.status },
});

check("picks the first usable candidate", chooseVideo([make({ id: "a" }), make({ id: "b" })])?.videoId === "a");
check("keeps YouTube's relevance order", chooseVideo([make({ id: "x" }), make({ id: "y" })])?.videoId === "x");

check(
  "skips a non-embeddable video",
  chooseVideo([
    make({ id: "blocked", status: { embeddable: false, privacyStatus: "public" } }),
    make({ id: "ok" }),
  ])?.videoId === "ok",
);
check(
  "skips a non-public video",
  chooseVideo([
    make({ id: "private", status: { embeddable: true, privacyStatus: "unlisted" } }),
    make({ id: "ok" }),
  ])?.videoId === "ok",
);
check(
  "skips a video that is too long for an intro",
  chooseVideo([
    make({ id: "long", contentDetails: { duration: "PT45M" } }),
    make({ id: "ok" }),
  ])?.videoId === "ok",
);
check(
  "skips a clip too short to explain anything",
  chooseVideo([
    make({ id: "short", contentDetails: { duration: "PT20S" } }),
    make({ id: "ok" }),
  ])?.videoId === "ok",
);
check(
  "skips a live stream, whose duration does not parse",
  chooseVideo([
    make({ id: "live", contentDetails: { duration: "P0D" } }),
    make({ id: "ok" }),
  ])?.videoId === "ok",
);

check("returns null when every candidate is unusable", chooseVideo([
  make({ id: "a", status: { embeddable: false, privacyStatus: "public" } }),
  make({ id: "b", contentDetails: { duration: "PT2H" } }),
]) === null);
check("returns null for an empty result set", chooseVideo([]) === null);

const picked = chooseVideo([make({ id: "full" })]);
check("carries title, channel and thumbnail through", Boolean(
  picked && picked.title === "title full" && picked.channel === "channel full" && picked.thumbnail.endsWith("full.jpg"),
));

console.log(fails === 0 ? "\nall youtube checks pass" : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
