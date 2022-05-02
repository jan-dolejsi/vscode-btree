import { expect, assert } from 'chai';
import { suite, before, beforeEach } from 'mocha';

import * as vscode from 'vscode';
import * as path from 'path';
import * as extension from '../../extension';
import { AssertionError } from 'assert';
import { TreeCompletionItemProvider } from '../../TreeCompletionItemProvider';
import { Uri } from 'vscode';
import { activateExtension, prepareWorkspaceFolder, clearWorkspaceFolder } from './testUtils';
import { assertDefined } from '../../utils';

suite('Completion Item provider Test Suite', () => {

	before(async () => {
		vscode.window.showInformationMessage('Start Completion Item tests.');
		await clearWorkspaceFolder();
		await activateExtension();
	});

	beforeEach(() => {
		extension.treeWorkspaceRegistry?.clear();
	});

	test('auto-completion in folder without manifest', async () => {
		const treeWorkspaceRegistry = assertDefined(extension.treeWorkspaceRegistry, "tree workspace registry");

		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}

		const folder1Path = await prepareWorkspaceFolder('folder1', 'folder1_forAdditionalFileCreation');
		const newTreePath = path.join(folder1Path, 'newTree.tree');
		const newTreeUri = Uri.file(newTreePath);
		const newTreeContent = '->\n|\t';
		let newTreeDoc: vscode.TextDocument | undefined;

		const treeWorkspace = (await treeWorkspaceRegistry.change({
			action: async () => {
				await vscode.workspace.fs.writeFile(newTreeUri, Buffer.from(newTreeContent));
				newTreeDoc = await vscode.workspace.openTextDocument(newTreeUri);
			},
			filter: treeEvent => treeEvent.uri.fsPath === newTreePath
		})).workspace;

		if (!treeWorkspace.isInitialized()) {
			await treeWorkspace.initialization();
		}

		if (!newTreeDoc) {
			throw new AssertionError({ message: 'document not open' });
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token,
					{
						triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
						triggerCharacter: '('
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(['condition1', 'condition2']);
			expect(completionItems, "completion item count").to.have.lengthOf(2);
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token,
					{
						triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
						triggerCharacter: '['
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(['action1', 'action2']);
			expect(completionItems, "completion item count").to.have.lengthOf(2);
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token, {
						triggerKind: vscode.CompletionTriggerKind.Invoke,
						triggerCharacter: undefined
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			const expectedLabels = [
				'?', '->', '=N',
				'[action1]', '[action2]',
				'(condition1)', '(condition2)'
			];
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(expectedLabels);
		}
	});

	test('auto-completion in folder with manifest', async () => {
		const treeWorkspaceRegistry = assertDefined(extension.treeWorkspaceRegistry, "tree workspace registry");
		if (!vscode.workspace.workspaceFolders) {
			assert.fail('No workspace folder open');
		}

		const folder2Path = await prepareWorkspaceFolder('folder2', 'folder2_forAdditionalFileCreation');
		const newTreePath = path.join(folder2Path, 'newTree.tree');
		const newTreeUri = Uri.file(newTreePath);
		const newTreeContent = '->\n|\t';
		let newTreeDoc: vscode.TextDocument | undefined;

		const treeWorkspace = (await treeWorkspaceRegistry.change({
			action: async () => {
				await vscode.workspace.fs.writeFile(newTreeUri, Buffer.from(newTreeContent));
				newTreeDoc = await vscode.workspace.openTextDocument(newTreeUri);
			},
			filter: treeEvent => treeEvent.uri.fsPath === newTreePath
		})).workspace;

		if (!treeWorkspace.isInitialized()) {
			await treeWorkspace.initialization();
		}

		if (!newTreeDoc) {
			throw new AssertionError({ message: 'document not open' });
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token,
					{
						triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
						triggerCharacter: '('
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(['condition1']);
			expect(completionItems, "completion item count").to.have.lengthOf(1);
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token,
					{
						triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
						triggerCharacter: '['
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(['action1']);
			expect(completionItems, "completion item count").to.have.lengthOf(1);
		}

		{
			const completionItems = new TreeCompletionItemProvider(treeWorkspaceRegistry)
				.provideCompletionItems(newTreeDoc, newTreeDoc.positionAt(newTreeContent.length),
					new vscode.CancellationTokenSource().token, {
						triggerKind: vscode.CompletionTriggerKind.Invoke,
						triggerCharacter: undefined
					});

			expect(completionItems, "completion item").to.not.be.undefined;
			const expectedLabels = [
				'?', '->', '=N',
				'[action1]',
				'(condition1)',
			];
			expect(completionItems?.map(c => c.label), "completion items").to.include.members(expectedLabels);
		}
	});
});
