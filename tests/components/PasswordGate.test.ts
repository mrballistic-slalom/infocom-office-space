import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordGate from '@/components/PasswordGate.vue';

function mountGate(): ReturnType<typeof mount> {
  return mount(PasswordGate);
}

describe('PasswordGate.vue', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the prompt and an input', () => {
    const wrapper = mountGate();
    expect(wrapper.find('.gate-banner').text()).toContain('AUTHORIZATION');
    expect(wrapper.find('input[type=password]').exists()).toBe(true);
  });

  it('emits @authenticated on correct password (server returns ok:true)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, token: 'srv-token' }),
      }),
    );
    const wrapper = mountGate();
    const input = wrapper.find<HTMLInputElement>('input[type=password]');
    await input.setValue('***REDACTED***');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    // 350ms fade before emit fires.
    await vi.advanceTimersByTimeAsync(400);
    expect(wrapper.emitted('authenticated')).toBeTruthy();
    expect(sessionStorage.getItem('initech-terminal:auth')).toBe('srv-token');
  });

  it('does NOT emit @authenticated on wrong password and shows a denial flash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ ok: false }),
      }),
    );
    const wrapper = mountGate();
    const input = wrapper.find<HTMLInputElement>('input[type=password]');
    await input.setValue('wrong');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    await vi.advanceTimersByTimeAsync(50);
    expect(wrapper.emitted('authenticated')).toBeFalsy();
    expect(wrapper.find('.gate-denied').exists()).toBe(true);
    expect(wrapper.find('.gate-denied').text()).toContain('ACCESS DENIED');
    // Input clears so the user can retry.
    expect(input.element.value).toBe('');
  });

  it('skips the gate entirely when a session token already exists', async () => {
    sessionStorage.setItem('initech-terminal:auth', 'already-here');
    const wrapper = mountGate();
    await flushPromises();
    expect(wrapper.emitted('authenticated')).toBeTruthy();
  });

  it('ignores empty submissions', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const wrapper = mountGate();
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
