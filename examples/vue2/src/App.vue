<template>
  <main class="page">
    <h1>voice-page-agent (Vue2)</h1>
    <p>唤醒词：布丁布丁</p>

    <div class="actions">
      <button @click="startWake">开始唤醒</button>
      <button @click="stopWake">停止唤醒</button>
      <button @click="openAgent">打开助手</button>
      <button @click="runDemo">执行示例指令</button>
    </div>

    <p class="status">状态：{{ state.status }} | {{ state.message }}</p>

    <VoicePageAgentButton
      style="
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483640;
        width: min(360px, calc(100vw - 24px));
      "
    />
  </main>
</template>

<script>
export default {
  name: "App",
  data() {
    return {
      state: this.$voicePageAgent.snapshot,
      unwatch: null,
    };
  },
  mounted() {
    this.unwatch = this.$voicePageAgent.onStateChange((next) => {
      this.state = next;
    });
  },
  beforeDestroy() {
    if (this.unwatch) {
      this.unwatch();
      this.unwatch = null;
    }
  },
  methods: {
    async startWake() {
      await this.$voicePageAgent.startWake();
    },
    stopWake() {
      this.$voicePageAgent.stopWake();
    },
    async openAgent() {
      try {
        const agent = await this.$voicePageAgent.openAgent();
        const hasPanelNode = Boolean(document.getElementById("page-agent-runtime_agent-panel"));
        console.log("[voice-page-agent][vue2] openAgent", {
          hasPanelNode,
          hasPanelApi: Boolean(agent && agent.panel),
          state: this.$voicePageAgent.snapshot,
        });
        if (!hasPanelNode) {
          this.state = {
            ...this.state,
            status: "error",
            message: "未检测到 page-agent 面板节点，请查看控制台日志",
          };
        }
      } catch (error) {
        console.error("[voice-page-agent][vue2] openAgent failed", error);
        this.state = {
          ...this.state,
          status: "error",
          message: error instanceof Error ? error.message : "打开助手失败",
        };
      }
    },
    async runDemo() {
      await this.$voicePageAgent.runCommand("打开工具页面");
    },
  },
};
</script>

<style scoped>
.page {
  max-width: 880px;
  margin: 48px auto;
  padding: 0 20px;
  font-family: ui-sans-serif, system-ui, -apple-system;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

button {
  border: 1px solid #d8d8d8;
  background: #ffffff;
  border-radius: 999px;
  padding: 10px 16px;
  cursor: pointer;
}

.status {
  margin-top: 16px;
  color: #555;
}
</style>
