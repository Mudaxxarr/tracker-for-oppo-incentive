import { Font } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

let _done = false;
export let interFontReady = false;
export let playfairFontReady = false;

export function ensureInterFont(): void {
  if (_done) return;
  _done = true;

  try {
    const dir = path.join(process.cwd(), "node_modules/@fontsource/inter/files");
    const b64 = (w: string) =>
      `data:font/woff;base64,${fs.readFileSync(path.join(dir, `inter-latin-${w}-normal.woff`)).toString("base64")}`;
    Font.register({ family: "Inter-Light",     src: b64("300") });
    Font.register({ family: "Inter",           src: b64("400") });
    Font.register({ family: "Inter-Medium",    src: b64("500") });
    Font.register({ family: "Inter-Semibold",  src: b64("600") });
    Font.register({ family: "Inter-Bold",      src: b64("700") });
    Font.register({ family: "Inter-ExtraBold", src: b64("800") });
    interFontReady = true;
  } catch (err) {
    console.error("[pdf-fonts] Inter registration failed:", err);
  }

  try {
    const dir = path.join(process.cwd(), "node_modules/@fontsource/playfair-display/files");
    const bN = (w: string) =>
      `data:font/woff;base64,${fs.readFileSync(path.join(dir, `playfair-display-latin-${w}-normal.woff`)).toString("base64")}`;
    const bI = (w: string) =>
      `data:font/woff;base64,${fs.readFileSync(path.join(dir, `playfair-display-latin-${w}-italic.woff`)).toString("base64")}`;
    Font.register({ family: "Playfair",            src: bN("400") });
    Font.register({ family: "Playfair-Italic",     src: bI("400") });
    Font.register({ family: "Playfair-Bold",       src: bN("700") });
    Font.register({ family: "Playfair-BoldItalic", src: bI("700") });
    Font.register({ family: "Playfair-Black",      src: bN("900") });
    Font.register({ family: "Playfair-BlackItalic",src: bI("900") });
    playfairFontReady = true;
  } catch (err) {
    console.error("[pdf-fonts] Playfair Display registration failed:", err);
  }
}
