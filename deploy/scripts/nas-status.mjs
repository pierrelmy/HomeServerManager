#!/usr/bin/env node
import { execFileSync } from "node:child_process"

function run(executable, args) {
  return execFileSync(executable, args, { encoding: "utf8", timeout: 10_000 }).trim()
}

const poolRows = run("/usr/sbin/zpool", ["list", "-Hp", "-o", "name,size,alloc,health"])
  .split("\n")
  .filter(Boolean)
const pools = poolRows.map((row) => {
  const [name, sizeValue, allocatedValue, healthValue] = row.split("\t")
  const total = Number(sizeValue) / 1_000_000_000_000
  const used = Number(allocatedValue) / 1_000_000_000_000
  return {
    name,
    type: "zpool",
    used: Number(used.toFixed(2)),
    total: Number(total.toFixed(2)),
    temp: 0,
    health: healthValue === "ONLINE" ? "Healthy" : "Warning",
  }
})

const blockDevices = JSON.parse(run("/usr/bin/lsblk", ["-J", "-d", "-o", "NAME,MODEL,TYPE"]))
const drives = (blockDevices.blockdevices ?? [])
  .filter((device) => device.type === "disk")
  .map((device) => ({
    slot: device.name,
    model: device.model?.trim() || "Unknown",
    temp: 0,
    status: "Healthy",
  }))

const total = pools.reduce((sum, pool) => sum + pool.total, 0)
const used = pools.reduce((sum, pool) => sum + pool.used, 0)
const warningCount = pools.filter((pool) => pool.health !== "Healthy").length

process.stdout.write(JSON.stringify({
  capacityUsed: `${used.toFixed(1).replace(".", ",")} To / ${total.toFixed(1).replace(".", ",")} To`,
  healthSummary: warningCount === 0 ? "Tous les pools sont sains" : `${warningCount} pool(s) à vérifier`,
  backupSummary: "À configurer",
  temperatureSummary: "SMART à configurer",
  pools,
  backups: [],
  drives,
}))
