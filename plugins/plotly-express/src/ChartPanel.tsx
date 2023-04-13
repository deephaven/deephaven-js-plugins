import React, { Component, ReactElement, RefObject } from 'react';
import Log from '@deephaven/log';
import { Pending, PromiseUtils } from '@deephaven/utils';
import type { Container, EventEmitter } from '@deephaven/golden-layout';
import PlotlyExpressChartModel from './PlotlyExpressChartModel';
import Chart from './Chart';

const log = Log.module('ChartPanel');

interface ChartPanelMetadata {
  name: string;
  figure: string;
  type: string;
}

interface ChartPanelProps {
  glContainer: Container;
  glEventHub: EventEmitter;

  metadata: ChartPanelMetadata;
  /** Function to build the ChartModel used by this ChartPanel. Can return a promise. */
  makeModel: () => Promise<PlotlyExpressChartModel>;
  localDashboardId: string;
}

interface ChartPanelState {
  error?: unknown;
  isActive: boolean;
  isDisconnected: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  model?: PlotlyExpressChartModel;
}

export class ChartPanel extends Component<ChartPanelProps, ChartPanelState> {
  static displayName = 'PlotlyExpressChartPanel';

  static COMPONENT = 'PlotlyExpressChartPanel';

  constructor(props: ChartPanelProps) {
    super(props);

    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleReconnect = this.handleReconnect.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleLoadError = this.handleLoadError.bind(this);
    this.handleLoadSuccess = this.handleLoadSuccess.bind(this);
    this.handleUpdate = this.handleUpdate.bind(this);

    this.panelContainer = React.createRef();
    this.chart = React.createRef();
    this.pending = new Pending();

    this.state = {
      error: undefined,
      isActive: false,
      isDisconnected: false,
      isLoading: false,
      isLoaded: false,
      model: undefined,
    };
  }

  componentDidMount(): void {
    if (!this.isHidden()) {
      this.setState({ isActive: true });
      this.initModel();
    }
  }

  componentWillUnmount(): void {
    this.pending.cancel();
  }

  panelContainer: RefObject<HTMLDivElement>;

  chart: RefObject<Chart>;

  pending: Pending;

  initModel(): void {
    this.setState({ isLoading: true, isLoaded: false, error: undefined });

    const { makeModel } = this.props;
    this.pending
      .add(makeModel(), resolved => {
        resolved.close();
      })
      .then(this.handleLoadSuccess, this.handleLoadError);
  }

  loadModelIfNecessary(): void {
    const { isActive, isLoaded, isLoading } = this.state;
    if (isActive && !isLoaded && !isLoading) {
      this.initModel();
    }
  }

  isHidden(): boolean {
    const { glContainer } = this.props;
    const { isHidden } = glContainer;
    return isHidden;
  }

  handleDisconnect(): void {
    this.setState({
      error: new Error('Figure disconnected'),
      isDisconnected: true,
    });
  }

  handleReconnect(): void {
    this.setState({ isDisconnected: false, error: undefined });
  }

  handleLoadSuccess(model: PlotlyExpressChartModel): void {
    log.debug('handleLoadSuccess');

    this.setState({
      model,
      isLoaded: true,
    });
  }

  handleLoadError(error: unknown): void {
    if (PromiseUtils.isCanceled(error)) {
      return;
    }

    log.error('handleLoadError', error);
    this.setState({ error, isLoading: false });
  }

  handleError(): void {
    // Don't want to set an error state, because the user can fix a chart error within the chart itself.
    // We're not loading anymore either so stop showing the spinner so the user can actually click those buttons.
    this.setState({ isLoading: false });
  }

  handleUpdate(): void {
    this.setState({ isLoading: false });
  }

  setActive(isActive: boolean): void {
    this.setState({ isActive }, () => {
      if (isActive) {
        this.loadModelIfNecessary();
        this.updateChart();
      }
    });
  }

  updateChart(): void {
    if (this.chart.current) {
      this.chart.current.updateDimensions();
    }
  }

  render(): ReactElement {
    const { model, isActive, isLoaded } = this.state;

    return (
      <div
        ref={this.panelContainer}
        className="chart-panel-container h-100 w-100"
      >
        <div className="chart-container h-100 w-100">
          {isLoaded && model && (
            <Chart
              isActive={isActive}
              model={model}
              ref={this.chart}
              onDisconnect={this.handleDisconnect}
              onReconnect={this.handleReconnect}
              onUpdate={this.handleUpdate}
              onError={this.handleError}
            />
          )}
        </div>
      </div>
    );
  }
}

export default ChartPanel;
