<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { createAuthService } from '@/services/auth';

// Password is validated server-side by the /api/auth Lambda. The literal never
// appears in this bundle — only the result (a session token) is stored locally.
const auth = createAuthService();

const emit = defineEmits<{ (e: 'authenticated'): void }>();

const inputEl = ref<HTMLInputElement | null>(null);
const value = ref('');
const attempts = ref(0);
const showDenied = ref(false);
const checking = ref(false);
const fading = ref(false);

onMounted(() => {
  // Already-authenticated session — skip the gate entirely.
  if (auth.hasToken()) {
    emit('authenticated');
    return;
  }
  nextTick(() => inputEl.value?.focus());
});

async function onSubmit(): Promise<void> {
  if (checking.value) return;
  const guess = value.value.trim();
  if (!guess) return;

  checking.value = true;
  const ok = await auth.authenticate(guess);
  checking.value = false;

  if (ok) {
    fading.value = true;
    setTimeout(() => emit('authenticated'), 350);
    return;
  }

  attempts.value += 1;
  showDenied.value = true;
  value.value = '';
  setTimeout(() => {
    showDenied.value = false;
    nextTick(() => inputEl.value?.focus());
  }, 1200);
}

const deniedMessage = computed(() => {
  if (attempts.value === 1) return 'ACCESS DENIED.';
  if (attempts.value === 2) return 'ACCESS DENIED. Did you get the memo?';
  if (attempts.value === 3) return 'ACCESS DENIED. I\'m gonna need you to try again, mmkay?';
  return `ACCESS DENIED. (${attempts.value} attempts)`;
});
</script>

<template>
  <div class="password-gate" :class="{ fading }">
    <div class="gate-frame">
      <div class="gate-header">INITECH INTERNAL SYSTEM</div>
      <div class="gate-divider">═══════════════════════════════════════════</div>
      <div class="gate-banner">AUTHORIZATION REQUIRED</div>
      <div class="gate-divider">═══════════════════════════════════════════</div>
      <div class="gate-hint">
        Unauthorized access is logged and reported to Bill Lumbergh.
      </div>
      <div class="gate-hint subtle">
        (hint: the soft-spoken gentleman in the break room)
      </div>

      <form class="gate-form" @submit.prevent="onSubmit">
        <span class="gate-prompt">PASSWORD:</span>
        <input
          ref="inputEl"
          v-model="value"
          type="password"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          maxlength="32"
          :disabled="checking || fading"
        />
        <span class="block-cursor" aria-hidden="true" />
      </form>

      <div v-if="showDenied" class="gate-denied">{{ deniedMessage }}</div>
    </div>
  </div>
</template>

<style scoped>
.password-gate {
  position: fixed;
  inset: 0;
  z-index: 25;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--crt-bg);
  color: var(--crt-amber);
  font-family: 'VT323', 'Courier New', monospace;
  transition: opacity 350ms ease-out;
}
.password-gate.fading {
  opacity: 0;
  pointer-events: none;
}

.gate-frame {
  max-width: 640px;
  width: calc(100% - 48px);
  padding: 32px 28px;
  text-align: left;
  font-size: 20px;
  line-height: 1.4;
}

.gate-header {
  font-size: 22px;
  letter-spacing: 2px;
  color: var(--crt-amber-bright);
  text-shadow: 0 0 12px var(--crt-amber-glow-strong);
  margin-bottom: 6px;
}
.gate-divider {
  color: var(--crt-gold);
  text-shadow: 0 0 8px rgba(255, 216, 102, 0.5);
}
.gate-banner {
  font-size: 24px;
  font-weight: bold;
  color: var(--crt-amber-bright);
  text-shadow: 0 0 14px var(--crt-amber-glow-strong);
  letter-spacing: 3px;
  margin: 6px 0;
}
.gate-hint {
  margin-top: 14px;
  color: var(--crt-amber);
  text-shadow: 0 0 6px var(--crt-amber-glow);
  font-size: 18px;
}
.gate-hint.subtle {
  margin-top: 6px;
  color: var(--crt-amber-dim);
  font-size: 16px;
}
.gate-form {
  display: flex;
  align-items: center;
  margin-top: 28px;
  gap: 10px;
}
.gate-prompt {
  color: var(--crt-amber);
  text-shadow: 0 0 8px var(--crt-amber-glow);
  letter-spacing: 1px;
}
.gate-form input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--crt-green);
  font-family: 'VT323', 'Courier New', monospace;
  font-size: 22px;
  caret-color: var(--crt-amber);
  text-shadow: 0 0 6px rgba(136, 255, 170, 0.5);
  letter-spacing: 6px;
}
.gate-denied {
  margin-top: 18px;
  color: var(--crt-orange);
  text-shadow: 0 0 10px rgba(255, 136, 68, 0.6);
  font-size: 20px;
  animation: gate-denied-flash 1200ms ease-out 1;
}

@keyframes gate-denied-flash {
  0%   { opacity: 0; transform: translateX(0); }
  10%  { opacity: 1; transform: translateX(-2px); }
  20%  { transform: translateX(2px); }
  30%  { transform: translateX(-2px); }
  40%  { transform: translateX(0); }
  100% { opacity: 1; }
}
</style>
