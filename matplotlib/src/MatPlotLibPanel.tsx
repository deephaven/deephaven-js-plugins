import React, { useEffect, useState } from "react";
import dh, { Table } from "@deephaven/jsapi-shim";
import Log from "@deephaven/log";
import "./MatPlotLibPanel.scss";

const log = Log.module("@deephaven/js-plugin-matplotlib/MatPlotLibPanel");

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
  fetch: () => Promise<MatPlotLibWidget>;
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
  // Set revision to -1 until we're listening to the revision table
  const [revision, setRevision] = useState<number>(-1);

  useEffect(
    function initInputTable() {
      let table = inputTable;
      async function openTable() {
        log.debug2("openTable");
        const keyColumn = table.findColumn(InputColumn.key);
        const valueColumn = table.findColumn(InputColumn.value);
        // Filter on the 'revision' key, listen for updates on the value
        table.applyFilter([
          keyColumn.filter().eq(dh.FilterValue.ofString(InputKey.revision)),
        ]);
        table.addEventListener(dh.Table.EVENT_UPDATED, ({ detail: data }) => {
          const newRevision = data.getRow(valueColumn);
          log.debug("New revision", newRevision);
          setRevision(newRevision);
        });
        table.setViewport(0, 0, [valueColumn]);
      }
      openTable();
      return function closeTable() {
        log.debug2("closeTable");
        table.close();
      };
    },
    [inputTable]
  );

  useEffect(
    function updateData() {
      async function fetchData() {
        log.debug("fetchData");
        const widget = await fetch();
        if (inputTable !== undefined) {
          // We haven't connected to the input table yet, do that
          const newInputTable =
            (await widget.exportedObjects[0].fetch()) as Table;
          setInputTable(newInputTable);
        } else if (revision >= 0) {
          // We've got a new revision, update the image data
          const imageData = await widget.getDataAsBase64();
          setImageSrc(`data:image/png;base64,${imageData}`);
        }
      }
      fetchData();
    },
    [fetch, inputTable, revision]
  );

  return (
    <div className="mat-plot-lib-panel">
      {imageSrc && <img src={imageSrc} alt="MatPlotLib render" />}
    </div>
  );
};

MatPlotLibPanel.COMPONENT = "MatPlotLibPanel";

export default MatPlotLibPanel;
