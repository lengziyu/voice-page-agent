<template>
  <main class="page">
    <h1>voice-page-agent (Vue3)</h1>
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

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { useVoicePageAgent, type VoicePageAgentState } from "voice-page-agent";

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

const startWake = async () => {
  await controller.startWake();
};

const stopWake = () => {
  controller.stopWake();
};

const openAgent = async () => {
  await controller.openAgent();
};

const runDemo = async () => {
  await controller.runCommand("打开工具页面");
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
