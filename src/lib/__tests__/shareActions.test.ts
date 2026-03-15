import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────
vi.mock('@/lib/platform', () => ({
  isNative: false,
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: vi.fn() },
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
    readdir: vi.fn().mockResolvedValue({ files: [] }),
  },
  Directory: { Cache: 'CACHE' },
}));

import { downloadImage, shareImage, copyImageToClipboard, cleanupShareCache } from '../shareActions';

// ─── Helpers ────────────────────────────────────────────────────

function createMockBlob(content = 'test', type = 'image/png'): Blob {
  return new Blob([content], { type });
}

// ─── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();

  // Reset URL.createObjectURL / revokeObjectURL
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

// ─── Tests ──────────────────────────────────────────────────────

describe('downloadImage', () => {
  it('creates a temporary link element and clicks it', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(n => n);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(n => n);

    const blob = createMockBlob();
    downloadImage(blob);

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('uses default filename when none provided', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      const link = node as HTMLAnchorElement;
      expect(link.download).toBe('zenflow-share.png');
      return node;
    });
    vi.spyOn(document.body, 'removeChild').mockImplementation(n => n);

    downloadImage(createMockBlob());

    appendSpy.mockRestore();
  });

  it('uses custom filename when provided', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      const link = node as HTMLAnchorElement;
      expect(link.download).toBe('custom.png');
      return node;
    });
    vi.spyOn(document.body, 'removeChild').mockImplementation(n => n);

    downloadImage(createMockBlob(), 'custom.png');

    appendSpy.mockRestore();
  });

  it('revokes object URL after download', () => {
    vi.spyOn(document.body, 'appendChild').mockImplementation(n => n);
    vi.spyOn(document.body, 'removeChild').mockImplementation(n => n);

    downloadImage(createMockBlob());

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe('shareImage (web platform)', () => {
  it('falls back to download when Web Share API is not available', async () => {
    // Ensure navigator.share is undefined
    const origShare = navigator.share;
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, writable: true, configurable: true });

    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(n => n);
    vi.spyOn(document.body, 'removeChild').mockImplementation(n => n);

    const result = await shareImage(createMockBlob(), 'Test Title');
    expect(result).toBe(false);
    expect(appendSpy).toHaveBeenCalled(); // download fallback triggered

    appendSpy.mockRestore();
    Object.defineProperty(navigator, 'share', { value: origShare, writable: true, configurable: true });
  });

  it('returns false when web share throws AbortError', async () => {
    const abortError = new DOMException('User cancelled', 'AbortError');
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(abortError),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn().mockReturnValue(true),
      writable: true,
      configurable: true,
    });

    const result = await shareImage(createMockBlob(), 'Title');
    expect(result).toBe(false);
  });
});

describe('copyImageToClipboard', () => {
  it('returns true on successful clipboard write', async () => {
    // jsdom may not have ClipboardItem — mock it globally
    const mockClipboardItem = vi.fn();
    vi.stubGlobal('ClipboardItem', mockClipboardItem);

    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: writeMock },
      writable: true,
      configurable: true,
    });

    const result = await copyImageToClipboard(createMockBlob());
    expect(result).toBe(true);
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it('returns false when clipboard write fails', async () => {
    const mockClipboardItem = vi.fn();
    vi.stubGlobal('ClipboardItem', mockClipboardItem);

    Object.defineProperty(navigator, 'clipboard', {
      value: { write: vi.fn().mockRejectedValue(new Error('denied')) },
      writable: true,
      configurable: true,
    });

    const result = await copyImageToClipboard(createMockBlob());
    expect(result).toBe(false);
  });

  it('calls clipboard.write with an array containing a ClipboardItem', async () => {
    const mockClipboardItem = vi.fn();
    vi.stubGlobal('ClipboardItem', mockClipboardItem);

    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: writeMock },
      writable: true,
      configurable: true,
    });

    const blob = createMockBlob();
    await copyImageToClipboard(blob);

    expect(writeMock).toHaveBeenCalledTimes(1);
    const args = writeMock.mock.calls[0][0];
    expect(args).toHaveLength(1);
    // Verify ClipboardItem was constructed with image/png blob
    expect(mockClipboardItem).toHaveBeenCalledWith({ 'image/png': blob });
  });
});

describe('cleanupShareCache (web platform)', () => {
  it('completes without error on web', async () => {
    await expect(cleanupShareCache()).resolves.toBeUndefined();
  });
});
