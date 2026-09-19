import { useLocalSearchParams } from 'expo-router'
import { MobileFilePreviewScreen } from '../../../../../src/files/MobileFilePreviewScreen'
import {
  mobileFilePreviewShellParams,
  normalizeMobileFilePreviewRouteParams
} from '../../../../../src/files/mobile-file-preview-route'
import { MobileWebShellScreen } from '../../../../../src/mobile-web-shell/MobileWebShellScreen'
import { useMobileWebShellEnabled } from '../../../../../src/mobile-web-shell/use-mobile-web-shell-enabled'

/**
 * The file preview, from the desktop's bundle or from this app.
 *
 * Normalized before the switch, not after: a route the native screen would refuse is one the shell
 * has no pathname to build from, and its own refusal message is a better screen than a page opened
 * on params it will refuse again.
 *
 * Only the two path segments are spelled into the pathname; everything else — the file path among
 * them — is a param, which is what keeps a `/`, a space or a `..` out of the segment vocabulary the
 * bridge holds a route to.
 */
export default function MobileFilePreviewRoute() {
  const params = useLocalSearchParams<{
    hostId?: string | string[]
    worktreeId?: string | string[]
    relativePath?: string | string[]
    source?: string | string[]
    absolutePath?: string | string[]
    grantId?: string | string[]
    terminal?: string | string[]
    pathText?: string | string[]
    cwd?: string | string[]
    nativeChatTab?: string | string[]
    nativeChatSession?: string | string[]
    line?: string | string[]
    column?: string | string[]
    name?: string | string[]
    worktreeName?: string | string[]
  }>()
  const route = normalizeMobileFilePreviewRouteParams(params)
  const enabled = useMobileWebShellEnabled()
  const native = <MobileFilePreviewScreen route={route} />

  if (enabled !== true || !route.ok) {
    return native
  }
  const { hostId, worktreeId } = route.params
  return (
    <MobileWebShellScreen
      hostId={hostId}
      route={{
        pathname: `/h/${encodeURIComponent(hostId)}/files/preview/${encodeURIComponent(worktreeId)}`,
        params: mobileFilePreviewShellParams(route.params)
      }}
      fallback={native}
    />
  )
}
