import {
  BEAT_THE_BOT_INTAKE_SUBMITTED,
  BEAT_THE_BOT_VALIDATION_RESULT,
} from "../shared/messages";
import { VARIANT_COUNT, validateIntake, type IntakePayload } from "../shared/variants";
import anchorLogoUrl from "../assets/anchor-logo.png";

type Lane = "human" | "generic" | "anchor";

const LANE_LABEL: Record<Lane, string> = {
  human: "You",
  generic: "Computer-use",
  anchor: "Anchor",
};

type LaneState = {
  status: "idle" | "running" | "done";
  startedAt: number | null;
  endedAt: number | null;
  steps: number;
};

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  const frac = Math.floor((ms % 1000) / 100);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}.${frac}`;
}

function el(html: string): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function randomVariantIndex(): number {
  return Math.floor(Math.random() * VARIANT_COUNT);
}

export class PlayerApp {
  private variant = 0;
  private humanTab: "data" | "form" = "data";
  private running = false;
  private runComplete = false;
  private runStartedAt: number | null = null;
  private runEndedAt: number | null = null;

  private tickHandle: number | null = null;
  private mockHandles: Record<"generic" | "anchor", number | null> = {
    generic: null,
    anchor: null,
  };

  private lanes: Record<Lane, LaneState> = {
    human: { status: "idle", startedAt: null, endedAt: null, steps: 0 },
    generic: { status: "idle", startedAt: null, endedAt: null, steps: 0 },
    anchor: { status: "idle", startedAt: null, endedAt: null, steps: 0 },
  };

  private logLines: Record<"generic" | "anchor", string[]> = {
    generic: [],
    anchor: [],
  };

  private root: HTMLElement;
  private dataFrame: HTMLIFrameElement;
  private formFrame: HTMLIFrameElement;
  private dataPanel: HTMLElement;
  private formPanel: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = container;
    container.appendChild(this.renderShell());
    this.dataFrame = container.querySelector("#bt-frame-data") as HTMLIFrameElement;
    this.formFrame = container.querySelector("#bt-frame-form") as HTMLIFrameElement;
    this.dataPanel = container.querySelector("#bt-panel-data") as HTMLElement;
    this.formPanel = container.querySelector("#bt-panel-form") as HTMLElement;
    this.bind();
    this.renderMetrics();
    this.updateRunClock();
  }

  private renderShell(): HTMLElement {
    return el(`
      <div class="bt-wrap">
        <div class="bt-app" id="bt-app">
        <header class="bt-top">
          <div class="bt-brand">
            <div class="bt-brand-row">
              <img
                class="bt-brand-logo"
                src="${anchorLogoUrl}"
                width="120"
                height="21"
                alt=""
                decoding="async"
              />
              <div class="bt-brand-text">
                <h1>Beat the Bot</h1>
              </div>
            </div>
          </div>
          <span id="bt-run-clock-value" hidden></span>
          <span id="bt-variant-badge" hidden></span>
        </header>

        <div class="bt-main">
          <section class="bt-player" aria-label="Your run">
            <div class="bt-player-head">
              <div class="bt-player-head-text">
                <h2 class="bt-player-title">Your run</h2>
                <p class="bt-player-sub">Human · in-page browser</p>
              </div>
            </div>
            <div class="bt-player-content">
            <div class="bt-human-body">
              <div class="bt-tabs" role="tablist">
                <button type="button" class="bt-tab" id="bt-tab-data" role="tab" aria-selected="true">Data</button>
                <button type="button" class="bt-tab" id="bt-tab-form" role="tab" aria-selected="false">Form</button>
              </div>
              <div class="bt-frame-wrap" id="bt-panel-data">
                <iframe id="bt-frame-data" title="Data manifest"></iframe>
              </div>
              <div class="bt-frame-wrap" id="bt-panel-form" hidden>
                <iframe id="bt-frame-form" title="Intake form"></iframe>
              </div>
              <p class="bt-human-hint" id="bt-human-hint"></p>
            </div>
            <div class="bt-player-intro" id="bt-player-intro" role="region" aria-labelledby="bt-player-intro-title">
              <div class="bt-player-intro-card">
                <p class="bt-player-intro-kicker">Before you start</p>
                <h3 class="bt-player-intro-title" id="bt-player-intro-title">How to play</h3>
                <p class="bt-player-intro-lead">
                  Complete the intake as fast as you can. The run timer starts when you press
                  <strong>Start game</strong> — same moment for all three lanes.
                </p>
                <ul class="bt-player-intro-list">
                  <li>We pick a <strong>random manifest</strong> (${VARIANT_COUNT} variants).</li>
                  <li>Use <strong>Data</strong> and <strong>Form</strong> — copy fields, then category and tags from the notes.</li>
                  <li>Submit <strong>correct</strong> answers; your time stops on the first valid submit.</li>
                </ul>
                <button type="button" class="bt-btn bt-btn-primary bt-player-intro-cta" id="bt-player-start">
                  Start game
                </button>
              </div>
            </div>
            </div>
          </section>

          <aside class="bt-agents" aria-label="Automated lanes">
            <p class="bt-agents-heading">Agents <span class="bt-badge">Mock</span></p>
            <div class="bt-agents-stack">
              <section class="bt-agent" aria-label="Computer-use agent">
                <div class="bt-agent-head generic">
                  <span class="bt-agent-name">Computer-use</span>
                </div>
                <div class="bt-agent-body">
                  <div class="bt-chrome">
                    <div class="bt-dots"><span></span><span></span><span></span></div>
                    <div class="bt-url" id="bt-url-generic">about:blank</div>
                  </div>
                  <div class="bt-viewport generic">
                    <div class="bt-shimmer"></div>
                    <p class="bt-mock-title">Browser view</p>
                  </div>
                  <div class="bt-log" id="bt-log-generic" aria-live="polite"></div>
                </div>
              </section>

              <section class="bt-agent" aria-label="Anchor agent">
                <div class="bt-agent-head anchor">
                  <img
                    class="bt-anchor-logo"
                    src="${anchorLogoUrl}"
                    width="120"
                    height="21"
                    alt="Anchor"
                    decoding="async"
                  />
                </div>
                <div class="bt-agent-body">
                  <div class="bt-chrome">
                    <div class="bt-dots"><span></span><span></span><span></span></div>
                    <div class="bt-url" id="bt-url-anchor">about:blank</div>
                  </div>
                  <div class="bt-viewport anchor">
                    <div class="bt-shimmer"></div>
                    <p class="bt-mock-title">Task automation</p>
                  </div>
                  <div class="bt-log" id="bt-log-anchor" aria-live="polite"></div>
                </div>
              </section>
            </div>
          </aside>
        </div>

        <footer class="bt-footer" id="bt-metrics"></footer>

        <div class="bt-modal" id="bt-results" hidden role="dialog" aria-modal="true" aria-labelledby="bt-results-title">
          <div class="bt-modal-backdrop" id="bt-results-backdrop"></div>
          <div class="bt-modal-card">
            <h2 class="bt-results-title" id="bt-results-title">Run complete</h2>
            <p class="bt-results-winner" id="bt-results-winner"></p>
            <table class="bt-results-table" aria-label="Results">
              <thead>
                <tr>
                  <th scope="col">Lane</th>
                  <th scope="col">Time</th>
                  <th scope="col">AI steps</th>
                </tr>
              </thead>
              <tbody id="bt-results-body"></tbody>
            </table>
            <div class="bt-modal-actions">
              <button type="button" class="bt-btn bt-btn-primary" id="bt-results-again">Play again</button>
            </div>
          </div>
        </div>
        </div>
      </div>
    `);
  }

  private bind(): void {
    this.root.querySelector("#bt-player-start")?.addEventListener("click", () => this.startGameFromIntro());

    window.addEventListener("message", (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.type !== BEAT_THE_BOT_INTAKE_SUBMITTED) return;
      if (!this.running || this.runComplete) return;
      if (this.lanes.human.status === "done") return;

      const payload = ev.data.payload as IntakePayload;
      const result = validateIntake(this.variant, payload);

      const sendResult = () => {
        this.formFrame.contentWindow?.postMessage(
          {
            type: BEAT_THE_BOT_VALIDATION_RESULT,
            ok: result.ok,
            errors: result.errors,
          },
          window.location.origin,
        );
      };

      sendResult();
      window.setTimeout(sendResult, 0);

      if (result.ok) {
        this.completeHumanOnCorrectSubmit();
      } else {
        this.updateHumanHint();
      }
    });

    this.root.querySelector("#bt-tab-data")?.addEventListener("click", () => this.setHumanTab("data"));
    this.root.querySelector("#bt-tab-form")?.addEventListener("click", () => this.setHumanTab("form"));

    this.root.querySelector("#bt-results-again")?.addEventListener("click", () => {
      this.hideResults();
      this.returnToIntro();
    });
    this.root.querySelector("#bt-results-backdrop")?.addEventListener("click", () => this.hideResults());
  }

  private updateVariantBadge(): void {
    const badge = this.root.querySelector("#bt-variant-badge") as HTMLElement | null;
    if (badge) {
      badge.textContent = `Variant ${this.variant + 1} / ${VARIANT_COUNT}`;
    }
  }

  private resetVariantBadge(): void {
    const badge = this.root.querySelector("#bt-variant-badge") as HTMLElement | null;
    if (badge) badge.textContent = "Variant —";
  }

  private setPlayerIntroVisible(visible: boolean): void {
    const layer = this.root.querySelector("#bt-player-intro") as HTMLElement | null;
    if (!layer) return;
    layer.hidden = !visible;
    layer.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  /** Random variant, load sites, hide overlay, start timed run. */
  private startGameFromIntro(): void {
    this.variant = randomVariantIndex();
    this.updateVariantBadge();
    this.updateIframes();
    this.setHumanTab("data");
    this.setPlayerIntroVisible(false);
    this.startRun();

    window.setTimeout(() => {
      (this.root.querySelector("#bt-tab-data") as HTMLButtonElement | null)?.focus();
    }, 80);
  }

  private returnToIntro(): void {
    this.resetRunState();
    this.clearIframes();
    this.resetVariantBadge();
    this.setPlayerIntroVisible(true);

    this.hideResults();
    window.setTimeout(() => {
      (this.root.querySelector("#bt-player-start") as HTMLButtonElement | null)?.focus();
    }, 50);
  }

  private clearIframes(): void {
    this.dataFrame.src = "about:blank";
    this.formFrame.src = "about:blank";
  }

  private setHumanTab(tab: "data" | "form"): void {
    this.humanTab = tab;
    const dBtn = this.root.querySelector("#bt-tab-data") as HTMLButtonElement;
    const fBtn = this.root.querySelector("#bt-tab-form") as HTMLButtonElement;
    dBtn.setAttribute("aria-selected", tab === "data" ? "true" : "false");
    fBtn.setAttribute("aria-selected", tab === "form" ? "true" : "false");
    this.dataPanel.hidden = tab !== "data";
    this.formPanel.hidden = tab !== "form";
  }

  private baseUrl(): string {
    return window.location.origin;
  }

  private updateIframes(): void {
    const q = `v=${this.variant}`;
    this.dataFrame.src = `${this.baseUrl()}/data-site/index.html?${q}`;
    this.formFrame.src = `${this.baseUrl()}/form-site/index.html?${q}`;
  }

  private startRun(): void {
    if (this.running || this.runComplete) return;

    this.running = true;
    this.runComplete = false;
    this.runEndedAt = null;
    const now = performance.now();
    this.runStartedAt = now;

    (["human", "generic", "anchor"] as const).forEach((lane) => {
      this.lanes[lane] = {
        status: "running",
        startedAt: now,
        endedAt: null,
        steps: 0,
      };
    });
    this.logLines.generic = [];
    this.logLines.anchor = [];
    this.clearLogs();
    this.setMockUrls("… loading mock scenario …");

    this.startMockAgents();
    window.setTimeout(() => {
      const origin = this.baseUrl();
      const q = this.variant;
      this.setMockUrlsGeneric(`${origin}/data-site/index.html?v=${q}`);
      this.setMockUrlsAnchor(`${origin}/form-site/index.html?v=${q}`);
    }, 400);

    this.startTicker();
    this.renderMetrics();
    this.updateRunClock();
    this.updateHumanHint();
  }

  private resetRunState(): void {
    this.running = false;
    this.runComplete = false;
    this.runStartedAt = null;
    this.runEndedAt = null;

    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    this.stopMockAgents();
    (["human", "generic", "anchor"] as const).forEach((lane) => {
      this.lanes[lane] = { status: "idle", startedAt: null, endedAt: null, steps: 0 };
    });
    this.clearLogs();
    this.setMockUrls("about:blank");
    this.renderMetrics();
    this.updateRunClock();
    this.updateHumanHint();
  }

  /** Correct intake submit stops the clock for the human lane. */
  private completeHumanOnCorrectSubmit(): void {
    if (!this.running || this.runComplete) return;
    if (this.lanes.human.status !== "running") return;

    this.lanes.human.status = "done";
    this.lanes.human.endedAt = performance.now();
    this.renderMetrics();
    this.updateHumanHint();
    this.tryFinishRun();
  }

  private allLanesDone(): boolean {
    return (
      this.lanes.human.status === "done" &&
      this.lanes.generic.status === "done" &&
      this.lanes.anchor.status === "done"
    );
  }

  private tryFinishRun(): void {
    if (!this.running || this.runComplete) return;
    if (!this.allLanesDone()) return;

    this.runComplete = true;
    this.running = false;
    this.runEndedAt = performance.now();

    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }

    this.renderMetrics();
    this.updateRunClock();
    this.showResults();
  }

  private laneDurationMs(lane: Lane): number {
    const s = this.lanes[lane];
    if (s.startedAt === null) return 0;
    const end = s.endedAt ?? (this.running ? performance.now() : s.startedAt);
    return Math.max(0, end - s.startedAt);
  }

  private startTicker(): void {
    if (this.tickHandle !== null) window.clearInterval(this.tickHandle);
    this.tickHandle = window.setInterval(() => {
      this.renderMetrics();
      this.updateRunClock();
    }, 100);
  }

  private updateRunClock(): void {
    const el = this.root.querySelector("#bt-run-clock-value") as HTMLElement | null;
    if (!el) return;

    if (this.runStartedAt === null) {
      el.textContent = "\u2014";
      return;
    }

    if (this.runComplete && this.runEndedAt !== null) {
      el.textContent = formatDuration(this.runEndedAt - this.runStartedAt);
      return;
    }

    if (this.running) {
      el.textContent = formatDuration(performance.now() - this.runStartedAt);
      return;
    }

    el.textContent = formatDuration(0);
  }

  private updateHumanHint(): void {
    const hint = this.root.querySelector("#bt-human-hint") as HTMLElement | null;
    if (!hint) return;

    const introEl = this.root.querySelector("#bt-player-intro") as HTMLElement | null;
    const introOn = Boolean(introEl && !introEl.hidden);
    if (introOn) {
      hint.innerHTML = "";
      return;
    }

    if (!this.running || this.runComplete) {
      hint.innerHTML =
        "When the run ends, use <strong>Play again</strong> in the results dialog to return to the instructions.";
      return;
    }
    if (this.lanes.human.status === "done") {
      hint.innerHTML = "<strong>Time recorded.</strong> Waiting for other lanes…";
      return;
    }
    hint.innerHTML =
      "Submit the <strong>Form</strong> with the <strong>correct</strong> manifest values, category, and tags — your time stops on a <strong>correct</strong> submit.";
  }

  private renderMetrics(): void {
    const foot = this.root.querySelector("#bt-metrics") as HTMLElement;
    const rows: { lane: Lane; label: string; cls: string }[] = [
      { lane: "human", label: LANE_LABEL.human, cls: "human" },
      { lane: "generic", label: LANE_LABEL.generic, cls: "generic" },
      { lane: "anchor", label: LANE_LABEL.anchor, cls: "anchor" },
    ];
    foot.replaceChildren(
      ...rows.map(({ lane, label, cls }) => {
        const s = this.lanes[lane];
        const durMs = this.laneDurationMs(lane);
        const st =
          s.status === "idle" ? "Idle" : s.status === "running" ? "Running" : "Done";
        const stCls = s.status === "running" ? "run" : s.status === "done" ? "done" : "";
        const stepsDisplay = lane === "human" ? "—" : String(s.steps);
        return el(`
          <div class="bt-stat ${cls}">
            <div class="bt-stat-row">
              <span class="bt-stat-name">${label}</span>
              <span class="bt-stat-status ${stCls}">${st}</span>
            </div>
            <div class="bt-stat-row bt-stat-metrics">
              <span class="bt-stat-metric"><span class="bt-stat-k">Time</span> <strong>${formatDuration(durMs)}</strong></span>
              <span class="bt-stat-metric"><span class="bt-stat-k">AI steps</span> <strong>${stepsDisplay}</strong></span>
            </div>
          </div>
        `);
      }),
    );
  }

  private startMockAgents(): void {
    let genStep = 0;
    let ancStep = 0;

    this.mockHandles.generic = window.setInterval(() => {
      if (!this.running || this.runComplete || this.lanes.generic.status !== "running") return;
      genStep += 1;
      this.lanes.generic.steps += 27 + (genStep % 9);
      const lines = [
        `[${new Date().toISOString().slice(11, 23)}] observe → screenshot`,
        `[${new Date().toISOString().slice(11, 23)}] llm: plan next tool call`,
        `[${new Date().toISOString().slice(11, 23)}] tool: scroll / click (token use ↑↑)`,
      ];
      this.pushLog("generic", lines[genStep % lines.length]);
      if (genStep >= 22) this.finishMockLane("generic", this.lanes.generic.steps);
    }, 750);

    this.mockHandles.anchor = window.setInterval(() => {
      if (!this.running || this.runComplete || this.lanes.anchor.status !== "running") return;
      ancStep += 1;
      this.lanes.anchor.steps = ancStep;
      const lines = [
        `[${new Date().toISOString().slice(11, 23)}] task graph: resolve step ${ancStep}`,
        `[${new Date().toISOString().slice(11, 23)}] fill manifest fields (deterministic)`,
        `[${new Date().toISOString().slice(11, 23)}] heal selector · retry 0`,
      ];
      this.pushLog("anchor", lines[ancStep % lines.length]);
      if (ancStep >= 12) this.finishMockLane("anchor", ancStep);
    }, 340);
  }

  private finishMockLane(lane: "generic" | "anchor", steps: number): void {
    if (this.lanes[lane].status !== "running") return;
    this.lanes[lane].status = "done";
    this.lanes[lane].endedAt = performance.now();
    this.lanes[lane].steps = steps;
    this.pushLog(lane, `[done] mock completion — replace with real telemetry`);
    if (this.mockHandles[lane] !== null) {
      window.clearInterval(this.mockHandles[lane]!);
      this.mockHandles[lane] = null;
    }
    this.renderMetrics();
    this.tryFinishRun();
  }

  private stopMockAgents(): void {
    (["generic", "anchor"] as const).forEach((lane) => {
      if (this.mockHandles[lane] !== null) {
        window.clearInterval(this.mockHandles[lane]!);
        this.mockHandles[lane] = null;
      }
    });
  }

  private setMockUrls(text: string): void {
    (this.root.querySelector("#bt-url-generic") as HTMLElement).textContent = text;
    (this.root.querySelector("#bt-url-anchor") as HTMLElement).textContent = text;
  }

  private setMockUrlsGeneric(u: string): void {
    (this.root.querySelector("#bt-url-generic") as HTMLElement).textContent = u;
  }

  private setMockUrlsAnchor(u: string): void {
    (this.root.querySelector("#bt-url-anchor") as HTMLElement).textContent = u;
  }

  private pushLog(lane: "generic" | "anchor", line: string): void {
    this.logLines[lane].push(line);
    if (this.logLines[lane].length > 12) this.logLines[lane].shift();
    const node = this.root.querySelector(`#bt-log-${lane}`) as HTMLElement;
    node.innerHTML = this.logLines[lane].map((l) => `<div class="line">${escapeHtml(l)}</div>`).join("");
    node.scrollTop = node.scrollHeight;
  }

  private clearLogs(): void {
    this.logLines.generic = [];
    this.logLines.anchor = [];
    (this.root.querySelector("#bt-log-generic") as HTMLElement).innerHTML = "";
    (this.root.querySelector("#bt-log-anchor") as HTMLElement).innerHTML = "";
  }

  private showResults(): void {
    const modal = this.root.querySelector("#bt-results") as HTMLElement;
    const winnerEl = this.root.querySelector("#bt-results-winner") as HTMLElement;
    const tbody = this.root.querySelector("#bt-results-body") as HTMLElement;

    const times: Record<Lane, number> = {
      human: this.laneDurationMs("human"),
      generic: this.laneDurationMs("generic"),
      anchor: this.laneDurationMs("anchor"),
    };

    const minT = Math.min(times.human, times.generic, times.anchor);
    const winners = (Object.keys(times) as Lane[]).filter((l) => times[l] === minT);
    const names = winners.map((l) => LANE_LABEL[l]);

    if (winners.length === 1) {
      winnerEl.textContent = `Fastest: ${names[0]} (${formatDuration(minT)})`;
    } else {
      winnerEl.textContent = `Tie — ${names.join(" & ")} at ${formatDuration(minT)}`;
    }

    tbody.replaceChildren(
      ...(["human", "generic", "anchor"] as Lane[]).map((lane) => {
        const tr = document.createElement("tr");
        const steps = lane === "human" ? "—" : String(this.lanes[lane].steps);
        tr.innerHTML = `
          <td>${LANE_LABEL[lane]}</td>
          <td>${formatDuration(times[lane])}</td>
          <td>${steps}</td>
        `;
        return tr;
      }),
    );

    modal.hidden = false;
    (this.root.querySelector("#bt-results-again") as HTMLButtonElement).focus();
  }

  private hideResults(): void {
    const modal = this.root.querySelector("#bt-results") as HTMLElement;
    modal.hidden = true;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const mount = document.getElementById("app");
if (mount) new PlayerApp(mount);
