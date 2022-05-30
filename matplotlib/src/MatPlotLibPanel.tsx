import React, { useEffect, useState } from "react";
import dh, { Table } from "@deephaven/jsapi-shim";
import Log from "@deephaven/log";
import "./MatPlotLibPanel.scss";

const log = Log.module("@deephaven/js-plugin-matplotlib.MatPlotLibPanel");

enum InputColumn {
  key = "key",
  value = "value",
}

enum InputKey {
  revision = "revision",
  width = "width",
  height = "height",
}

export type MatPlotLibExportedObject = {
  fetch: () => unknown;
};

export type MatPlotLibWidget = {
  type: string;
  getDataAsBase64: () => string;
  exportedObjects: MatPlotLibExportedObject[];
};

export type MatPlotLibPanelProps = {
  fetch?: () => Promise<MatPlotLibWidget>;
};

export type MatPlotLibPanelState = {
  imageData?: string;
};

/**
 * Displays a rendered matplotlib from the server
 */
export const MatPlotLibPanel = (props: MatPlotLibPanelProps): JSX.Element => {
  const { fetch } = props;
  const [imageSrc, setImageSrc] = useState<string>();
  const [inputTable, setInputTable] = useState<Table>();
  // Set revision to 0 until we're listening to the revision table
  const [revision, setRevision] = useState<number>(0);

  useEffect(
    function initInputTable() {
      if (!inputTable) {
        return;
      }

      let table = inputTable;
      async function openTable() {
        log.info("openTable");
        const keyColumn = table.findColumn(InputColumn.key);
        const valueColumn = table.findColumn(InputColumn.value);
        // Filter on the 'revision' key, listen for updates on the value
        table.applyFilter([
          keyColumn.filter().eq(dh.FilterValue.ofString(InputKey.revision)),
        ]);
        table.addEventListener(dh.Table.EVENT_UPDATED, ({ detail: data }) => {
          const newRevision = data.rows[0].get(valueColumn);
          log.debug("New revision", newRevision);
          setRevision(newRevision);
        });
        table.setViewport(0, 0, [valueColumn]);
      }
      openTable();
      return function closeTable() {
        log.info("closeTable");
        table.close();
      };
    },
    [inputTable]
  );

  useEffect(
    function updateData() {
      async function fetchData() {
        log.info("fetchData");
        const widget = await fetch();
        const imageData = widget.getDataAsBase64();
        setImageSrc(`data:image/png;base64,${imageData}`);
        if (revision <= 0) {
          log.info("Getting new input table");
          // We haven't connected to the input table yet, do that
          const newInputTable =
            (await widget.exportedObjects[0].fetch()) as Table;
          setInputTable(newInputTable);
        }
      }
      fetchData();
    },
    [fetch, revision]
  );

  return (
    <div className="mat-plot-lib-panel">
      {imageSrc && <img src={imageSrc} alt="MatPlotLib render" />}
    </div>
  );
};

MatPlotLibPanel.COMPONENT = "MatPlotLibPanel";

export default MatPlotLibPanel;
