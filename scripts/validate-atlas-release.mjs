import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { isDeepStrictEqual } from "node:util"

import { buildAtlasRelease, readWorkbookTables } from "./import-atlas-workbook.mjs"

const root = new URL("../", import.meta.url)
const release = JSON.parse(await readFile(new URL("data/atlas-release.json", root), "utf8"))
const workbookUrl = new URL("data/releases/atlas-release.xlsx", root)
const requireApproved = process.argv.includes("--require-approved")

const workbookBytes = await readFile(workbookUrl)
const workbookSha256 = createHash("sha256").update(workbookBytes).digest("hex")
const workbookTables = await readWorkbookTables(fileURLToPath(workbookUrl))
const rebuiltRelease = buildAtlasRelease(workbookTables, workbookSha256)

if (!isDeepStrictEqual(release, rebuiltRelease)) {
  throw new Error("Atlas release JSON does not match the frozen workbook. Re-run the workbook importer before release.")
}

if (!release.releaseId || !release.reviewStatus || !release.workbookSha256 || !release.canonicalModelSha256) {
  throw new Error("Atlas release metadata is incomplete.")
}

if (requireApproved && release.reviewStatus !== "approved") {
  throw new Error(`Atlas release ${release.releaseId} is ${release.reviewStatus}. GitHub Pages deployment requires explicit workbook approval.`)
}

if (requireApproved && !String(release.approvedBy ?? "").trim()) {
  throw new Error(`Atlas release ${release.releaseId} is approved but does not name an approver.`)
}

console.log(`Atlas release ${release.releaseId} is ${release.reviewStatus}${requireApproved ? " and approved for deployment" : ""}.`)
