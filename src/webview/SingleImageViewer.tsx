import React, { useCallback, useMemo, useRef } from 'react'
import { ImagePreview } from 'right-image-preview'
import type { ImageItem, ZoomState } from 'right-image-preview'
import { callVscode } from '@easy_vscode/webview'
import { MESSAGE_CMD } from '../constants'
import './SingleImageViewer.css'

type ViewerMode = 'fit' | 'native'

type ViewerImage = {
  fsPath: string
  src: string
  name: string
  alt: string
}

type ImageViewerArgs = {
  images: ViewerImage[]
  defaultIndex: number
  initialMode: ViewerMode
}

function readImageViewerArgs(): ImageViewerArgs {
  if (typeof window === 'undefined') {
    return { images: [], defaultIndex: 0, initialMode: 'native' }
  }

  const args = (window as Window & { commandArgs?: unknown[] }).commandArgs?.[0]
  if (!args || typeof args !== 'object') {
    return { images: [], defaultIndex: 0, initialMode: 'native' }
  }

  const value = args as {
    images?: unknown
    defaultIndex?: unknown
    initialMode?: unknown
  }
  const images = Array.isArray(value.images)
    ? value.images.filter((item): item is ViewerImage => {
      if (!item || typeof item !== 'object') {
        return false
      }
      const image = item as Partial<ViewerImage>
      return (
        typeof image.fsPath === 'string' &&
        typeof image.src === 'string' &&
        typeof image.name === 'string' &&
        typeof image.alt === 'string'
      )
    })
    : []

  const requestedIndex =
    typeof value.defaultIndex === 'number' && Number.isInteger(value.defaultIndex)
      ? value.defaultIndex
      : 0
  const defaultIndex =
    images.length > 0
      ? Math.min(Math.max(requestedIndex, 0), images.length - 1)
      : 0
  const initialMode: ViewerMode = value.initialMode === 'fit' ? 'fit' : 'native'

  return { images, defaultIndex, initialMode }
}

const SingleImageViewer: React.FC = () => {
  const { images, defaultIndex, initialMode } = useMemo(readImageViewerArgs, [])
  const lastIndexRef = useRef(defaultIndex)
  const lastSavedModeRef = useRef<ViewerMode>(initialMode)
  const previewImages = useMemo<ImageItem[]>(
    () =>
      images.map((image) => ({
        id: image.fsPath,
        src: image.src,
        name: image.name,
        alt: image.alt
      })),
    [images]
  )

  const handleIndexChange = useCallback(
    (index: number) => {
      if (index === lastIndexRef.current) {
        return
      }
      lastIndexRef.current = index

      const image = images[index]
      if (image) {
        callVscode({
          cmd: MESSAGE_CMD.REVEAL_IMAGE_IN_EXPLORER,
          data: { fsPath: image.fsPath }
        })
      }
    },
    [images]
  )

  const handleZoomChange = useCallback((state: ZoomState) => {
    let selectedMode: ViewerMode | null = null
    if (state.mode === 'fit') {
      selectedMode = 'fit'
    } else if (state.mode === 'native' && Math.round(state.nativePercent) === 100) {
      selectedMode = 'native'
    }

    if (!selectedMode || selectedMode === lastSavedModeRef.current) {
      return
    }

    lastSavedModeRef.current = selectedMode
    callVscode({
      cmd: MESSAGE_CMD.SAVE_VIEW_MODE,
      data: { mode: selectedMode }
    })
  }, [])

  if (previewImages.length === 0) {
    return (
      <div style={{ padding: 20, color: 'var(--vscode-errorForeground)' }}>
        Unable to open this image.
      </div>
    )
  }

  return (
    <ImagePreview
      images={previewImages}
      visible
      defaultIndex={defaultIndex}
      initialMode={initialMode}
      initialNativePercent={100}
      switchImageResetZoom={false}
      wheelEnabled
      doubleClickEnabled
      closeOnMaskClick
      arrows='both'
      onZoomChange={handleZoomChange}
      onIndexChange={handleIndexChange}
      onClose={() => callVscode({ cmd: MESSAGE_CMD.CLOSE_CUSTOM_IMAGE_EDITOR })}
    />
  )
}

export default SingleImageViewer
