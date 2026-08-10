import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const clientDir = path.join(distDir, "client");
const serverDir = path.join(distDir, "server");

await rm(clientDir, { recursive: true, force: true });
await rm(serverDir, { recursive: true, force: true });
await mkdir(clientDir, { recursive: true });

for (const entry of await readdir(distDir, { withFileTypes: true })) {
  if (entry.name === "client" || entry.name === "server") continue;
  await cp(path.join(distDir, entry.name), path.join(clientDir, entry.name), {
    recursive: entry.isDirectory(),
  });
}

await mkdir(serverDir, { recursive: true });
await writeFile(
  path.join(serverDir, "index.js"),
  `export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`,
);
