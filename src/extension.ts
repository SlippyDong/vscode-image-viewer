import * as vscode from 'vscode'
import { registerCustomImageEditor } from './customImageEditor'

export function activate(context: vscode.ExtensionContext): void {
  registerCustomImageEditor(context)
}

export function deactivate(): void {}
