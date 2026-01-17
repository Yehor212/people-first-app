import { registerPlugin } from '@capacitor/core';
import type { WidgetPlugin, WidgetData } from './widgetTypes';

// Re-export types for convenience
export type { WidgetData, WidgetPlugin } from './widgetTypes';

const Widget = registerPlugin<WidgetPlugin>('Widget', {
  web: () => import('./WidgetWeb').then(m => new m.WidgetWeb()),
});

export default Widget;
