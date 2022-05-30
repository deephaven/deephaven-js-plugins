import React, { useCallback, useEffect } from 'react';
import shortid from 'shortid';
import {
  DashboardPluginComponentProps,
  LayoutUtils,
  useListener,
} from '@deephaven/dashboard';
import { VariableDefinition } from '@deephaven/jsapi-shim';
import Log from '@deephaven/log';
import MatPlotLibPanel from './MatPlotLibPanel';

const log = Log.module('@deephaven/js-plugin-matplotlib.DashboardPlugin');

export const DashboardPlugin = ({
  id,
  layout,
  registerComponent,
}: DashboardPluginComponentProps): JSX.Element => {
  const handlePanelOpen = useCallback(
    ({
      dragEvent,
      fetch,
      panelId = shortid.generate(),
      widget,
    }: {
      dragEvent?: DragEvent;
      fetch: () => Promise<unknown>;
      panelId?: string;
      widget: VariableDefinition;
    }) => {
      const { id: widgetId, name, type } = widget;
      if (type === dh.VariableType.TABLE || type === dh.VariableType.FIGURE) {
        // Just ignore table and figure types - only want interesting other types
        return;
      }
      log.info('Panel opened of type', type);
      const metadata = { id: widgetId, name, type };
      const config = {
        type: 'react-component',
        component: MatPlotLibPanel.COMPONENT,
        props: {
          localDashboardId: id,
          id: panelId,
          metadata,
          fetch,
        },
        title: name,
        id: panelId,
      };

      const { root } = layout;
      LayoutUtils.openComponent({ root, config, dragEvent });
    },
    [id, layout]
  );

  useEffect(() => {
    const cleanups = [
      registerComponent(MatPlotLibPanel.COMPONENT, MatPlotLibPanel),
    ];

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [registerComponent]);

  useListener(layout.eventHub, 'PanelEvent.OPEN', handlePanelOpen);

  return <></>;
};

export default DashboardPlugin;
