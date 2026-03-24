import {
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue-demi";
import { createVoicePageAgent, type VoicePageAgentController } from "./controller";
import type {
  VoicePageAgentButtonStyleOptions,
  VoicePageAgentButtonTextOptions,
  VoicePageAgentOptions,
  VoicePageAgentState,
} from "./types";

const VOICE_PAGE_AGENT_KEY = "VOICE_PAGE_AGENT_INSTANCE";
const VOICE_PAGE_AGENT_STYLE_ID = "voice-page-agent-style";

const VOICE_PAGE_AGENT_STYLE_TEXT = `
.voice-page-agent-root {
  --voice-page-agent-wake-bg: linear-gradient(135deg, #22c1ff, #3366ff);
  --voice-page-agent-wake-color: #ffffff;
  --voice-page-agent-open-bg: linear-gradient(135deg, #ffa84a, #ff5f6d);
  --voice-page-agent-open-color: #ffffff;
  --voice-page-agent-status-color: #e2e8f0;
  --voice-page-agent-surface-bg: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.9));
  --voice-page-agent-surface-border: rgba(148, 163, 184, 0.3);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid var(--voice-page-agent-surface-border);
  background: var(--voice-page-agent-surface-bg);
  box-shadow:
    0 16px 34px -26px rgba(15, 23, 42, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.voice-page-agent-root::before {
  content: "";
  position: absolute;
  inset: -35% -10% auto;
  height: 58%;
  background: radial-gradient(ellipse at center, rgba(56, 189, 248, 0.2), rgba(56, 189, 248, 0));
  pointer-events: none;
}

.voice-page-agent-actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.voice-page-agent-btn {
  border: 0;
  border-radius: 999px;
  padding: 9px 16px;
  font-size: 13px;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: 0.1px;
  cursor: pointer;
  box-shadow:
    0 10px 20px -14px rgba(15, 23, 42, 1),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
  transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
}

.voice-page-agent-btn--wake {
  background: var(--voice-page-agent-wake-bg);
  color: var(--voice-page-agent-wake-color);
}

.voice-page-agent-btn--open {
  background: var(--voice-page-agent-open-bg);
  color: var(--voice-page-agent-open-color);
}

.voice-page-agent-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
  box-shadow:
    0 14px 24px -14px rgba(15, 23, 42, 0.95),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.voice-page-agent-btn:active {
  transform: translateY(0);
  filter: brightness(0.98);
}

.voice-page-agent-status {
  margin: 0;
  position: relative;
  z-index: 1;
  color: var(--voice-page-agent-status-color);
  font-size: 13px;
  line-height: 1.4;
  opacity: 0.95;
}
`;

type VoicePageAgentButtonResolvedConfig = {
  startText: string;
  wakeOnText: string;
  openText: string;
  wakeButtonBackground: string;
  wakeButtonTextColor: string;
  openButtonBackground: string;
  openButtonTextColor: string;
};

const DEFAULT_BUTTON_CONFIG: VoicePageAgentButtonResolvedConfig = {
  startText: "开启语音唤醒",
  wakeOnText: "语音唤醒中",
  openText: "网页助手",
  wakeButtonBackground: "linear-gradient(135deg, #22c1ff, #3366ff)",
  wakeButtonTextColor: "#ffffff",
  openButtonBackground: "linear-gradient(135deg, #ffa84a, #ff5f6d)",
  openButtonTextColor: "#ffffff",
};

let globalButtonConfig: VoicePageAgentButtonResolvedConfig = {
  ...DEFAULT_BUTTON_CONFIG,
};

let defaultController: VoicePageAgentController | null = null;

type Vue2Ctor = {
  prototype: Record<string, unknown>;
  component?: (name: string, component: unknown) => void;
  mixin?: (options: unknown) => void;
};

function ensureButtonStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(VOICE_PAGE_AGENT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = VOICE_PAGE_AGENT_STYLE_ID;
  style.textContent = VOICE_PAGE_AGENT_STYLE_TEXT;
  document.head.appendChild(style);
}

function resolveButtonConfig(options?: {
  buttonText?: VoicePageAgentButtonTextOptions;
  buttonStyle?: VoicePageAgentButtonStyleOptions;
}): VoicePageAgentButtonResolvedConfig {
  return {
    startText: options?.buttonText?.startText ?? DEFAULT_BUTTON_CONFIG.startText,
    wakeOnText: options?.buttonText?.wakeOnText ?? DEFAULT_BUTTON_CONFIG.wakeOnText,
    openText: options?.buttonText?.openText ?? DEFAULT_BUTTON_CONFIG.openText,
    wakeButtonBackground:
      options?.buttonStyle?.wakeButtonBackground ?? DEFAULT_BUTTON_CONFIG.wakeButtonBackground,
    wakeButtonTextColor:
      options?.buttonStyle?.wakeButtonTextColor ?? DEFAULT_BUTTON_CONFIG.wakeButtonTextColor,
    openButtonBackground:
      options?.buttonStyle?.openButtonBackground ?? DEFAULT_BUTTON_CONFIG.openButtonBackground,
    openButtonTextColor:
      options?.buttonStyle?.openButtonTextColor ?? DEFAULT_BUTTON_CONFIG.openButtonTextColor,
  };
}

function applyGlobalButtonConfig(options?: VoicePageAgentOptions) {
  globalButtonConfig = resolveButtonConfig({
    buttonText: options?.buttonText,
    buttonStyle: options?.buttonStyle,
  });
}

function attachToApp(target: unknown, controller: VoicePageAgentController) {
  ensureButtonStyles();
  const anyTarget = target as Record<string, unknown> & Vue2Ctor & {
    config?: { globalProperties?: Record<string, unknown> };
    provide?: (key: string, value: unknown) => void;
    component?: (name: string, component: unknown) => void;
  };
  if ("config" in anyTarget && anyTarget.config?.globalProperties) {
    anyTarget.config.globalProperties.$voicePageAgent = controller;
    anyTarget.provide?.(VOICE_PAGE_AGENT_KEY, controller);
    anyTarget.component?.("VoicePageAgentButton", VoicePageAgentButton);
    return;
  }

  anyTarget.prototype.$voicePageAgent = controller;
  anyTarget.component?.("VoicePageAgentButton", VoicePageAgentButton);
  anyTarget.mixin?.({
    provide() {
      return {
        [VOICE_PAGE_AGENT_KEY]: controller,
      };
    },
  });
}

export function useVoicePageAgent() {
  const injected = inject<VoicePageAgentController | null>(VOICE_PAGE_AGENT_KEY, null);
  if (injected) return injected;
  const instance = getCurrentInstance();
  const proxy = instance?.proxy as
    | (Record<string, unknown> & { $voicePageAgent?: VoicePageAgentController })
    | undefined;
  if (proxy?.$voicePageAgent) return proxy.$voicePageAgent;
  if (defaultController) return defaultController;
  throw new Error("voice-page-agent: controller not found, please install plugin first.");
}

export const VoicePageAgentButton = defineComponent({
  name: "VoicePageAgentButton",
  props: {
    showStatus: {
      type: Boolean,
      default: true,
    },
    startText: {
      type: String,
      default: undefined,
    },
    wakeOnText: {
      type: String,
      default: undefined,
    },
    openText: {
      type: String,
      default: undefined,
    },
    wakeButtonBackground: {
      type: String,
      default: undefined,
    },
    wakeButtonTextColor: {
      type: String,
      default: undefined,
    },
    openButtonBackground: {
      type: String,
      default: undefined,
    },
    openButtonTextColor: {
      type: String,
      default: undefined,
    },
  },
  setup(props) {
    ensureButtonStyles();
    const controller = useVoicePageAgent();
    const state = ref<VoicePageAgentState>(controller.snapshot);
    let off: (() => void) | null = null;

    onMounted(() => {
      off = controller.onStateChange((next) => {
        state.value = next;
      });
    });

    onBeforeUnmount(() => {
      off?.();
      off = null;
    });

    const handleWakeClick = () => {
      if (state.value.enabled) {
        controller.stopWake();
      } else {
        void controller.startWake();
      }
    };

    const handleOpenClick = () => {
      void controller.openAgent();
    };

    return () => {
      const resolvedStartText = props.startText ?? globalButtonConfig.startText;
      const resolvedWakeOnText = props.wakeOnText ?? globalButtonConfig.wakeOnText;
      const resolvedOpenText = props.openText ?? globalButtonConfig.openText;
      const resolvedWakeButtonBackground =
        props.wakeButtonBackground ?? globalButtonConfig.wakeButtonBackground;
      const resolvedWakeButtonTextColor =
        props.wakeButtonTextColor ?? globalButtonConfig.wakeButtonTextColor;
      const resolvedOpenButtonBackground =
        props.openButtonBackground ?? globalButtonConfig.openButtonBackground;
      const resolvedOpenButtonTextColor =
        props.openButtonTextColor ?? globalButtonConfig.openButtonTextColor;

      const rootStyle: Record<string, string> = {
        "--voice-page-agent-wake-bg": resolvedWakeButtonBackground,
        "--voice-page-agent-wake-color": resolvedWakeButtonTextColor,
        "--voice-page-agent-open-bg": resolvedOpenButtonBackground,
        "--voice-page-agent-open-color": resolvedOpenButtonTextColor,
      };

      return h("div", { class: "voice-page-agent-root", style: rootStyle }, [
        h("div", { class: "voice-page-agent-actions" }, [
          state.value.supported && !state.value.micPermissionGranted
            ? h(
                "button",
                {
                  type: "button",
                  class: "voice-page-agent-btn voice-page-agent-btn--wake",
                  onClick: handleWakeClick,
                },
                state.value.enabled ? resolvedWakeOnText : resolvedStartText
              )
            : null,
          h(
            "button",
            {
              type: "button",
              class: "voice-page-agent-btn voice-page-agent-btn--open",
              onClick: handleOpenClick,
            },
            resolvedOpenText
          ),
        ]),
        props.showStatus
          ? h("p", { class: "voice-page-agent-status" }, state.value.message)
          : null,
      ]);
    };
  },
});

export type VoicePageAgentPlugin = {
  install: (app: unknown, options?: VoicePageAgentOptions) => void;
  controller?: VoicePageAgentController;
};

export function createVoicePageAgentPlugin(options: VoicePageAgentOptions): VoicePageAgentPlugin {
  applyGlobalButtonConfig(options);
  const controller = createVoicePageAgent(options);
  defaultController = controller;

  return {
    install(app: unknown) {
      attachToApp(app, controller);
    },
    controller,
  };
}

const VoicePageAgentVuePlugin: VoicePageAgentPlugin = {
  install(app: unknown, options?: VoicePageAgentOptions) {
    if (!options) {
      throw new Error("voice-page-agent: install options is required.");
    }
    applyGlobalButtonConfig(options);
    const plugin = createVoicePageAgentPlugin(options);
    VoicePageAgentVuePlugin.controller = plugin.controller;
    attachToApp(app, plugin.controller as VoicePageAgentController);
  },
};

export default VoicePageAgentVuePlugin;
