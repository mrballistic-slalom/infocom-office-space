import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Terminal from '@/components/Terminal.vue';

describe('Terminal.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders header, output area, and input bar on mount', async () => {
    const wrapper = mount(Terminal);
    await vi.runOnlyPendingTimersAsync();

    expect(wrapper.find('.terminal-header').exists()).toBe(true);
    expect(wrapper.find('.terminal-header').text()).toContain('INITECH TERMINAL');
    expect(wrapper.find('.terminal-header').text()).toMatch(/MOVES:\s*0/);
    expect(wrapper.find('.terminal-output').exists()).toBe(true);
    expect(wrapper.find('.terminal-input-bar input').exists()).toBe(true);
    expect(wrapper.find('.block-cursor').exists()).toBe(true);
  });

  it('renders opening output lines after initialize', async () => {
    const wrapper = mount(Terminal);
    // Drain typewriter timers so lines commit.
    await vi.advanceTimersByTimeAsync(60_000);
    const text = wrapper.find('.terminal-output').text();
    expect(text).toContain('OFFICE SPACE');
    expect(text).toContain("Peter's Bedroom");
  });

  it('submits input via the form and clears the field', async () => {
    const wrapper = mount(Terminal);
    await vi.advanceTimersByTimeAsync(60_000); // drain intro typewriter

    const input = wrapper.find<HTMLInputElement>('.terminal-input-bar input');
    await input.setValue('west');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    await vi.runAllTimersAsync(); // drain reply typewriter

    expect(input.element.value).toBe('');
    expect(wrapper.find('.terminal-header').text()).toMatch(/MOVES:\s*1/);
    const text = wrapper.find('.terminal-output').text();
    expect(text).toContain('> west');
    expect(text).toContain("Peter's Living Room");
  });

  it('empty submit flushes the typewriter instead of submitting', async () => {
    const wrapper = mount(Terminal);
    // Don't drain — leave typewriter mid-render.
    const input = wrapper.find<HTMLInputElement>('.terminal-input-bar input');
    await input.setValue('');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    // After flush, MOVES should still be 0 (no command submitted).
    expect(wrapper.find('.terminal-header').text()).toMatch(/MOVES:\s*0/);
  });
});
