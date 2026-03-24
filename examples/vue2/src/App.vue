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

    <VoicePageAgentButton />
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
      await this.$voicePageAgent.openAgent();
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

