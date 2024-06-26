// This shows the HTML page in "ui.html".
figma.showUI(__html__, { height: 400, width: 400 });

interface GenerateColorMessage {
  type: "generate-colors";
  colors: string[];
  folderName: string;
  makeRectangles: boolean;
}

// input: #001122 or #00112233
const hexToRGBA = (hexCode: string) => {
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

  return { color: { r, g, b }, opacity };
};

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = async (msg: GenerateColorMessage | undefined) => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg) {
    const nodes: SceneNode[] = [];

    for (let i = 0; i < 24; i++) {
      // create color style
      const style = figma.createPaintStyle();
      const prefix = i >= 12 ? "a" : "";
      const number = (i % 12) + 1;
      style.name = `${msg.folderName}/${prefix}${number}`;
      style.paints = [{ type: "SOLID", ...hexToRGBA(msg.colors[i]) }];

      // create rect
      if (msg.makeRectangles) {
        const rect = figma.createRectangle();
        rect.x = figma.viewport.center.x + (i % 12) * 100;
        rect.y = figma.viewport.center.y + Math.floor(i / 12) * 52;
        rect.resize(96, 48);
        rect.name = `${prefix}${number}`;
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
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  figma.closePlugin();
};
