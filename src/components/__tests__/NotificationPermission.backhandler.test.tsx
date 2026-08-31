import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { NotificationPermission } from '@/components/NotificationPermission';

const notificationMocks = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  storageGetRaw: vi.fn(),
  storageSetRaw: vi.fn(),
  activeBackClose: null as null | (() => void),
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: notificationMocks.checkPermissions,
    requestPermissions: notificationMocks.requestPermissions,
  },
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      ariaNotificationPermission: 'Notification permission',
      close: 'Close',
    },
  }),
}));

vi.mock('@/lib/platform', () => ({ isNative: true }));
vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/hooks/useScrollLock', () => ({ useScrollLock: vi.fn() }));
vi.mock('@/lib/safeJson', () => ({
  storageGetRaw: notificationMocks.storageGetRaw,
  storageSetRaw: notificationMocks.storageSetRaw,
}));
vi.mock('@/hooks/useModalState', () => ({
  useModalClose: (isOpen: boolean, onClose: () => void) => {
    notificationMocks.activeBackClose = isOpen ? onClose : null;
    return {
      modalProps: {
        role: 'dialog' as const,
        'aria-modal': true,
      },
    };
  },
}));

describe('NotificationPermission — Android Back Handler (Law 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationMocks.activeBackClose = null;
    notificationMocks.storageGetRaw.mockReturnValue(null);
    notificationMocks.checkPermissions.mockResolvedValue({ display: 'prompt' });
  });

  it('routes Android Back through the composite modal owner exactly once', () => {
    const source = readFileSync('src/components/NotificationPermission.tsx', 'utf8');
    expect(source).toContain('from "@/hooks/useModalState"');
    expect(source).not.toContain('from "@/hooks/useBackHandler"');
    expect(source).not.toMatch(/\buseBackHandler\s*\(/);
  });

  it('wires the composite owner to showPrompt and a Back-only cancel callback', () => {
    const source = readFileSync('src/components/NotificationPermission.tsx', 'utf8');
    expect(source).toMatch(/useModalClose\(\s*showPrompt\s*,\s*handleBackCancel\s*\)/);
  });

  it('closes on Android Back without persisting denial or completing the gate', async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    render(<NotificationPermission onComplete={onComplete} onCancel={onCancel} />);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(notificationMocks.activeBackClose).toBeTypeOf('function');

    act(() => notificationMocks.activeBackClose?.());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(notificationMocks.storageSetRaw).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('lets AuthGate dismiss only the current-session UI without persisting completion', () => {
    const source = readFileSync('src/components/AuthGate.tsx', 'utf8');

    expect(source).toContain('notificationPermissionDismissedForSession');
    expect(source).toMatch(
      /!notificationPermissionChecked\s*&&\s*!notificationPermissionDismissedForSession/,
    );
    expect(source).toMatch(
      /onCancel=\{\(\) => setNotificationPermissionDismissedForSession\(true\)\}/,
    );
  });

  it('keeps the native permission dialog reachable at short viewport heights', () => {
    const source = readFileSync('src/components/NotificationPermission.tsx', 'utf8');

    expect(source).toContain('overflow-y-auto');
    expect(source).toContain('overscroll-contain');
    expect(source).toContain('var(--safe-top)');
    expect(source).toContain('var(--safe-bottom)');
    expect(source).toContain('var(--safe-inline-start)');
    expect(source).toContain('var(--safe-inline-end)');
    expect(source).toContain('relative my-auto');
    expect(source).toContain('h-auto min-h-12 w-full min-w-0');
    expect(source).toContain('whitespace-normal break-words');
  });
});
