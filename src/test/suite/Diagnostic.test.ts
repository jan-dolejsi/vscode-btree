import { expect, assert } from 'chai';
import { suite, before, beforeEach, afterEach } from 'mocha';

import * as vscode from 'vscode';
import * as path from 'path';
import * as extension from '../../extension';
import { fail } from 'assert';
import { openTreeDocument, activateExtension, deleteTempFiles } from './testUtils';

suite('Diagnostic Test Suite', () => {

	before(async () => {
		vscode.window.showInformationMessage('Start Workspace tests.');
		await activateExtension();
	});

	beforeEach(async () => {
		extension.treeWorkspaceRegistry.clear();

		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];

		filesToDelete.push(vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'folder1', 'btrees.json')));
		await deleteTempFiles(filesToDelete);
	});

	const filesToDelete = new Array<vscode.Uri>();

	afterEach(async () => {
		await deleteTempFiles(filesToDelete);
	});

	test('undeclared actions show up when manifest is created', async () => {

		const treeWorkspaceRegistry = extension.treeWorkspaceRegistry;
		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}

		const workspaceFolder = vscode.workspace.workspaceFolders[0];
		const folder1Path = path.join(workspaceFolder.uri.fsPath, 'folder1');
		const tree1Path = path.join(folder1Path, 'tree1.tree');
		const tree1Uri = vscode.Uri.file(tree1Path);

		const treeWorkspace = (await treeWorkspaceRegistry.change({
			action: async () => await openTreeDocument(tree1Uri),
			filter: treeEvent => treeEvent.uri.fsPath === tree1Path
		})).workspace;

		if (!treeWorkspace.isInitialized()) {
			await treeWorkspace.initialization();
		}

		expect(treeWorkspace.getActionsUsed(), "actions used").to.include.members(['action1', 'action2']);
		expect(treeWorkspace.getConditionsUsed(), "conditions used").to.include.members(['condition1', 'condition2']);

		expect(treeWorkspace.getActionsDeclared(), "actions declared").to.be.undefined;
		expect(treeWorkspace.getConditionsDeclared(), "conditions declared").to.be.undefined;

		const tree1 = treeWorkspace.getTree(tree1Uri);
		if (!tree1) { fail('Tree should be in the workspace'); }

		try {
			await treeWorkspace.initialization({
				action: async () => {
					// create empty manifest file
					filesToDelete.push(vscode.Uri.file(treeWorkspace.getManifestPath()));
					await treeWorkspace.saveManifest();
				}
			});

			expect(treeWorkspace.getUndeclaredActions(tree1), "undeclared actions with empty manifest").to.be.empty;

			await treeWorkspaceRegistry.initialization({
				action: async () => await treeWorkspace.addDeclaredAction('action1'),
			});

			expect(treeWorkspace.getUndeclaredActions(tree1), "undeclared actions with manifest=[action1]").to.include.members(['action2']);

			{
				const diagnostics = vscode.languages.getDiagnostics(tree1Uri);
				expect(diagnostics).to.have.lengthOf(1, "diagnostic items for undeclared actions/conditions with manifest=[action1]");
			}

			await treeWorkspaceRegistry.initialization({
				action: async () => await treeWorkspace.addDeclaredCondition('condition1')
			});

			expect(treeWorkspace.getUndeclaredConditions(tree1), "undeclared conditions with manifest=[condition1]").to.include.members(['condition2']);

			{
				const diagnostics = vscode.languages.getDiagnostics(tree1Uri);
				expect(diagnostics).to.have.lengthOf(2, "diagnostic items for undeclared actions/conditions with manifest=[action1, condition1]");
			}
		}
		finally {
			await deleteTempFiles(filesToDelete);
		}
	});
});



