// KICKTOWN 전술 보드 — "AI로 전술 만들기" (Supabase Edge Function)
// 앱이 보낸 글 + 현재 보드 상태를 Claude API 에 넘기고, 장면 데이터(JSON)를 돌려준다.
// API 키는 이 함수의 비밀값(ANTHROPIC_API_KEY)에만 있고 브라우저에는 절대 내려가지 않는다.
//
// 비밀값 (Supabase 대시보드 → Edge Functions → Secrets)
//   ANTHROPIC_API_KEY   (필수) Claude API 키
//   KT_AI_MODEL         (선택) 기본 claude-sonnet-5-5
//   KT_ALLOWED_ORIGINS  (선택) 쉼표로 구분한 사이트 주소. 예) https://kick-town.com,https://www.kick-town.com
//   KT_AI_DAILY_LIMIT   (선택) 하루 최대 호출 수, 기본 60 (supabase_setup.sql 의 kt_ai_hit 함수가 있어야 동작)

const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("KT_AI_MODEL") || "claude-sonnet-5-5";
const BASE = (Deno.env.get("ANTHROPIC_BASE_URL") || "https://api.anthropic.com").replace(/\/$/, "");
const ORIGINS = (Deno.env.get("KT_ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const DAILY = Number(Deno.env.get("KT_AI_DAILY_LIMIT") || "60");
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const SYSTEM = `당신은 아마추어 축구팀 코치를 돕는 전술 분석가이자 전술 보드 애니메이터입니다.
코치가 한국어로 적은 상황·전술 설명을 읽고, 전술 보드에서 재생할 "장면" 데이터로 바꿔 draw_tactic 도구로 제출합니다.
반드시 draw_tactic 도구를 한 번 호출해서 답하세요. 다른 설명 글은 쓰지 않습니다.

[좌표계]
- 경기장 비율 좌표 [x, y]. x: 0 = 왼쪽 터치라인, 1 = 오른쪽 터치라인 (우리 팀이 위로 공격하는 화면 기준).
- y: 0 = 상대 골라인(화면 위), 1 = 우리 골라인(화면 아래). 우리 팀은 y 가 작아지는 방향(위)으로 공격합니다.
- 실제 크기: 가로 68m = x 1.0, 세로 105m = y 1.0. 거리 감각: 10m ≈ x 0.15 ≈ y 0.095.
- 기준점: 하프라인 y 0.5, 센터 서클 중심 (0.5,0.5).
  상대 페널티 박스 x 0.204~0.796, y 0~0.157 / 골 에어리어 x 0.365~0.635, y 0~0.052 / 페널티 스폿 (0.5,0.105) / 골문 x 0.446~0.554, y 0.
  우리 페널티 박스 y 0.843~1 (x 동일) / 우리 골문 y 1.
  하프스페이스 x ≈ 0.30 과 0.70, 측면 x < 0.15 또는 > 0.85.
- 좌표는 소수 셋째 자리까지. 선수끼리는 0.04 이상 떨어뜨립니다(같은 자리 겹침 금지).

[선수]
- 우리 팀 키: 사용자 메시지의 our 목록에 있는 k 값(예: gk, lb, lcb, rcb, rb, dm, lcm, rcm, lw, st, rw). 등번호(num)·이름(name)·포지션(pos)이 함께 옵니다.
  코치가 "7번", "오른쪽 윙어", 이름 등으로 부르면 해당 키로 연결하세요. 등번호가 가장 확실한 기준입니다.
- 상대 키: b1~b11. 순서는 상대 포메이션 표(forms)의 포지션 순서를 따릅니다. 상대는 아래(우리 골)로 공격하므로
  상대의 LB/LW/LM 은 화면 오른쪽(x 큼), RB/RW/RM 은 화면 왼쪽(x 작음)에 섭니다. 상대 GK 는 y 0.03 근처.
- 공 소유자(owner): 선수 키, 또는 공이 떠 있거나 슈팅/클리어 중이면 "" 와 ball 좌표.

[장면 만들기 규칙]
- 각 장면(step)은 "그 순간이 끝났을 때의 모습"입니다. 앞 장면에서 바뀐 선수만 our/opp 에 적고, 적지 않은 선수는 그대로 있습니다.
- 한 장면에서 공은 한 번만 움직입니다(패스 1번, 또는 드리블, 또는 슈팅). 연속 패스는 장면을 나누세요.
- 장면은 보통 4~8개, 최대 12개. 움직임은 현실적으로: 한 장면에서 선수 이동은 대개 0.25 이내, 전력 질주 침투는 0.35까지.
- 드리블은 owner 를 그대로 두고 그 선수의 위치를 옮깁니다. 패스는 owner 를 받는 선수로 바꿉니다.
- 슈팅은 owner "" + ball 을 골문 안 좌표(예: [0.47, 0.0])로. 공간으로 보내는 패스는 받는 선수가 그 자리에 도착하도록 같은 장면에서 옮기고 owner 를 그 선수로.
- 상대도 현실적으로 반응시키세요: 공 쪽으로 슬라이드, 압박, 라인 유지/후퇴, 마크. 코치 글에 상대 움직임이 있으면 그대로 반영.
- 곡선 침투(돌아 뛰기, 대각선 휘어 들어가기)는 curves 에 그 선수의 곡선 오프셋 [dx, dy] (곡선 가운데가 직선 가운데에서 벗어나는 정도, 0.02~0.08).
- 핵심 공간(뒷공간, 하프스페이스, 받을 공간, 압박 함정 등)은 zones 로 표시(장면당 0~2개, 라벨 8자 이내).
  라인·삼각형 연결은 links(선수 키 2~4개). 꼭 필요할 때만.
- 장면 설명(note): 한국어 40자 이내, 영상 자막으로 나갑니다. "6번이 9번에게 전진 패스" 처럼 등번호로 쓰고, 왜 그렇게 하는지 핵심만.
- 코치 글이 짧거나 모호하면 아마추어 11인제에서 통하는 일반적인 방식으로 자연스럽게 채우세요. 글에 없는 무리한 장면은 만들지 마세요.

[시작 배치]
- mode 가 new 이면 start 에 우리 11명과 상대 11명 전체 위치, owner(또는 ball)를 적습니다. 상황(골킥, 코너킥, 프리킥, 역습, 빌드업, 수비 등)에 맞는 배치를 만드세요.
  사용자 메시지의 현재 배치는 참고용 기본값입니다(스쿼드 배치). 코너킥/프리킥이면 view 를 att(상대 진영) 또는 def(우리 진영)로.
- mode 가 append 이면 start 는 비우고, 현재 상태에서 이어지는 장면만 steps 에 적습니다.
- 상대 포메이션·성향이 글에 있으면 opp_formation / opp_style 에 반영(성향: high 전방 압박, mid 중간 블록, low 내려앉기, man 맨투맨).`;

const XY = { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 };
const POSMAP = { type: "object", additionalProperties: XY };
const TOOL = {
  name: "draw_tactic",
  description: "전술 보드에 그릴 시작 배치와 장면들을 제출한다.",
  input_schema: {
    type: "object",
    required: ["title", "steps"],
    properties: {
      title: { type: "string", description: "전술 이름 (한국어 20자 이내)" },
      category: { type: "string", enum: ["build", "set", "trans", "free"], description: "빌드업 / 세트피스 / 전환 / 자유" },
      opp_formation: { type: "string", enum: ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2", "4-1-4-1"] },
      opp_style: { type: "string", enum: ["high", "mid", "low", "man"] },
      view: { type: "string", enum: ["full", "att", "def"] },
      coach_note: { type: "string", description: "코치 글을 어떻게 해석했는지 한두 문장 (한국어)" },
      start: {
        type: "object",
        properties: {
          our: POSMAP, opp: POSMAP,
          owner: { type: "string" }, ball: XY,
        },
      },
      steps: {
        type: "array", minItems: 1, maxItems: 12,
        items: {
          type: "object", required: ["note"],
          properties: {
            note: { type: "string" },
            our: POSMAP, opp: POSMAP,
            owner: { type: "string", description: "이 장면 끝의 공 소유자 키, 공이 떠 있으면 \"\"" },
            ball: XY,
            curves: POSMAP,
            zones: { type: "array", maxItems: 3, items: { type: "object", required: ["x", "y", "w", "h"], properties: {
              x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
              label: { type: "string" }, color: { type: "string", enum: ["gold", "red", "blue", "mint"] } } } },
            links: { type: "array", maxItems: 3, items: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 } },
            highlight: { type: "array", items: { type: "string" }, maxItems: 3 },
          },
        },
      },
    },
  },
};

function cors(origin: string) {
  const ok = !ORIGINS.length || ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? (origin || "*") : (ORIGINS[0] || "*"),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(body: unknown, status: number, h: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...h, "Content-Type": "application/json; charset=utf-8" } });
}
async function dailyHit(): Promise<number> {
  if (!SB_URL || !SB_SERVICE) return 0;
  try {
    const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
    const r = await fetch(`${SB_URL}/rest/v1/rpc/kt_ai_hit`, {
      method: "POST",
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ _day: day }),
    });
    if (!r.ok) return 0; // 함수가 없으면 한도 없이 동작
    return Number(await r.json()) || 0;
  } catch { return 0; }
}
function pickPlan(content: Array<Record<string, unknown>>) {
  for (const b of content || []) if (b.type === "tool_use" && b.name === "draw_tactic") return b.input;
  for (const b of content || []) {
    if (b.type !== "text") continue;
    const t = String(b.text || ""), i = t.indexOf("{"), j = t.lastIndexOf("}");
    if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch { /* 다음 */ } }
  }
  return null;
}

Deno.serve(async (req) => {
  const origin = (req.headers.get("origin") || "").replace(/\/$/, "");
  const h = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405, h);
  if (ORIGINS.length && !ORIGINS.includes(origin)) return json({ ok: false, error: "origin", msg: "허용되지 않은 사이트입니다" }, 403, h);
  if (!API_KEY) return json({ ok: false, error: "nokey", msg: "AI 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)" }, 500, h);

  let body: { mode?: string; text?: string; state?: unknown };
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad", msg: "요청 형식 오류" }, 400, h); }
  if (body?.mode === "ping") return json({ ok: true, model: MODEL }, 200, h);
  const text = String(body?.text || "").trim().slice(0, 2000);
  const state = JSON.stringify(body?.state ?? {});
  if (!text) return json({ ok: false, error: "empty", msg: "내용이 비어 있습니다" }, 400, h);
  if (state.length > 24000) return json({ ok: false, error: "big", msg: "보드 정보가 너무 큽니다" }, 400, h);

  const n = await dailyHit();
  if (DAILY > 0 && n > DAILY) return json({ ok: false, error: "limit", msg: `오늘 AI 사용 한도(${DAILY}회)를 넘었습니다` }, 429, h);

  const mode = body.mode === "append" ? "append" : "new";
  const user = `mode: ${mode}\n\n[코치 글]\n${text}\n\n[현재 보드 상태 JSON]\n${state}`;
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 16000, system: SYSTEM,
        tools: [TOOL], tool_choice: { type: "auto" },
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (e) {
    return json({ ok: false, error: "network", msg: "AI 서버에 연결하지 못했습니다", detail: String(e) }, 502, h);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = (data as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
    return json({ ok: false, error: "api", status: res.status, msg: "AI 호출 실패: " + m }, 502, h);
  }
  const plan = pickPlan((data as { content?: Array<Record<string, unknown>> }).content || []);
  if (!plan) return json({ ok: false, error: "parse", msg: "AI 답을 장면으로 바꾸지 못했습니다. 다시 시도해 주세요", stop: (data as { stop_reason?: string }).stop_reason }, 502, h);
  return json({ ok: true, plan, model: MODEL, ms: Date.now() - t0, usage: (data as { usage?: unknown }).usage || null, today: n }, 200, h);
});
