import React, { ReactNode } from 'react';
import ReactJson from 'react-json-view';
import Button from '@deephaven/components/dist/Button';
import LoadingOverlay from '@deephaven/components/dist/LoadingOverlay';
import { type DashboardPanelProps } from '@deephaven/dashboard';
import PanelEvent from '@deephaven/dashboard/dist/PanelEvent';
import Log from '@deephaven/log/dist/Log';

const log = Log.module('ObjectPanel');

type StateProps = {
  fetch: () => Promise<unknown>;
  metadata: {
    name: string;
  };
};

export type JsExportedObjectType = 'Table' | 'TableMap' | 'Figure';

export type JsWidgetExportedObject = {
  type: JsExportedObjectType;
  fetch: () => Promise<unknown>;
};

export type ObjectPanelProps = DashboardPanelProps & StateProps;

export type JsWidget = {
  type: string;
  getDataAsBase64: () => string;
  exportedObjects: JsWidgetExportedObject[];
};

export type ObjectPanelState = {
  error?: unknown;
  object?: unknown;
};

function isJsWidget(object: unknown): object is JsWidget {
  return typeof (object as JsWidget).getDataAsBase64 === 'function';
}

/**
 * Panel for showing a widget from the server in a Dashboard.
 */
export class ObjectPanel extends React.Component<
  ObjectPanelProps,
  ObjectPanelState
> {
  static COMPONENT = '@deephaven/ObjectPanel';

  constructor(props: ObjectPanelProps) {
    super(props);

    this.handleError = this.handleError.bind(this);
    this.handleExportedTypeClick = this.handleExportedTypeClick.bind(this);

    this.state = {
      error: undefined,
      object: undefined,
    };
  }

  componentDidMount(): void {
    this.fetchObject();
  }

  async fetchObject(): Promise<void> {
    try {
      const { fetch, metadata } = this.props;
      log.info('fetchObject...', metadata);
      const object = await fetch();
      log.info('Object fetched: ', object);
      this.setState({ object });
    } catch (e: unknown) {
      this.handleError(e);
    }
  }

  handleExportedTypeClick(
    exportedObject: JsWidgetExportedObject,
    index: number
  ): void {
    log.info('handleExportedTypeClick', exportedObject, index);

    const { type } = exportedObject;
    log.info('Opening object', index);

    const { glEventHub, metadata } = this.props;
    const { name } = metadata;
    const openOptions = {
      fetch: () => exportedObject.fetch(),
      widget: { name: `${name}/${index}`, type },
    };

    log.info('openWidget', openOptions);

    glEventHub.emit(PanelEvent.OPEN, openOptions);
  }

  handleError(error: unknown): void {
    log.error(error);
    this.setState({ error, object: undefined });
  }

  renderObjectData(): React.ReactNode {
    const { object } = this.state;
    if (object == null) {
      return null;
    }
    log.info('Rendering object data');
    if (!isJsWidget(object)) {
      return <div className="error-message">Object is not a widget</div>;
    }
    const data = object.getDataAsBase64();
    try {
      const dataJson = JSON.parse(atob(data));
      return <ReactJson src={dataJson} theme="monokai" />;
    } catch (e) {
      return <div className="base64-data">{data}</div>;
    }
  }

  renderExportedObjectList(): React.ReactNode {
    const { object } = this.state;
    if (object == null || !isJsWidget(object)) {
      return null;
    }

    return (
      <>
        {object.exportedObjects.map((exportedObject, index) => (
          <Button
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            kind="ghost"
            onClick={() => this.handleExportedTypeClick(exportedObject, index)}
          >
            {exportedObject.type} {index}
          </Button>
        ))}
      </>
    );
  }

  render(): ReactNode {
    const { metadata } = this.props;
    const { name, type } = metadata;
    const { error, object } = this.state;
    const isLoading = error === undefined && object === undefined;
    const isLoaded = object !== undefined;
    const errorMessage = error != null ? `${error}` : undefined;

    return (
      <div className="object-panel-content">
        <div className="title">
          {name} ({type})
        </div>
        {isLoaded && (
          <>
            <div className="object-panel-exported-tables">
              {this.renderExportedObjectList()}
            </div>
            <div className="object-panel-data">{this.renderObjectData()}</div>
          </>
        )}
        <LoadingOverlay
          isLoading={isLoading}
          isLoaded={isLoaded}
          errorMessage={errorMessage}
        />
      </div>
    );
  }
}

export default ObjectPanel;
