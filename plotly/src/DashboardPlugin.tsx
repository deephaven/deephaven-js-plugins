import React, { useCallback, useEffect } from 'react';
import shortid from 'shortid';
import {
  DashboardPluginComponentProps,
  LayoutUtils,
  PanelEvent,
  useListener,
} from '@deephaven/dashboard';
import { VariableDefinition } from '@deephaven/jsapi-shim';
import Log from '@deephaven/log';
import PlotlyChartPanel from './PlotlyChartPanel';

const log = Log.module('@deephaven/js-plugin-plotly.DashboardPlugin');

const PANEL_COMPONENT = 'PlotlyChartPanel';

const PLOTLY_WIDGET_TYPE = 'plotly.figure';

export type JsWidget = {
  type: string;
  getDataAsBase64: () => string;
};

export const DashboardPlugin = (
  props: DashboardPluginComponentProps
): JSX.Element => {
  const { id, layout, registerComponent } = props;
  const handlePanelOpen = useCallback(
    ({
      dragEvent,
      fetch: fetchWidget,
      panelId = shortid.generate(),
      widget,
    }: {
      dragEvent?: DragEvent;
      fetch: () => Promise<unknown>;
      panelId?: string;
      widget: VariableDefinition;
    }) => {
      const { name, type } = widget;

      if ((type as string) !== PLOTLY_WIDGET_TYPE) {
        return;
      }

      const fetch = async () => {
        const resolved = (await fetchWidget()) as unknown as JsWidget;
        const dataBase64 = resolved.getDataAsBase64();
        try {
          return JSON.parse(atob(dataBase64));
        } catch (e) {
          log.error(e);
          throw new Error('Unable to parse plot JSON');
        }
      };

      const metadata = { name, figure: name, type: PLOTLY_WIDGET_TYPE };

      const config = {
        type: 'react-component',
        component: PANEL_COMPONENT,
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

  useEffect(
    function registerComponentsAndReturnCleanup() {
      const cleanups = [registerComponent(PANEL_COMPONENT, PlotlyChartPanel)];
      return () => {
        cleanups.forEach(cleanup => cleanup());
      };
    },
    [registerComponent]
  );

  useListener(layout.eventHub, PanelEvent.OPEN, handlePanelOpen);

  return <></>;
};

export default DashboardPlugin;
