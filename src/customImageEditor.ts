import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import imageSize from 'image-size'
import {
  DIST_WEBVIEW_INDEX_HTML,
  DIST_WEBVIEW_PATH,
  EXTENSION_COMMANDS,
  IMAGE_EDITOR_VIEW_TYPE,
  IMAGE_FILE_PATTERNS,
  MESSAGE_CMD,
  WEBVIEW_NAMES
} from './constants'

class ImageViewerDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}

  dispose() {}
}

type ViewerMode = 'fit' | 'native'

type ViewerImageBootstrap = {
  fsPath: string
  src: string
  name: string
  alt: string
}

type ImageViewerBootstrap = {
  images: ViewerImageBootstrap[]
  defaultIndex: number
  initialMode: ViewerMode
}

const VIEW_MODE_STATE_KEY = `${IMAGE_EDITOR_VIEW_TYPE}.viewMode`

const SUPPORTED_IMAGE_EXTENSIONS = new Set(
  IMAGE_FILE_PATTERNS.map((pattern) => pattern.slice(1).toLowerCase())
)

function normalizeFsPath(filePath: string): string {
  const resolved = path.resolve(filePath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function readImageLabel(filePath: string): string {
  const fileName = path.basename(filePath)
  try {
    const dimensions = imageSize(filePath)
    const width = Number(dimensions.width)
    const height = Number(dimensions.height)
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return `${fileName} - ${Math.round(width)} x ${Math.round(height)}px`
    }
  } catch (error) {
    console.warn(`Unable to read image dimensions for ${filePath}`, error)
  }
  return fileName
}

function listSiblingImages(selectedUri: vscode.Uri): string[] {
  const selectedPath = path.resolve(selectedUri.fsPath)
  const folderPath = path.dirname(selectedPath)
  let imagePaths: string[] = []

  try {
    imagePaths = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => {
        if (!entry.isFile() || entry.name.startsWith('._')) {
          return false
        }
        return SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      })
      .map((entry) => path.join(folderPath, entry.name))
      .sort((left, right) =>
        path.basename(left).localeCompare(path.basename(right), undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      )
  } catch (error) {
    console.warn(`Unable to list sibling images for ${selectedPath}`, error)
  }

  const selectedKey = normalizeFsPath(selectedPath)
  if (!imagePaths.some((filePath) => normalizeFsPath(filePath) === selectedKey)) {
    imagePaths.unshift(selectedPath)
  }

  return imagePaths
}

function createViewerBootstrap(
  webview: vscode.Webview,
  documentUri: vscode.Uri,
  initialMode: ViewerMode
): ImageViewerBootstrap {
  const imagePaths = listSiblingImages(documentUri)
  const selectedKey = normalizeFsPath(documentUri.fsPath)
  const images = imagePaths.map((filePath) => ({
    fsPath: filePath,
    src: webview.asWebviewUri(vscode.Uri.file(filePath)).toString(),
    name: readImageLabel(filePath),
    alt: path.basename(filePath)
  }))
  const selectedIndex = imagePaths.findIndex(
    (filePath) => normalizeFsPath(filePath) === selectedKey
  )

  return {
    images,
    defaultIndex: selectedIndex >= 0 ? selectedIndex : 0,
    initialMode
  }
}

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function createCustomEditorHtml(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  bootstrap: ImageViewerBootstrap
): string {
  const htmlPath = path.join(context.extensionPath, DIST_WEBVIEW_INDEX_HTML)
  let html = fs.readFileSync(htmlPath, 'utf8')

  html = html
    .replace('$currentView$', () => WEBVIEW_NAMES.SingleImageViewer)
    .replace('$vscodeEnv$', () => serializeForInlineScript({ language: vscode.env.language }))
    .replace('$commandArgs$', () => serializeForInlineScript([bootstrap]))

  return html.replace(
    /\b(src|href)=(["'])\/([^"']+)\2/g,
    (_match, attribute: string, quote: string, assetPath: string) => {
      const assetUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, DIST_WEBVIEW_PATH, assetPath)
      )
      return `${attribute}=${quote}${assetUri.toString()}${quote}`
    }
  )
}

class ImageViewerEditorProvider implements vscode.CustomReadonlyEditorProvider<ImageViewerDocument> {
  constructor(private readonly context: vscode.ExtensionContext) {}

  openCustomDocument(uri: vscode.Uri): ImageViewerDocument {
    return new ImageViewerDocument(uri)
  }

  resolveCustomEditor(
    document: ImageViewerDocument,
    webviewPanel: vscode.WebviewPanel
  ): void {
    const distRoot = vscode.Uri.joinPath(this.context.extensionUri, DIST_WEBVIEW_PATH)
    const documentFolder = vscode.Uri.file(path.dirname(document.uri.fsPath))
    const savedMode = this.context.globalState.get<ViewerMode>(VIEW_MODE_STATE_KEY)
    const initialMode: ViewerMode = savedMode === 'fit' ? 'fit' : 'native'
    const bootstrap = createViewerBootstrap(webviewPanel.webview, document.uri, initialMode)
    const allowedImages = new Map(
      bootstrap.images.map((image) => [normalizeFsPath(image.fsPath), image])
    )
    let disposed = false

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [distRoot, documentFolder]
    }
    webviewPanel.webview.html = createCustomEditorHtml(
      this.context,
      webviewPanel.webview,
      bootstrap
    )

    const messageSubscription = webviewPanel.webview.onDidReceiveMessage((message) => {
      if (message?.cmd === MESSAGE_CMD.CLOSE_CUSTOM_IMAGE_EDITOR) {
        webviewPanel.dispose()
        return
      }

      if (message?.cmd === MESSAGE_CMD.SAVE_VIEW_MODE) {
        const mode = message?.data?.mode
        if (mode === 'fit' || mode === 'native') {
          void this.context.globalState.update(VIEW_MODE_STATE_KEY, mode)
        }
        return
      }

      if (message?.cmd !== MESSAGE_CMD.REVEAL_IMAGE_IN_EXPLORER) {
        return
      }

      const requestedPath = String(message?.data?.fsPath ?? '').trim()
      if (!requestedPath) {
        return
      }
      const image = allowedImages.get(normalizeFsPath(requestedPath))
      if (!image) {
        return
      }

      webviewPanel.title = path.basename(image.fsPath)
      void vscode.commands
        .executeCommand('revealInExplorer', vscode.Uri.file(image.fsPath))
        .then(() => {
          if (!disposed) {
            webviewPanel.reveal(webviewPanel.viewColumn, false)
          }
        })
    })

    webviewPanel.onDidDispose(() => {
      disposed = true
      messageSubscription.dispose()
    })
  }
}

type EditorAssociations = Record<string, string>

function readGlobalEditorAssociations(): EditorAssociations {
  return vscode.workspace
    .getConfiguration('workbench')
    .inspect<EditorAssociations>('editorAssociations')
    ?.globalValue ?? {}
}

async function writeGlobalEditorAssociations(value: EditorAssociations): Promise<void> {
  await vscode.workspace
    .getConfiguration('workbench')
    .update('editorAssociations', value, vscode.ConfigurationTarget.Global)
}

async function setAsDefaultImageViewer(): Promise<void> {
  const current = readGlobalEditorAssociations()
  const next = { ...current }
  for (const pattern of IMAGE_FILE_PATTERNS) {
    next[pattern] = IMAGE_EDITOR_VIEW_TYPE
  }
  await writeGlobalEditorAssociations(next)
  void vscode.window.showInformationMessage(
    'Image Viewer is now the default editor for supported images.'
  )
}

async function restoreBuiltInImageViewer(): Promise<void> {
  const current = readGlobalEditorAssociations()
  const next: EditorAssociations = {}
  for (const [pattern, editor] of Object.entries(current)) {
    if (editor !== IMAGE_EDITOR_VIEW_TYPE) {
      next[pattern] = editor
    }
  }
  await writeGlobalEditorAssociations(next)
  void vscode.window.showInformationMessage(
    "VS Code's built-in image editor is restored as the default."
  )
}

export function registerCustomImageEditor(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      IMAGE_EDITOR_VIEW_TYPE,
      new ImageViewerEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: false },
        supportsMultipleEditorsPerDocument: false
      }
    ),
    vscode.commands.registerCommand(
      EXTENSION_COMMANDS.SET_AS_DEFAULT_IMAGE_VIEWER,
      setAsDefaultImageViewer
    ),
    vscode.commands.registerCommand(
      EXTENSION_COMMANDS.RESTORE_BUILT_IN_IMAGE_VIEWER,
      restoreBuiltInImageViewer
    )
  )
}
