const vscode = require('vscode')
const path = require('path')
const fs = require('fs').promises
const fetch = require('node-fetch-commonjs')

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	context.subscriptions.push(makeGenerateCommitMessageTask())
}

function deactivate() {}

async function makeGenerateCommitMessageTask() {
	return vscode.commands.registerCommand('ai-tool.generateCommitMessage', async function (args) {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.SourceControl,
			title: "AI Tool",
			cancellable: false
		}, async () => {
			const repository = await selectRepository(args)
			const gitDiffString = await getGitDiff(repository)
			const message = await generateCommitMessage(gitDiffString)
			repository.inputBox.value = message
		})
	})
}

async function selectRepository(args) {
	const repositories = vscode.extensions.getExtension('vscode.git').exports.getAPI(1).repositories

	if (args) {
		for (let i = 0; i < repositories.length; i++) {
			if (repositories[i].rootUri.path == args.rootUri.path) {
				return repositories[i]
			}
		}
	} else {
		const selectedItem = await vscode.window.showQuickPick(repositories.map((repository, index) => {
			return {
				label: path.basename(repository.rootUri.path),
				description: repository.rootUri.path,
				index: index
			}
		}), 'Select repository')
	
		return repositories[selectedItem.index]
	}	
}

async function getGitDiff(repository) {
	return repository.diff(true)
}

async function generateCommitMessage(gitDiffString) {
	const config = vscode.workspace.getConfiguration('ai-tool')
	const prompt = (await fs.readFile(path.join(__dirname, '/../resources/prompts/commit.template'), 'utf8')) + gitDiffString

	const response = await fetch(config.get('baseURL') + "/chat/completions", {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + config.get('apiKey')
		},
		body: JSON.stringify({
			"model": config.get('model'),
			"messages": [
				{
					"role": "user",
					"content": prompt
				}
			]
		})
	})

	content = JSON.parse((await response.json()).choices[0].message.content)
	
	let points = content.body
	let body = ''

	if (! Array.isArray(points)) {
		points = points.split('\n');
	} 

	points.forEach((point, index, points) => {
		body += point.trim().replace('+', '-').replace('*', '-')
		if (index != points.length - 1) {
			body += '\n'
		}
	})

	return content.type.trim() + ': ' + content.subject.trim() + '\n\n' + body.trimEnd('\n')
}

module.exports = {
	activate,
	deactivate
}
