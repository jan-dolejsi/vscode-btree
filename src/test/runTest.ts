import * as path from 'path';

import { runTests } from 'vscode-test';
import { URI } from 'vscode-uri';

async function main(): Promise<void> {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// The path to the workspace, where the files will be created
		const folderUri = "--folder-uri=" + URI.file(path.resolve(extensionDevelopmentPath, 'src/test/workspace'));
		const launchArgs = [folderUri, "--disable-extensions"];

		console.log(`Passing command line arguments: --extensionDevelopmentPath=${extensionDevelopmentPath} --extensionTestsPath=${extensionTestsPath} ${launchArgs.join(' ')}`);

		// Download VS Code, unzip it and run the integration test
		await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs });
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();
