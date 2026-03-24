import type {
  ResolvedVoicePageAgentOptions,
  RuntimePageAgent,
  RuntimePageAgentCtor,
  VoicePageAgentOptions,
  VoicePageAgentState,
  VoiceStateListener,
} from "./types";

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
    length: number;
  }>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: Event & { error?: string }) => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type VoiceWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  pageAgent?: RuntimePageAgent;
};

const DEFAULT_WAKE_WORD = "布丁布丁";
const DEFAULT_OPTIONS: Omit<ResolvedVoicePageAgentOptions, "pageAgent"> = {
  wakeWord: [DEFAULT_WAKE_WORD],
  enableHomophoneMatch: true,
  wakeCooldownMs: 1400,
  commandInitialTimeoutMs: 12000,
  commandSilenceTimeoutMs: 2600,
  commandMaxWindowMs: 22000,
  recognitionLang: "zh-CN",
  showAgentWhenWake: true,
  autoStart: false,
};

const HOMOPHONE_VARIANTS: Record<string, string[]> = {
  布: ["补", "不", "步", "部"],
  丁: ["叮", "钉", "盯", "顶"],
  小: ["晓", "笑", "校", "筱"],
  班: ["般", "斑", "半"],
};

function normalizeText(text: string) {
  return (text || "")
    .toLowerCase()
    .replace(/[\s,，.。!！?？;；:：、"'`~\-_/\\]/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function levenshteinDistance(source: string, target: string) {
  const a = Array.from(source);
  const b = Array.from(target);
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function makeHomophoneRegex(words: string[]) {
  const fuzzyWords = words.map((word) => {
    const chars = Array.from(word);
    return chars
      .map((char) => {
        const variants = HOMOPHONE_VARIANTS[char] || [];
        const options = [char, ...variants].map((item) => escapeRegExp(item));
        return `(?:${options.join("|")})`;
      })
      .join("");
  });
  return new RegExp(fuzzyWords.join("|"));
}

function buildWakeRegex(words: string[]) {
  const items = words
    .map((word) => normalizeText(word))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((word) => escapeRegExp(word));
  const body = items.length ? items.join("|") : escapeRegExp(normalizeText(DEFAULT_WAKE_WORD));
  return {
    single: new RegExp(`(${body})`),
    global: new RegExp(`(${body})`, "g"),
  };
}

function resolveOptions(options: VoicePageAgentOptions): ResolvedVoicePageAgentOptions {
  if (!options?.pageAgent || typeof options.pageAgent !== "object") {
    throw new Error("voice-page-agent: options.pageAgent is required");
  }
  const wakeWordInput = options.wakeWord;
  const wakeWord = Array.isArray(wakeWordInput)
    ? wakeWordInput.filter(Boolean)
    : [wakeWordInput || DEFAULT_WAKE_WORD];

  return {
    ...DEFAULT_OPTIONS,
    ...options,
    pageAgent: options.pageAgent,
    wakeWord,
  };
}

export class VoicePageAgentController {
  private options: ResolvedVoicePageAgentOptions;
  private listeners = new Set<VoiceStateListener>();
  private state: VoicePageAgentState = {
    status: "off",
    message: "语音助手未开启",
    supported: false,
    enabled: false,
    micPermissionGranted: false,
  };

  private recognition: SpeechRecognitionLike | null = null;
  private initAgentPromise: Promise<RuntimePageAgent | null> | null = null;
  private voiceEnabled = false;
  private disposed = false;
  private awaitingCommand = false;
  private commandFinalText = "";
  private commandInterimText = "";
  private commandTimer: number | null = null;
  private commandDeadlineTimer: number | null = null;
  private restartBusy = false;
  private lastWakeAt = 0;
  private wakeRegex: { single: RegExp; global: RegExp };
  private wakeHomophoneRegex: RegExp | null;

  constructor(options: VoicePageAgentOptions) {
    this.options = resolveOptions(options);
    this.wakeRegex = buildWakeRegex(this.options.wakeWord);
    this.wakeHomophoneRegex = this.options.enableHomophoneMatch
      ? makeHomophoneRegex(this.options.wakeWord)
      : null;

    this.patchState({
      supported: this.hasSpeechSupport(),
      status: this.hasSpeechSupport() ? "off" : "unsupported",
      message: this.hasSpeechSupport()
        ? "语音助手未开启"
        : "当前浏览器不支持语音识别，建议使用 Chrome/Edge",
    });

    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("voice-page-agent-enabled");
      if (saved === "1" || this.options.autoStart) {
        void this.startWake();
      }
      void this.syncPermissionState();
    }
  }

  get snapshot() {
    return { ...this.state };
  }

  onStateChange(listener: VoiceStateListener) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async openAgent() {
    return this.ensureAgent();
  }

  async toggleAgentPanel() {
    if (typeof window === "undefined") return;
    if (this.isAgentPanelVisible()) {
      this.hideAgentPanel();
      return;
    }
    await this.openAgent();
  }

  async startWake() {
    if (this.disposed) return;
    if (!this.hasSpeechSupport()) {
      this.patchState({
        status: "unsupported",
        supported: false,
        message: "当前浏览器不支持语音识别，建议使用 Chrome/Edge",
      });
      return;
    }

    if (this.voiceEnabled) {
      this.patchState({
        status: "waking",
        enabled: true,
        message: `语音已开启，请说“${this.options.wakeWord[0]}”唤醒助手`,
      });
      return;
    }

    const granted = await this.requestMicrophonePermission();
    if (!granted) {
      this.patchState({
        status: "error",
        enabled: false,
        micPermissionGranted: false,
        message: "麦克风授权失败，请允许浏览器使用麦克风",
      });
      return;
    }

    const recognition = this.recognition || this.buildRecognition();
    if (!recognition) {
      this.patchState({
        status: "error",
        enabled: false,
        message: "语音识别初始化失败",
      });
      return;
    }
    this.recognition = recognition;
    this.voiceEnabled = true;

    this.patchState({
      status: "waking",
      enabled: true,
      micPermissionGranted: true,
      message: `语音已开启，请说“${this.options.wakeWord[0]}”唤醒助手`,
    });
    window.localStorage.setItem("voice-page-agent-enabled", "1");

    try {
      recognition.start();
    } catch {
      // noop: some browsers throw when calling start repeatedly
    }
  }

  stopWake() {
    this.voiceEnabled = false;
    this.awaitingCommand = false;
    this.commandFinalText = "";
    this.commandInterimText = "";
    this.clearCommandTimer();
    this.clearCommandDeadlineTimer();
    this.patchState({
      status: "off",
      enabled: false,
      message: "语音助手已关闭",
    });
    if (typeof window !== "undefined") {
      window.localStorage.setItem("voice-page-agent-enabled", "0");
    }
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  async runCommand(commandText: string) {
    await this.executeVoiceCommand(commandText);
  }

  dispose() {
    this.disposed = true;
    this.stopWake();
    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
    }
    this.listeners.clear();
  }

  private hasSpeechSupport() {
    if (typeof window === "undefined") return false;
    const runtimeWindow = window as VoiceWindow;
    return Boolean(runtimeWindow.SpeechRecognition || runtimeWindow.webkitSpeechRecognition);
  }

  private patchState(next: Partial<VoicePageAgentState>) {
    this.state = { ...this.state, ...next };
    const snapshot = this.snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private clearCommandTimer() {
    if (this.commandTimer !== null) {
      window.clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }
  }

  private clearCommandDeadlineTimer() {
    if (this.commandDeadlineTimer !== null) {
      window.clearTimeout(this.commandDeadlineTimer);
      this.commandDeadlineTimer = null;
    }
  }

  private composeCommandText() {
    return `${this.commandFinalText} ${this.commandInterimText}`.trim();
  }

  private scheduleFlushCommand(ms: number) {
    this.clearCommandTimer();
    this.commandTimer = window.setTimeout(() => {
      this.flushVoiceCommand();
    }, ms);
  }

  private scheduleCommandDeadline() {
    this.clearCommandDeadlineTimer();
    this.commandDeadlineTimer = window.setTimeout(() => {
      this.flushVoiceCommand();
    }, this.options.commandMaxWindowMs);
  }

  private flushVoiceCommand() {
    this.clearCommandTimer();
    this.clearCommandDeadlineTimer();
    const command = this.sanitizeVoiceCommand(this.composeCommandText());
    this.awaitingCommand = false;
    this.commandFinalText = "";
    this.commandInterimText = "";
    void this.executeVoiceCommand(command);
  }

  private isWakePhraseHit(text: string) {
    const normalized = normalizeText(text);
    if (!normalized) return false;
    if (this.options.wakeWord.some((word) => normalized.includes(normalizeText(word)))) {
      return true;
    }
    if (this.options.enableHomophoneMatch && this.wakeHomophoneRegex?.test(normalized)) {
      return true;
    }

    const candidates = this.options.wakeWord.map((word) => normalizeText(word));
    for (const candidate of candidates) {
      if (Math.abs(candidate.length - normalized.length) > 1) continue;
      if (levenshteinDistance(normalized, candidate) <= 1) {
        return true;
      }
    }
    return false;
  }

  private extractCommandAfterWake(text: string) {
    const source = (text || "").trim();
    if (!source) return "";
    const match = source.match(this.wakeRegex.single);
    if (!match || typeof match.index !== "number") return "";
    const rest = source.slice(match.index + match[0].length);
    return rest.replace(/^[\s,，.。!！?？;；:：、]+/, "").trim();
  }

  private sanitizeVoiceCommand(text: string) {
    return (text || "")
      .replace(this.wakeRegex.global, "")
      .replace(/^[\s,，.。!！?？;；:：、]+/, "")
      .trim();
  }

  private async requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  private async syncPermissionState() {
    if (!("permissions" in navigator) || !navigator.permissions?.query) return;
    try {
      const result = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      this.patchState({ micPermissionGranted: result.state === "granted" });
      result.onchange = () => {
        this.patchState({ micPermissionGranted: result.state === "granted" });
      };
    } catch {
      // noop
    }
  }

  private async ensureAgent() {
    if (typeof window === "undefined") return null;
    const runtimeWindow = window as VoiceWindow;
    const existingAgent = runtimeWindow.pageAgent;
    if (existingAgent) {
      const panelNode = document.getElementById("page-agent-runtime_agent-panel");
      const canReuse = Boolean(existingAgent.panel && panelNode?.isConnected && !existingAgent.disposed);
      if (canReuse && existingAgent.panel) {
        existingAgent.panel.show();
        existingAgent.panel.expand();
        return existingAgent;
      }
      // HMR or stale runtime instance might exist without panel.
      // Dispose and recreate to ensure `openAgent()` is always recoverable.
      try {
        existingAgent.dispose?.("RECREATE_WITH_PANEL");
      } catch {
        // noop
      }
      runtimeWindow.pageAgent = undefined;
    }
    if (this.initAgentPromise) return this.initAgentPromise;

    this.initAgentPromise = (async () => {
      const mod = await import("page-agent");
      const Agent = mod.PageAgent as unknown as RuntimePageAgentCtor;
      let agent: RuntimePageAgent;
      try {
        agent = new Agent(this.options.pageAgent);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err || "");
        const webglUnavailable = /webgl2 is required/i.test(message) || /webgl/i.test(message);
        if (!webglUnavailable) {
          throw err;
        }
        const fallbackConfig = {
          ...this.options.pageAgent,
          enableMask: false,
        };
        agent = new Agent(fallbackConfig);
      }
      runtimeWindow.pageAgent = agent;
      if (!agent.panel) {
        throw new Error("Page Agent panel is disabled. Set pageAgent.enablePanel=true.");
      }
      agent.panel.show();
      agent.panel.expand();
      return agent;
    })()
      .catch((err) => {
        console.error("[voice-page-agent] ensureAgent failed:", err);
        this.patchState({
          status: "error",
          message: this.resolveAgentInitErrorMessage(err),
        });
        return null;
      })
      .finally(() => {
        this.initAgentPromise = null;
      });

    return this.initAgentPromise;
  }

  private isAgentPanelVisible() {
    const panelNode = document.getElementById("page-agent-runtime_agent-panel");
    if (!panelNode) return false;
    const style = window.getComputedStyle(panelNode);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  private hideAgentPanel() {
    const runtimeWindow = window as VoiceWindow;
    const agent = runtimeWindow.pageAgent;
    if (agent?.panel) {
      agent.panel.collapse?.();
      agent.panel.hide?.();
    }
    const panelNode = document.getElementById("page-agent-runtime_agent-panel");
    if (panelNode) {
      panelNode.style.display = "none";
      panelNode.style.opacity = "0";
    }
  }

  private resolveAgentInitErrorMessage(error: unknown) {
    const raw = error instanceof Error ? error.message : String(error || "");
    if (/Cannot read properties of undefined \(reading 'indexOf'\)/i.test(raw)) {
      return "Page Agent 运行时依赖加载失败（旧版构建兼容问题），请升级 voice-page-agent 并重装依赖。";
    }
    return raw || "Page Agent 初始化失败";
  }

  private async executeVoiceCommand(rawCommand: string) {
    const command = this.sanitizeVoiceCommand(rawCommand);
    if (!command) {
      this.patchState({
        status: "waking",
        message: `未识别到指令，请再说一次“${this.options.wakeWord[0]}”`,
      });
      return;
    }

    this.patchState({
      status: "processing",
      message: `已识别：${command}`,
    });

    const agent = await this.ensureAgent();
    if (!agent) return;

    if (agent.status === "running") {
      this.patchState({
        status: "waking",
        message: "助手正在执行中，请稍后再说",
      });
      return;
    }

    try {
      await agent.execute(command);
      this.patchState({
        status: "waking",
        message: `任务已提交完成，继续等待“${this.options.wakeWord[0]}”`,
      });
    } catch (err) {
      this.patchState({
        status: "error",
        message: err instanceof Error ? err.message : "语音任务执行失败",
      });
    }
  }

  private buildRecognition() {
    const runtimeWindow = window as VoiceWindow;
    const Ctor = runtimeWindow.SpeechRecognition || runtimeWindow.webkitSpeechRecognition;
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.lang = this.options.recognitionLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      if (!this.voiceEnabled) return;
      this.patchState({
        status: "waking",
        message: `语音已开启，请说“${this.options.wakeWord[0]}”唤醒助手`,
      });
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const isFinal = Boolean(result?.isFinal);
        const transcript = String(result[0]?.transcript || "").trim();
        if (!transcript) continue;

        if (!this.awaitingCommand) {
          if (!this.isWakePhraseHit(transcript)) continue;
          const now = Date.now();
          if (now - this.lastWakeAt < this.options.wakeCooldownMs) continue;
          this.lastWakeAt = now;
          this.awaitingCommand = true;
          this.commandFinalText = "";
          this.commandInterimText = "";
          this.patchState({
            status: "listening_command",
            message: "已唤醒，请说出你的指令（可连续说更长内容）",
          });
          if (this.options.showAgentWhenWake) {
            void this.ensureAgent();
          }
          const inlineCommand = isFinal ? this.extractCommandAfterWake(transcript) : "";
          if (inlineCommand) {
            this.commandFinalText = inlineCommand;
            this.scheduleFlushCommand(this.options.commandSilenceTimeoutMs);
          } else {
            this.scheduleFlushCommand(this.options.commandInitialTimeoutMs);
          }
          this.scheduleCommandDeadline();
          continue;
        }

        if (isFinal) {
          this.commandFinalText = `${this.commandFinalText} ${transcript}`.trim();
          this.commandInterimText = "";
        } else {
          this.commandInterimText = transcript;
        }
        this.patchState({
          status: "listening_command",
          message: `正在识别：${this.composeCommandText() || "请继续说话..."}`,
        });
        this.scheduleFlushCommand(this.options.commandSilenceTimeoutMs);
      }
    };

    recognition.onerror = (event) => {
      const code = String(event.error || "");
      if (code === "no-speech" || code === "aborted") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        this.voiceEnabled = false;
        this.patchState({
          status: "error",
          enabled: false,
          micPermissionGranted: false,
          message: "麦克风权限被拒绝，请在浏览器设置中允许麦克风",
        });
        window.localStorage.setItem("voice-page-agent-enabled", "0");
        return;
      }
      this.patchState({
        status: "error",
        message: `语音识别异常：${code || "未知错误"}`,
      });
    };

    recognition.onend = () => {
      if (!this.voiceEnabled || this.disposed) return;
      if (this.restartBusy) return;
      this.restartBusy = true;
      window.setTimeout(() => {
        this.restartBusy = false;
        if (!this.voiceEnabled || this.disposed) return;
        try {
          recognition.start();
        } catch {
          // noop
        }
      }, 320);
    };

    return recognition;
  }
}

export function createVoicePageAgent(options: VoicePageAgentOptions) {
  return new VoicePageAgentController(options);
}
