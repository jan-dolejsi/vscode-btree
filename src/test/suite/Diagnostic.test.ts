import { expect, assert } from 'chai';
import { suite, before, beforeEach } from 'mocha';

import * as vscode from 'vscode';
import * as path from 'path';
import * as extension from '../../extension';
import { fail } from 'assert';
import { openTreeDocument, activateExtension, prepareWorkspaceFolder, clearWorkspaceFolder } from './testUtils';
import { assertDefined } from '../../utils';

suite('Diagnostic Test Suite', () => {

	before(async () => {
		vscode.window.showInformationMessage('Start Workspace tests.');
		await clearWorkspaceFolder();
		await activateExtension();
	});

	beforeEach(async () => {
		extension.treeWorkspaceRegistry?.clear();

		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}
	});

	test('undeclared actions show up when manifest is created', async () => {

		const treeWorkspaceRegistry = assertDefined(extension.treeWorkspaceRegistry, "tree workspace registry");
		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}
		const folder1Path = await prepareWorkspaceFolder('folder1', 'folder1_forManifestCreation');
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

		await treeWorkspace.initialization({
			action: async () => {
				// create empty manifest file
				await treeWorkspace.saveManifest();
			}
		});

		expect(treeWorkspace.getUndeclaredActions(tree1), "undeclared actions with empty manifest").to.be.empty;

		await treeWorkspaceRegistry.initialization({
			action: async () => {
				await treeWorkspace.addDeclaredAction('action1');
				await treeWorkspace.saveManifest();
			},
		});

		expect(treeWorkspace.getUndeclaredActions(tree1), "undeclared actions with manifest=[action1]").to.include.members(['action2']);

		{
			const diagnostics = vscode.languages.getDiagnostics(tree1Uri);
			expect(diagnostics).to.have.lengthOf(1, "diagnostic items for undeclared actions/conditions with manifest=[action1]");
			const diagnostic1 = diagnostics[0];

			expect(diagnostic1.relatedInformation, 'related info').to.not.be.undefined;
			expect(diagnostic1.relatedInformation, 'related info').to.be.lengthOf(1);
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			// const relatedInfo0 = diagnostic1.relatedInformation![0];
			// expect(relatedInfo0.location.range).to.deep.equal(new vscode.Range(123, 123, 123, 123));
		}

		await treeWorkspaceRegistry.initialization({
			action: async () => {
				await treeWorkspace.addDeclaredCondition('condition1');
				await treeWorkspace.saveManifest();
			}
		});

		expect(treeWorkspace.getUndeclaredConditions(tree1), "undeclared conditions with manifest=[condition1]").to.include.members(['condition2']);

		{
			const diagnostics = vscode.languages.getDiagnostics(tree1Uri);
			expect(diagnostics).to.have.lengthOf(2, "diagnostic items for undeclared actions/conditions with manifest=[action1, condition1]");
		}
	});
});



