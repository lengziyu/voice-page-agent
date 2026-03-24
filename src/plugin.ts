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
  --voice-page-agent-wake-bg: linear-gradient(135deg, #7f67ff, #5a8dff);
  --voice-page-agent-wake-color: #ffffff;
  --voice-page-agent-open-bg: linear-gradient(180deg, #ffffff, #f7f4ff);
  --voice-page-agent-open-color: #30264d;
  --voice-page-agent-status-color: #5f5a79;

  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.voice-page-agent-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 10px;
}

.voice-page-agent-btn {
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 10px 16px;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
  white-space: nowrap;
  user-select: none;
}

.voice-page-agent-btn--wake {
  background: var(--voice-page-agent-wake-bg);
  color: var(--voice-page-agent-wake-color);
  border-color: rgba(129, 111, 214, 0.4);
  box-shadow:
    0 8px 20px -14px rgba(95, 77, 170, 0.8),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.voice-page-agent-btn--open {
  background: var(--voice-page-agent-open-bg);
  color: var(--voice-page-agent-open-color);
  border-color: rgba(169, 149, 255, 0.48);
  box-shadow:
    0 8px 18px -14px rgba(102, 80, 188, 0.7),
    0 2px 8px rgba(155, 129, 247, 0.18);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 10px 20px;
}

.voice-page-agent-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.01);
}

.voice-page-agent-btn:active {
  transform: translateY(0);
  filter: brightness(0.99);
}

.voice-page-agent-open-icon {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid #9d84ff;
  color: #9d84ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
  box-sizing: border-box;
}

.voice-page-agent-open-icon::before {
  content: "✦";
}

.voice-page-agent-open-label {
  line-height: 1;
}

.voice-page-agent-status {
  margin: 0;
  max-width: min(420px, calc(100vw - 24px));
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(180, 166, 255, 0.56);
  background: rgba(250, 248, 255, 0.9);
  color: var(--voice-page-agent-status-color);
  font-size: 15px;
  line-height: 1.4;
  box-shadow: 0 8px 20px -18px rgba(98, 78, 170, 0.7);
  backdrop-filter: blur(6px);
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
  wakeButtonBackground: "linear-gradient(135deg, #7f67ff, #5a8dff)",
  wakeButtonTextColor: "#ffffff",
  openButtonBackground: "linear-gradient(180deg, #ffffff, #f7f4ff)",
  openButtonTextColor: "#30264d",
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

function resolveClickProps(handler: () => void): Record<string, unknown> {
  return {
    // Vue3
    onClick: handler,
    // Vue2 render function listeners
    on: {
      click: handler,
    },
  };
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
      void controller.toggleAgentPanel();
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
                  ...resolveClickProps(handleWakeClick),
                },
                state.value.enabled ? resolvedWakeOnText : resolvedStartText
              )
            : null,
          h(
            "button",
            {
              type: "button",
              class: "voice-page-agent-btn voice-page-agent-btn--open",
              ...resolveClickProps(handleOpenClick),
            },
            [
              h("span", { class: "voice-page-agent-open-icon", "aria-hidden": "true" }),
              h("span", { class: "voice-page-agent-open-label" }, resolvedOpenText),
            ]
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
