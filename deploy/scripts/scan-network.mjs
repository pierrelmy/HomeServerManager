#!/usr/bin/env node
import { execFileSync } from "node:child_process"

const output = execFileSync("/usr/sbin/ip", ["neigh", "show"], {
  encoding: "utf8",
  timeout: 10_000,
})
process.stdout.write(output)
