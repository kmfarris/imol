import { attachDeclIds, checkModule, diagnosticsToJson } from "@kmfarris/imol-check";
import { loadModuleFromFile } from "@kmfarris/imol-load";
import { ImolSyntaxError } from "@kmfarris/imol-syntax";
import {
    createConnection,
    TextDocuments,
    DiagnosticSeverity,
    TextDocumentSyncKind,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const connection = createConnection();
const documents = new TextDocuments(TextDocument);

function imolSeverity(code: string): DiagnosticSeverity {
    if (code.startsWith("W_")) return DiagnosticSeverity.Warning;
    return DiagnosticSeverity.Error;
}

function diagFromSyntax(e: ImolSyntaxError) {
    return {
        severity: DiagnosticSeverity.Error,
        range: {
            start: { line: Math.max(0, e.span.line - 1), character: Math.max(0, e.span.col - 1) },
            end: { line: Math.max(0, e.span.line - 1), character: Math.max(0, e.span.col) },
        },
        message: `${e.code}: ${e.message}`,
        source: "imol",
        code: e.code,
    };
}

async function checkPath(uri: string) {
    const path = fileURLToPath(uri);
    const root = dirname(path);
    try {
        const mod = await loadModuleFromFile(path, { projectRoot: root });
        const result = checkModule(mod);
        const withIds = attachDeclIds(mod, result.diagnostics);
        return diagnosticsToJson(withIds).map((d) => ({
            severity: imolSeverity(d.code),
            range: {
                start: { line: Math.max(0, d.span.line - 1), character: Math.max(0, d.span.col - 1) },
                end: { line: Math.max(0, d.span.line - 1), character: Math.max(0, d.span.col) },
            },
            message: `${d.code}: ${d.message}`,
            source: "imol",
            code: d.code,
        }));
    } catch (e) {
        if (e instanceof ImolSyntaxError) return [diagFromSyntax(e)];
        return [
            {
                severity: DiagnosticSeverity.Error,
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
                message: e instanceof Error ? e.message : String(e),
                source: "imol",
            },
        ];
    }
}

async function publish(uri: string) {
    if (!uri.endsWith(".imol")) return;
    const diags = await checkPath(uri);
    connection.sendDiagnostics({ uri, diagnostics: diags });
}

connection.onInitialize(() => ({
    capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
    },
    serverInfo: { name: "imol-lsp", version: "0.7.0" },
}));

documents.onDidOpen((e) => {
    void publish(e.document.uri);
});
documents.onDidSave((e) => {
    void publish(e.document.uri);
});

documents.listen(connection);
connection.listen();
