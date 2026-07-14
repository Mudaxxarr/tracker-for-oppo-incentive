import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";

const outFile = new URL("./keystore.properties", import.meta.url);
if (existsSync(outFile)) {
  console.log("keystore.properties already exists — not overwriting.");
  process.exit(0);
}

const pass = randomBytes(24).toString("hex");
const contents = `storeFile=app/incento-release.jks
storePassword=${pass}
keyAlias=incento
keyPassword=${pass}
`;
writeFileSync(outFile, contents, { mode: 0o600 });
console.log("keystore.properties written (password not printed).");
