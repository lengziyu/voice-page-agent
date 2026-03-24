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
import type { VoicePageAgentOptions, VoicePageAgentState } from "./types";

const VOICE_PAGE_AGENT_KEY = "VOICE_PAGE_AGENT_INSTANCE";

let defaultController: VoicePageAgentController | null = null;

type Vue2Ctor = {
  prototype: Record<string, unknown>;
  component?: (name: string, component: unknown) => void;
  mixin?: (options: unknown) => void;
};

function attachToApp(target: unknown, controller: VoicePageAgentController) {
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
      default: "开启语音唤醒",
    },
    wakeOnText: {
      type: String,
      default: "语音唤醒中",
    },
    openText: {
      type: String,
      default: "网页助手",
    },
  },
  setup(props) {
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

    return () =>
      h("div", { class: "voice-page-agent-root" }, [
        h("div", { class: "voice-page-agent-actions" }, [
          state.value.supported && !state.value.micPermissionGranted
            ? h(
                "button",
                {
                  type: "button",
                  class: "voice-page-agent-btn",
                  onClick: handleWakeClick,
                },
                state.value.enabled ? props.wakeOnText : props.startText
              )
            : null,
          h(
            "button",
            {
              type: "button",
              class: "voice-page-agent-btn",
              onClick: handleOpenClick,
            },
            props.openText
          ),
        ]),
        props.showStatus
          ? h("p", { class: "voice-page-agent-status" }, state.value.message)
          : null,
      ]);
  },
});

export type VoicePageAgentPlugin = {
  install: (app: unknown, options?: VoicePageAgentOptions) => void;
  controller?: VoicePageAgentController;
};

export function createVoicePageAgentPlugin(options: VoicePageAgentOptions): VoicePageAgentPlugin {
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
    const plugin = createVoicePageAgentPlugin(options);
    VoicePageAgentVuePlugin.controller = plugin.controller;
    attachToApp(app, plugin.controller as VoicePageAgentController);
  },
};

export default VoicePageAgentVuePlugin;
