const { spawnSync } = require("node:child_process");
const files = require("./metrics-test-files.json");
const result = spawnSync(process.execPath, [__dirname + "/run-tests.cjs", process.argv[2], ...files, "--local-pg"], { stdio: "inherit", windowsHide: true });
process.exitCode = result.status ?? 1;
