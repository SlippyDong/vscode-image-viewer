import { registerWebview } from '@easy_vscode/webview'
import SingleImageViewer from './SingleImageViewer'
import { AntdWebviewShell } from './AntdWebviewShell'

const webviewComponents = {
  SingleImageViewer
}

registerWebview(webviewComponents, { Root: AntdWebviewShell })
