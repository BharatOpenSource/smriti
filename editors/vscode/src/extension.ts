import * as path from 'path'
import { ExtensionContext } from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'

let client: LanguageClient

export function activate(context: ExtensionContext) {
  // The compiled LSP server lives two directories up from this extension root.
  // Extension root: <repo>/editors/vscode/
  // Server:         <repo>/dist/lsp/server.js
  const serverModule = context.asAbsolutePath(
    path.join('..', '..', 'dist', 'lsp', 'server.js'),
  )

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'smriti' },
    ],
  }

  client = new LanguageClient(
    'smriti',
    'Smriti Language Server',
    serverOptions,
    clientOptions,
  )

  client.start()
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined
  return client.stop()
}
