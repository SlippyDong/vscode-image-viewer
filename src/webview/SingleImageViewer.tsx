import React, { useCallback, useMemo, useRef } from 'react'
import { ImagePreview } from 'right-image-preview'
import type { ImageItem } from 'right-image-preview'
import { callVscode } from '@easy_vscode/webview'
import { MESSAGE_CMD } from '../constants'
import './SingleImageViewer.css'

type ViewerImage = {
  fsPath: string
  src: string
  name: string
  alt: string
}

type ImageViewerArgs = {
  images: ViewerImage[]
  defaultIndex: number
}

function readImageViewerArgs(): ImageViewerArgs {
  if (typeof window === 'undefined') {
    return { images: [], defaultIndex: 0 }
  }

  const args = (window as Window & { commandArgs?: unknown[] }).commandArgs?.[0]
  if (!args || typeof args !== 'object') {
    return { images: [], defaultIndex: 0 }
  }

  const value = args as { images?: unknown; defaultIndex?: unknown }
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

  return { images, defaultIndex }
}

const SingleImageViewer: React.FC = () => {
  const { images, defaultIndex } = useMemo(readImageViewerArgs, [])
  const lastIndexRef = useRef(defaultIndex)
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
      wheelEnabled
      doubleClickEnabled
      closeOnMaskClick
      arrows='both'
      onIndexChange={handleIndexChange}
      onClose={() => callVscode({ cmd: MESSAGE_CMD.CLOSE_CUSTOM_IMAGE_EDITOR })}
    />
  )
}

export default SingleImageViewer
