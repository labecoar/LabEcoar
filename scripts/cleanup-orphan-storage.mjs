import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.BUCKET || 'submissions'
const DRY_RUN = String(process.env.DRY_RUN || 'true').toLowerCase() !== 'false'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const PAGE_SIZE = 1000
const DELETE_CHUNK = 100

const normalizePath = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null

  const marker = '/storage/v1/object/public/submissions/'
  const markerIndex = raw.indexOf(marker)

  if (markerIndex >= 0) {
    const start = markerIndex + marker.length
    const pathWithQuery = raw.slice(start)
    const normalizedPath = decodeURIComponent(pathWithQuery.split('?')[0] || '').trim()
    return normalizedPath || null
  }

  const withoutLeadingSlash = raw.replace(/^\/+/, '')
  if (withoutLeadingSlash.startsWith('submissions/')) {
    return withoutLeadingSlash.slice('submissions/'.length) || null
  }

  if (!withoutLeadingSlash.startsWith('http://') && !withoutLeadingSlash.startsWith('https://')) {
    return withoutLeadingSlash || null
  }

  return null
}

async function fetchAllRows({ schema = 'public', table, select }) {
  const rows = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const query = supabase.schema(schema).from(table).select(select).range(from, to)
    const { data, error } = await query

    if (error) throw error
    if (!data || data.length === 0) break

    rows.push(...data)
    if (data.length < PAGE_SIZE) break

    from += PAGE_SIZE
  }

  return rows
}

async function getReferencedPaths() {
  const [submissions, metrics, profiles] = await Promise.all([
    fetchAllRows({ table: 'submissions', select: 'proof_url' }),
    fetchAllRows({ table: 'metrics_submissions', select: 'metrics_file_url,invoice_file_url' }),
    fetchAllRows({ table: 'profiles', select: 'avatar_url' }),
  ])

  const referenced = new Set()

  for (const row of submissions) {
    const p = normalizePath(row.proof_url)
    if (p) referenced.add(p)
  }

  for (const row of metrics) {
    const metricsPath = normalizePath(row.metrics_file_url)
    const invoicePath = normalizePath(row.invoice_file_url)
    if (metricsPath) referenced.add(metricsPath)
    if (invoicePath) referenced.add(invoicePath)
  }

  for (const row of profiles) {
    const p = normalizePath(row.avatar_url)
    if (p) referenced.add(p)
  }

  return referenced
}

async function getBucketObjects() {
  const files = []
  const foldersToVisit = ['']

  while (foldersToVisit.length > 0) {
    const currentPrefix = foldersToVisit.shift()
    let offset = 0

    while (true) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(currentPrefix, {
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        })

      if (error) throw error
      if (!data || data.length === 0) break

      for (const item of data) {
        const fullPath = currentPrefix ? `${currentPrefix}/${item.name}` : item.name
        const isFolder = !item.id

        if (isFolder) {
          foldersToVisit.push(fullPath)
          continue
        }

        files.push({
          name: fullPath,
          bucket_id: BUCKET,
          metadata: item.metadata || {},
          created_at: item.created_at || null,
        })
      }

      if (data.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
  }

  return files
}

function chunkArray(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function main() {
  const referenced = await getReferencedPaths()
  const objects = await getBucketObjects()
  const targetObjects = objects.filter((o) => o.bucket_id === BUCKET)

  const orphanObjects = targetObjects.filter((o) => !referenced.has(o.name))
  const orphanBytes = orphanObjects.reduce((sum, o) => sum + Number(o?.metadata?.size || 0), 0)

  console.log(`Bucket: ${BUCKET}`)
  console.log(`Total files: ${targetObjects.length}`)
  console.log(`Orphan files: ${orphanObjects.length}`)
  console.log(`Orphan bytes: ${orphanBytes}`)
  console.log(`Mode: ${DRY_RUN ? 'DRY_RUN' : 'DELETE'}`)

  if (orphanObjects.length === 0) {
    console.log('No orphan files found.')
    return
  }

  orphanObjects
    .slice(0, 20)
    .forEach((o) => console.log(`- ${o.name} (${Number(o?.metadata?.size || 0)} bytes)`))

  if (DRY_RUN) {
    console.log('Dry run enabled. Set DRY_RUN=false to remove orphan files.')
    return
  }

  const orphanPaths = orphanObjects.map((o) => o.name)
  const chunks = chunkArray(orphanPaths, DELETE_CHUNK)

  let deletedCount = 0
  for (const paths of chunks) {
    const { data, error } = await supabase.storage.from(BUCKET).remove(paths)
    if (error) throw error
    deletedCount += Array.isArray(data) ? data.length : paths.length
  }

  console.log(`Deleted files: ${deletedCount}`)
}

main().catch((error) => {
  console.error('Cleanup failed:', error)
  process.exit(1)
})
