/**
 * Unit tests for statusBarStyle module
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRegisterPlugin = vi.fn(() => ({
  setStyle: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  registerPlugin: mockRegisterPlugin,
}));

describe('statusBarStyle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Style.Dark equals "DARK"', async () => {
    const { Style } = await import('../statusBarStyle');
    expect(Style.Dark).toBe('DARK');
  });

  it('Style.Light equals "LIGHT"', async () => {
    const { Style } = await import('../statusBarStyle');
    expect(Style.Light).toBe('LIGHT');
  });

  it('Style.Default equals "DEFAULT"', async () => {
    const { Style } = await import('../statusBarStyle');
    expect(Style.Default).toBe('DEFAULT');
  });

  it('Style object has exactly 3 properties', async () => {
    const { Style } = await import('../statusBarStyle');
    expect(Object.keys(Style)).toHaveLength(3);
  });

  it('Style values are const string literals (not generic string)', async () => {
    const { Style } = await import('../statusBarStyle');
    const values = Object.values(Style);
    expect(values).toEqual(['DARK', 'LIGHT', 'DEFAULT']);
  });

  it('registers the StatusBarStyle plugin via registerPlugin', async () => {
    vi.resetModules();
    await import('../statusBarStyle');
    expect(mockRegisterPlugin).toHaveBeenCalledWith('StatusBarStyle');
  });

  it('exports StatusBarStyle as the registered plugin instance', async () => {
    vi.resetModules();
    const pluginInstance = { setStyle: vi.fn() };
    mockRegisterPlugin.mockReturnValue(pluginInstance);
    const { StatusBarStyle } = await import('../statusBarStyle');
    expect(StatusBarStyle).toBe(pluginInstance);
  });
});
