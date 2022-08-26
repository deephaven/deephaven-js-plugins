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

function makePlotlyFetch(fetchWidget: () => Promise<JsWidget>) {
  return async () => {
    const resolved = await fetchWidget();
    const dataBase64 = resolved.getDataAsBase64();
    try {
      return JSON.parse(atob(dataBase64));
    } catch (e) {
      log.error(e);
      throw new Error('Unable to parse plot JSON');
    }
  };
}

export type JsWidget = {
  type: string;
  getDataAsBase64: () => string;
};

export interface PlotlyVariableDefinition {
  name: string;
  type: string;
}

export type PlotlyDashboardPluginProps = DashboardPluginComponentProps & {
  session: {
    getObject: (definition: PlotlyVariableDefinition) => Promise<JsWidget>;
  };
};

export const DashboardPlugin = (
  props: PlotlyDashboardPluginProps
): JSX.Element => {
  const { id, layout, registerComponent, session } = props;
  const hydratePlotlyChart = useCallback(
    (props, id) => {
      const { metadata } = props;
      const { name } = metadata;
      const definition = {
        name,
        type: PLOTLY_WIDGET_TYPE,
      };
      return {
        ...props,
        localDashboardId: id,
        fetch: makePlotlyFetch(() => session.getObject(definition)),
      };
    },
    [session]
  );

  const handlePanelOpen = useCallback(
    ({
      dragEvent,
      fetch,
      panelId = shortid.generate(),
      widget,
    }: {
      dragEvent?: DragEvent;
      fetch: () => Promise<JsWidget>;
      panelId?: string;
      widget: VariableDefinition;
    }) => {
      const { name, type } = widget;

      if ((type as string) !== PLOTLY_WIDGET_TYPE) {
        return;
      }
      const metadata = { name };

      const config = {
        type: 'react-component',
        component: PANEL_COMPONENT,
        props: {
          localDashboardId: id,
          id: panelId,
          metadata,
          fetch: makePlotlyFetch(fetch),
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
      const cleanups = [
        registerComponent(
          PANEL_COMPONENT,
          PlotlyChartPanel,
          hydratePlotlyChart
        ),
      ];
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
