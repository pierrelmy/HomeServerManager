#!/usr/bin/env node
import { execFileSync } from "node:child_process"

const candidates = ["/usr/sbin/ip", "/usr/bin/ip", "ip"]

let lastError = null
for (const executable of candidates) {
  try {
    const output = execFileSync(executable, ["neigh", "show"], {
      encoding: "utf8",
      timeout: 10_000,
    })
    process.stdout.write(output)
    process.exit(0)
  } catch (error) {
    lastError = error
  }
}

throw lastError ?? new Error("Unable to execute ip neigh show")
