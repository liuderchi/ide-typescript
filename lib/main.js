const path = require('path')
// const {AutoLanguageClient} = require('atom-languageclient')
const {AutoLanguageClient} = require(path.join(
  require('os').homedir(),
  'atom-languageclient-fork/build/lib/main.js'
))
// TODO update this to try to make it support js only? (don't do ts lint)
const {filter} = require('fuzzaldrin-plus')

class TypeScriptLanguageClient extends AutoLanguageClient {
  // NOTE will do ts parsing on js code
  getGrammarScopes () { return atom.config.get('ide-typescript.javascriptSupport') ? [ 'source.ts', 'source.tsx', 'source.js', 'source.js.jsx' ] : [ 'source.ts', 'source.tsx' ] }
  getLanguageName () { return 'TypeScript' }  // NOTE just for logging
  getServerName () { return 'SourceGraph' }  // NOTE just for logging

  startServerProcess () {
    // const args = [ 'node_modules/javascript-typescript-langserver/lib/language-server-stdio' ]
    const args = [ path.join(
      require('os').homedir(),
      'javascript-typescript-langserver-fork/lib/language-server-stdio'
    ) ]
    return super.spawnChildNode(args, { cwd: path.join(__dirname, '..') })
  }

  preInitialization (connection) {
    connection.onCustom('$/partialResult', () => {}) // Suppress partialResult until the language server honours 'streaming' detection
  }

  async getSuggestions (request) {
    const prefix = request.prefix.trim()
    const server = await this._serverManager.getServer(request.editor)
    if (server == null) {
      return Promise.resolve([])
    }

    if (prefix === '' && !request.activatedManually) {
      server.currentSuggestions = []
      return Promise.resolve([])
    }

    if (prefix.length > 0 && prefix != '.'  && server.currentSuggestions && server.currentSuggestions.length > 0) {
      // fuzzy filter on this.currentSuggestions
      return new Promise((resolve) => {
        const filtered = filter(server.currentSuggestions, prefix, {key: 'text'})
          .map(s => Object.assign({}, s, {replacementPrefix: prefix}))
        resolve(filtered)
      })
    }

    if (request.activatedManually === true || request.prefix.startsWith('.')) {
      return this.requestAndCleanSuggestions(request)
        .then(suggestions => server.currentSuggestions = suggestions)
    } else {
      server.currentSuggestions = []
      return Promise.resolve([])
    }
  }

  // TypeScript server returns long signature - we just want return type
  requestAndCleanSuggestions (request) {
    const extractReturnTypeToLeft = atom.config.get('ide-typescript.returnTypeInAutocomplete') === 'left'

    return super.getSuggestions(request).then(results => {
      if (results != null) {
        for(const result of results) {
          if (result.leftLabel && result.displayText) {
            this.setLeftAndRightFromParsedLeftLabel(result, extractReturnTypeToLeft)
          }
        }
      }
      return results
    })
  }

  setLeftAndRightFromParsedLeftLabel (result, extractReturnTypeToLeft) {
    const nameIndex = result.leftLabel.indexOf(result.displayText)
    if (nameIndex >= 0) {
      const signature = result.leftLabel.substr(nameIndex + result.displayText.length).trim()
      let paramsStart = -1
      let paramsEnd = -1
      let returnStart = -1
      let bracesDepth = 0
      for(let i = 0; i < signature.length; i++) {
        switch(signature[i]) {
          case '(': {
            if (bracesDepth++ === 0 && paramsStart === -1) {
              paramsStart = i;
            }
            break;
          }
          case ')': {
            if (--bracesDepth === 0 && paramsEnd === -1) {
              paramsEnd = i;
            }
            break;
          }
          case ':': {
            if (returnStart === -1 && bracesDepth === 0) {
              returnStart = i;
            }
            break;
          }
        }
      }
      if (extractReturnTypeToLeft) {
        if (paramsStart > -1) {
          result.rightLabel = signature.substring(paramsStart, paramsEnd + 1).trim()
        }
        if (returnStart > -1) {
          result.leftLabel = signature.substring(returnStart + 1).trim()
        }
      } else {
        result.rightLabel = signature.substring(paramsStart).trim()
        result.leftLabel = ''
      }
    }
  }

  // TODO overwrite atartExclusiveAdapters
  // startExclusiveAdapters(server: ActiveServer): void {
  //   NotificationsAdapter.attach(server.connection, this.name);
  //
  //   if (DocumentSyncAdapter.canAdapt(server.capabilities)) {
  //     server.docSyncAdapter = new DocumentSyncAdapter(server.connection, server.capabilities.textDocumentSync, editor =>
  //       this.shouldSyncForEditor(editor, server.projectPath),
  //     );
  //     server.disposable.add(server.docSyncAdapter);
  //   }
  //
  //   TODO use custom Linter Adapter to provide filter functionality
  //   server.linterPushV2 = new LinterPushV2Adapter(server.connection);
  //   if (this._linterDelegate != null) {
  //     server.linterPushV2.attach(this._linterDelegate);
  //   }
  // }
}

const tsLangClient = new TypeScriptLanguageClient()
console.warn('_linterDelegate', tsLangClient._linterDelegate)

module.exports = tsLangClient
