// SPDX-License-Identifier: MIT
import { ActionBanner } from '@/components/ActionBanner'
import { useGraphStore } from '@/store/graph'
import { useT } from '@/i18n'
import { isDesktop } from '@/lib/isDesktop'

export function GraphFileConflictBanner() {
  const t = useT()
  const conflict = useGraphStore((s) => s.externalFileConflict)
  const reload = useGraphStore((s) => s.reloadActiveGraphFromDisk)
  const keep = useGraphStore((s) => s.keepLocalGraphChanges)

  return (
    <ActionBanner
      open={isDesktop() && conflict}
      message={t.fileConflict.message}
      actions={[
        { label: t.fileConflict.keepLocal, primary: true, onClick: () => void keep() },
        { label: t.fileConflict.reload, onClick: () => void reload() },
      ]}
    />
  )
}
