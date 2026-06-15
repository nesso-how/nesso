// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react'
import { useGraphStore } from '@/store'
import { useT } from '@/i18n'
import { isDesktop } from '@/lib/isDesktop'
import { getDefaultWorkspacePath, normalizePath, projectDisplayName } from '@/lib/workspace'

/** Display name of the active desktop project (folder basename, or "My graphs"
 *  for the default workspace). Empty string on web / before resolution. */
export function useActiveProjectName(): string {
  const t = useT()
  const activeProjectPath = useGraphStore((s) => s.settings.activeProjectPath)
  const [defaultPath, setDefaultPath] = useState<string | null>(null)

  useEffect(() => {
    if (!isDesktop()) return
    void getDefaultWorkspacePath().then((p) => setDefaultPath(normalizePath(p)))
  }, [])

  if (!isDesktop() || !activeProjectPath) return ''
  return projectDisplayName(
    activeProjectPath,
    defaultPath,
    t.sidebar.projectSwitcher.defaultProjectName,
  )
}
