'use client';

import { ThemeSwitch, type ThemeSwitchProps } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** Keeps early clicks from choosing a theme before the provider resolves its initial value. */
export function ReadyThemeSwitch(props: ThemeSwitchProps) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const { resolvedTheme } = useTheme();
  return (
    <fieldset className="contents" disabled={!mounted || !resolvedTheme}>
      <ThemeSwitch {...props} />
    </fieldset>
  );
}
