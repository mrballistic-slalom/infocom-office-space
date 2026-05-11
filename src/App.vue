<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import PasswordGate from '@/components/PasswordGate.vue';
import CrtBootSequence from '@/components/CrtBootSequence.vue';
import Terminal from '@/components/Terminal.vue';
import { createPersistenceService } from '@/services/persistence';
import { useGameStore } from '@/stores/game';

const authenticated = ref(false);
const bootComplete = ref(false);
const fastBoot = ref(false);

const store = useGameStore();
const { authExpired } = storeToRefs(store);

onMounted(() => {
  const svc = createPersistenceService();
  fastBoot.value = svc.load() !== null;
});

// If the LLM endpoint hands back a 401 mid-game, kick back to the password gate.
watch(authExpired, (expired) => {
  if (expired) {
    authenticated.value = false;
    bootComplete.value = false;
    store.authExpired = false;
  }
});

function onAuthenticated(): void {
  authenticated.value = true;
}

function onBootComplete(): void {
  bootComplete.value = true;
}

// Micro-glitch loop (FR-029).
const glitchClass = ref('');
function scheduleGlitch(): void {
  const min = 15_000;
  const max = 30_000;
  const delay = min + Math.random() * (max - min);
  setTimeout(() => {
    glitchClass.value = 'crt-glitch-pulse';
    setTimeout(() => {
      glitchClass.value = '';
      scheduleGlitch();
    }, 80);
  }, delay);
}
onMounted(scheduleGlitch);
</script>

<template>
  <div class="crt-shell">
    <div class="crt-noise" />
    <div class="crt-vignette" />

    <div class="crt-flicker-base">
      <div class="crt-flicker-secondary">
        <div class="crt-glitch" :class="glitchClass">
          <Terminal v-if="authenticated && bootComplete" />
        </div>
      </div>
    </div>

    <CrtBootSequence
      v-if="authenticated && !bootComplete"
      :fast="fastBoot"
      @complete="onBootComplete"
    />

    <PasswordGate v-if="!authenticated" @authenticated="onAuthenticated" />
  </div>
</template>
