import { useCallback, useEffect, useState } from 'react'
import { BackHandler, Platform } from 'react-native'

export type MobileFilePreviewBack = {
  /** Whether the screen is asking about an unsaved draft instead of leaving. */
  confirmingDiscard: boolean
  /** Returns true when it handled the request, which is what a hardware back press reads. */
  requestBack: () => boolean
  stay: () => void
  discard: () => void
}

/**
 * Leaving the preview, and the one question that can stop it.
 *
 * The prompt is the screen's own rather than `Alert.alert`, because React Native Web's `Alert` is
 * `static alert() {}` — a silent no-op. Inside the shell's page that turned Back with an unsaved
 * draft into a button that did nothing at all: no prompt, and no navigation either.
 *
 * It is also not a `ConfirmModal`, which every other confirm here is: that one is a `BottomDrawer`,
 * and C1.9 has Reanimated's animated styles never reaching the DOM node on WKWebView, so on iOS in
 * the page the drawer stays parked off-screen and Back would be dead in a second way.
 *
 * Hardware back is registered natively only. React Native Web's `BackHandler.addEventListener`
 * logs "BackHandler is not supported on web and should not be used." and returns an inert
 * subscription, so on web this guard never armed regardless; skipping it drops the console error
 * and states the degradation instead of hiding it. Android back inside the page therefore pops the
 * native stack without this prompt — the page's own Back control is where the prompt lives.
 */
export function useMobileFilePreviewBack(options: {
  hasUnsavedDraft: boolean
  leave: () => void
}): MobileFilePreviewBack {
  const { hasUnsavedDraft, leave } = options
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const requestBack = useCallback(() => {
    if (hasUnsavedDraft) {
      setConfirmingDiscard(true)
      return true
    }
    leave()
    return true
  }, [hasUnsavedDraft, leave])

  const stay = useCallback(() => setConfirmingDiscard(false), [])

  const discard = useCallback(() => {
    setConfirmingDiscard(false)
    leave()
  }, [leave])

  // A draft saved or reverted while the prompt is up leaves nothing to discard, so the question
  // goes rather than staying on screen over an answer that is no longer true.
  useEffect(() => {
    if (!hasUnsavedDraft) {
      setConfirmingDiscard(false)
    }
  }, [hasUnsavedDraft])

  useEffect(() => {
    if (Platform.OS === 'web') {
      return
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', requestBack)
    return () => subscription.remove()
  }, [requestBack])

  return { confirmingDiscard, requestBack, stay, discard }
}
