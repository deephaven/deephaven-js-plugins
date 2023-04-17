import { useCallback, DragEvent, useEffect } from 'react';
import shortid from 'shortid';
import {
  DashboardPluginComponentProps,
  LayoutUtils,
  PanelEvent,
  useListener,
} from '@deephaven/dashboard';
import { VariableDefinition } from '@deephaven/jsapi-shim';
import PlotlyExpressChartPanel, {
  type PlotlyChartWidget,
} from './PlotlyExpressChartPanel';

export type PlotlyChartPluginProps = Partial<DashboardPluginComponentProps>;

export function DashboardPlugin(
  props: PlotlyChartPluginProps
): JSX.Element | null {
  const { id, layout, registerComponent } = props;

  const handlePanelOpen = useCallback(
    async ({
      dragEvent,
      fetch,
      panelId = shortid.generate(),
      widget,
    }: {
      dragEvent?: DragEvent;
      fetch: () => Promise<PlotlyChartWidget>;
      panelId?: string;
      widget: VariableDefinition;
    }) => {
      const { type, title } = widget;
      if (type !== 'deephaven.plugin.chart.DeephavenFigure') {
        return;
      }

      const metadata = { name: title, figure: title, type };
      const config = {
        type: 'react-component' as const,
        component: 'PlotlyPanel',
        props: {
          localDashboardId: id,
          id: panelId,
          metadata,
          fetch,
        },
        title,
        id: panelId,
      };

      const { root } = layout;
      LayoutUtils.openComponent({ root, config, dragEvent });
    },
    [id, layout]
  );

  useEffect(
    function registerComponentsAndReturnCleanup() {
      const cleanups = [
        registerComponent('PlotlyPanel', PlotlyExpressChartPanel),
      ];
      return () => {
        cleanups.forEach(cleanup => cleanup());
      };
    },
    [registerComponent]
  );

  useListener(layout.eventHub, PanelEvent.OPEN, handlePanelOpen);

  return null;
}

export default DashboardPlugin;
