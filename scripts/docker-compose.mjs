import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

function run(cmd, cmdArgs) {
  return spawnSync(cmd, cmdArgs, { stdio: "inherit", shell: process.platform === "win32" });
}

let result = run("docker", ["compose", ...args]);
if (result.status === 0) process.exit(0);

result = run("docker-compose", args);
process.exit(result.status ?? 1);
