<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useGameStore } from '@/stores/game';
import { useTypewriter } from '@/composables/useTypewriter';

const store = useGameStore();
const { output, isParsing, restored } = storeToRefs(store);
const { moveCount } = storeToRefs(store);

const typer = useTypewriter();
const inputEl = ref<HTMLInputElement | null>(null);
const scrollEl = ref<HTMLDivElement | null>(null);
const inputValue = ref('');

// How many lines from `output` have already been enqueued to the typewriter.
let enqueuedCount = 0;

function enqueueNew(instant: boolean): void {
  const slice = output.value.slice(enqueuedCount);
  if (slice.length === 0) return;
  enqueuedCount = output.value.length;
  typer.enqueue(slice, { instant });
}

onMounted(() => {
  store.initialize();
  // If a session was restored, prefill typewriter rendered lines instantly.
  enqueueNew(restored.value);
  focusInput();
});

// Watch the array length, not the ref identity — Pinia mutates the array in place,
// so a default shallow watch on the ref would never fire.
watch(
  () => output.value.length,
  () => {
    enqueueNew(false);
  },
);

watch(
  () => typer.renderedLines.value.length,
  async () => {
    await nextTick();
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  },
);

function focusInput(): void {
  setTimeout(() => inputEl.value?.focus(), 0);
}

async function onSubmit(): Promise<void> {
  const v = inputValue.value;
  if (!v.trim()) {
    // Empty enter flushes typewriter.
    typer.flush();
    return;
  }
  inputValue.value = '';
  await store.submit(v);
}

function onShellClick(): void {
  focusInput();
}

function onKeydown(e: KeyboardEvent): void {
  // Any non-control key flushes if typing.
  if (typer.isTyping.value && e.key.length === 1) {
    typer.flush();
  }
}

// Phosphor decay classes (FR-038).
const totalRendered = computed(() => typer.renderedLines.value.length);
function decayClass(idx: number): string {
  const reverseIdx = totalRendered.value - 1 - idx;
  if (reverseIdx < 5) return '';
  if (reverseIdx < 20) return 'decay-recent';
  return 'decay-old';
}

const parsingLabel = computed(() => (isParsing.value ? '[parsing...]' : ''));
const inputPlaceholder = computed(() =>
  isParsing.value ? 'thinking...' : 'What do you do?',
);
</script>

<template>
  <div class="terminal" @click="onShellClick" @keydown="onKeydown" tabindex="-1">
    <header class="terminal-header">
      <span>INITECH TERMINAL v4.02</span>
      <span class="moves">MOVES: {{ moveCount }}</span>
    </header>

    <div class="terminal-output" ref="scrollEl">
      <div
        v-for="(line, i) in typer.renderedLines.value"
        :key="line.id"
        class="line"
        :class="[line.type, decayClass(i)]"
      >{{ line.text }}<span v-if="!line.done" class="caret">▌</span></div>
      <div v-if="isParsing" class="line parsing">{{ parsingLabel }}</div>
    </div>

    <form class="terminal-input-bar" @submit.prevent="onSubmit">
      <span class="prompt">&gt;</span>
      <input
        ref="inputEl"
        v-model="inputValue"
        type="text"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :disabled="isParsing"
        :placeholder="inputPlaceholder"
      />
      <span class="block-cursor" aria-hidden="true" />
    </form>
  </div>
</template>
