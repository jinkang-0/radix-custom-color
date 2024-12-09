// This shows the HTML page in "ui.html".
figma.showUI(__html__, { height: 550, width: 400 });

interface GenerateColorStyleMessage {
  type: "generate-colors-style";
  colors: string[];
  folderName: string;
  makeRectangles: boolean;
}

interface GenerateColorVariableMessage {
  type: "generate-colors-variable";
  colors: string[];
  folderName: string;
  makeRectangles: boolean;
  collectionName?: string;
  variableMode?: string;
}

type GenerateColorMessage =
  | GenerateColorStyleMessage
  | GenerateColorVariableMessage;

// input: #001122 or #00112233
const hexToPaint = (hexCode: string) => {
  const hex = hexCode.replace("#", "");
  let opacity = 1;

  if (hex.length === 8) {
    opacity = parseInt(hex.substring(6, 8), 16) / 255;
  }

  const rText =
    hex.length === 3 ? hex.substring(0, 1).repeat(2) : hex.substring(0, 2);

  const gText =
    hex.length === 3 ? hex.substring(1, 2).repeat(2) : hex.substring(2, 4);

  const bText =
    hex.length === 3 ? hex.substring(2, 3).repeat(2) : hex.substring(4, 6);

  const r = parseInt(rText, 16) / 255;
  const g = parseInt(gText, 16) / 255;
  const b = parseInt(bText, 16) / 255;

  const paint: SolidPaint = {
    type: "SOLID",
    color: {
      r,
      g,
      b
    },
    opacity
  };

  return paint;
};

const paintToRGBA = (paint: SolidPaint): RGBA => {
  return { ...paint.color, a: paint.opacity ?? 1 };
};

const getColorName = (idx: number) => {
  const prefix = idx >= 12 ? "a" : "";
  const number = (idx % 12) + 1;
  return `${prefix}${number}`;
};

const getColorPath = (folderName: string, idx: number) => {
  const color = getColorName(idx);
  return folderName ? `${folderName}/${color}` : color;
};

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = async (msg: GenerateColorMessage | undefined) => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (!msg) return;

  if (msg.type == "generate-colors-style") {
    const nodes: SceneNode[] = [];

    for (let i = 0; i < 24; i++) {
      // create color style
      const style = figma.createPaintStyle();
      style.name = getColorPath(msg.folderName, i);
      style.paints = [hexToPaint(msg.colors[i])];

      // create rect
      if (msg.makeRectangles) {
        const rect = figma.createRectangle();
        rect.x = figma.viewport.center.x + (i % 12) * 100;
        rect.y = figma.viewport.center.y + Math.floor(i / 12) * 52;
        rect.resize(96, 48);
        rect.name = getColorName(i);
        await rect.setFillStyleIdAsync(style.id);

        nodes.push(rect);
      }
    }

    // group rects and select
    if (msg.makeRectangles) {
      const group = figma.group(nodes, figma.currentPage);
      group.name = msg.folderName;
      figma.currentPage.selection = [group];
    }
  } else if (msg.type == "generate-colors-variable") {
    const nodes: SceneNode[] = [];

    // determine collection
    const collectionName = msg.collectionName || "Collection 1";
    let varCollection: VariableCollection | undefined;

    try {
      const collections =
        await figma.variables.getLocalVariableCollectionsAsync();
      varCollection = collections.find((c) => c.name === collectionName);
      if (!varCollection) {
        if (!msg.collectionName && collections.length > 0)
          varCollection = collections[0];
        else
          varCollection =
            figma.variables.createVariableCollection(collectionName);
      }
    } catch {
      varCollection = figma.variables.createVariableCollection(collectionName);
    }

    // determine mode
    let varMode = "";
    if (!msg.variableMode) {
      varMode = varCollection.modes[0].modeId;
    } else {
      const foundMode = varCollection.modes.find((v) => v.name === varMode);
      if (foundMode) {
        varMode = foundMode.modeId;
      } else {
        // attempt to add mode, fail gracefully and notify client
        try {
          varMode = varCollection.addMode(varMode);
        } catch {
          const errorMessage = `Failed to add mode to ${collectionName}.`;
          console.error(errorMessage);
          figma.ui.postMessage({
            type: "server-error",
            message: errorMessage
          });
          return;
        }
      }
    }

    for (let i = 0; i < 24; i++) {
      // create color variable
      const colorName = getColorPath(msg.folderName, i);

      let variable: Variable | undefined;
      try {
        variable = figma.variables.createVariable(
          colorName,
          varCollection,
          "COLOR"
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(errorMessage);
        figma.ui.postMessage({
          type: "server-error",
          message: errorMessage
        });
        return;
      }

      variable.setValueForMode(varMode, paintToRGBA(hexToPaint(msg.colors[i])));

      // assign color
      const fillArray = [hexToPaint(msg.colors[i])];
      fillArray[0] = figma.variables.setBoundVariableForPaint(
        hexToPaint(msg.colors[i]),
        "color",
        variable
      );

      // create rect
      if (msg.makeRectangles) {
        const rect = figma.createRectangle();
        rect.x = figma.viewport.center.x + (i % 12) * 100;
        rect.y = figma.viewport.center.y + Math.floor(i / 12) * 52;
        rect.resize(96, 48);
        rect.name = getColorName(i);
        rect.fills = fillArray;

        nodes.push(rect);
      }
    }

    // group rects and select
    if (msg.makeRectangles) {
      const group = figma.group(nodes, figma.currentPage);
      group.name = msg.folderName;
      figma.currentPage.selection = [group];
    }
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  figma.closePlugin();
};
