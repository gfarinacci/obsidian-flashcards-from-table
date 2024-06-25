import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf } from 'obsidian';

// Remember to rename these classes and interfaces!

interface DiceRollerSettings {
	showAnswer: string;
}

const DEFAULT_SETTINGS: DiceRollerSettings = {
	showAnswer: '1'
}

export const VIEW_TYPE_DICE_ROLLER = "dice-roller";

export class DiceRollerView extends ItemView {
	inputText: string;
	metaEnd: number;
	showAnswer: string;
	meta: { [key: string]: string };
	question: {
		'headers': string[],
		'data': string[][]
	}

	constructor(leaf: WorkspaceLeaf) {
    	super(leaf);
		this.icon = "dice";
		this.question = {headers: [], data: []};
	}

  getViewType() {
    return VIEW_TYPE_DICE_ROLLER;
  }

  getDisplayText() {
    return "Dice Roller";
  }

  async onOpen() {
	this.showAnswer = this.app.plugins.plugins['obsidian-flashcards-from-table'].settings.showAnswer;

	const noteFile = this.app.workspace.getActiveFile();
	if(noteFile && noteFile.name) {
		const inputText = await this.app.vault.read(noteFile)
		this.inputText = inputText;
		let text = inputText.split('\n');
		
		let metaEnd = 0
		text.map((line, index) => {
			if(line === '---') {
				metaEnd = index
			}
		});
		this.metaEnd = metaEnd;
		
		let meta = {}
		text.slice(1, metaEnd).map((line) => {
			const [key, value] = line.split(': ')
			meta[key] = value
		})

		let loadedData = {
			headers: [],
			data: []
		}

		if(meta['fileType'] && meta['fileType'] === 'flashcards') {
			text.slice(metaEnd + 1, text.length).map((line, index) => {
				if(index !== 1 && line !== '') {
					if(index === 0) {
						loadedData['headers'] = line.split('|').map((cell) => cell.trim()).filter((cell) => cell !== '')
					} else {
						loadedData['data'].push(line.split('|').map((cell) => cell.trim()).filter((cell) => cell !== ''))
					}
				}
			})
		}

		this.meta = meta

		this.question = loadedData
	}


	let randomIndex = Math.floor(Math.random() * this.question['data'].length);

	const container = this.containerEl.children[1];
	container.empty();
	container.createEl("h4", { text: "Dice Roller" });
	container.createEl("hr");
	if(this.meta['fileType'] === 'flashcards') {
		const questionText = container.createEl("div", { text: this.question['data'][randomIndex][0]});
		let answerText;
		let showAnswerButton;

		if(this && this.showAnswer === '1') {
			container.createEl("br");
			answerText = container.createEl('div', { text: this.question['data'][randomIndex][1], attr: { href: "#" }});
		} else {
			container.createEl("br");
			showAnswerButton =  container.createEl("button", { text: "Show answer"});
			answerText = container.createEl('div', { text: this.question['data'][randomIndex][1], attr: { style: "visibility: hidden; display: none;" } });
			showAnswerButton.addEventListener("click", () => {
				answerText.setAttribute("style", "visibility: visible;");
				showAnswerButton.setAttribute("style", "visibility: hidden; display: none;");
			})
		}

		container.createEl("hr");

		const skipButton = container.createEl("button", { text: "Skip", attr: { style: "margin-right: 10px" } });
		skipButton.addEventListener("click", () => {
			randomIndex = Math.floor(Math.random() * this.question['data'].length);
			
			questionText.setText(this.question['data'][randomIndex][0]);
			answerText.setText(this.question['data'][randomIndex][1]);
			if(this && this.showAnswer !== '1') {
				answerText.setAttribute("style", "visibility: hidden; display: none;");
				showAnswerButton.setAttribute("style", "visibility: visible;");
			}
		})

		const nextButton = container.createEl("button", { text: "Next", attr: { style: "margin-right: 10px" } });
		nextButton.addEventListener("click", () => {
			this.question['data'][randomIndex][3] = Number(this.question['data'][randomIndex][3]) + 1
			randomIndex = Math.floor(Math.random() * this.question['data'].length);
			
			questionText.setText(this.question['data'][randomIndex][0]);
			answerText.setText(this.question['data'][randomIndex][1]);
			if(this && this.showAnswer !== '1') {
				answerText.setAttribute("style", "visibility: hidden; display: none;");
				showAnswerButton.setAttribute("style", "visibility: visible;");
			}
		})
		
		const saveButton = container.createEl("button", { text: "Save", attr: { style: "margin-right: 10px" } });
		saveButton.addEventListener("click", async () => {
			const text = this.inputText.split('\n');
			const metaEnd = this.metaEnd;

			const markdown = ['---']

			text.slice(1, metaEnd).map((line) => {
				markdown.push(line)
			})

			markdown.push('---')

			text.slice(metaEnd + 1, metaEnd + 3).map((line) => {
				markdown.push(line)
			})

			this.question['data'].map((line) => {
				markdown.push(`| ${line[0]} | ${line[1]} | ${line[2]} | ${line[3]} |`)
			})

			this.app.vault.modify(noteFile, markdown.join('\n'))
		});
	} else {
		container.createEl("p", { text: "Unable to find flashcards" });
		container.createEl("p", { text: "Try open the correct file and reload" });
		container.createEl("hr");
		const reloadButton = container.createEl("button", { text: "Reload" });
		reloadButton.addEventListener("click", () => {
			this.onOpen();
		})
	}

  }

  async onClose() {
    // Nothing to clean up.
  }
}

export default class FlashcardsFromTablePlugin extends Plugin {
	settings: DiceRollerSettings;

	async onload() {
		// This adds a command that init the flashcards table
		this.addCommand({
			id: 'init-flashcards-table',
			name: 'Init Flashcards Table',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const today = new Date().toISOString().split('T')[0]

				const markdown = [
					'---',
					'fileType: flashcards',
					'---',
					'| Question | Answer | Last Review | Count |',
					'| -- | -- | -- | -- |',
					`| Question 1 | Answer 1 | ${today} | 0 |`,
					`| Question 2 | Answer 2 | ${today} | 0 |`,
				]
				editor.replaceRange(markdown.join('\n'), editor.getCursor())
			}
		});

		
		this.registerView(
			VIEW_TYPE_DICE_ROLLER,
			(leaf) => new DiceRollerView(leaf)
		);
		
		this.addRibbonIcon("dice", "Oper Dice Roller", () => {
			this.activateView();
		});

		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			// console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async activateView() {
		const { workspace } = this.app;
	
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_DICE_ROLLER);
	
		if (leaves.length > 0) {
		  // A leaf with our view already exists, use that
		  leaf = leaves[0];
		} else {
		  // Our view could not be found in the workspace, create a new leaf
		  // in the right sidebar for it
		  leaf = workspace.getRightLeaf(false);
		  await leaf.setViewState({ type: VIEW_TYPE_DICE_ROLLER, active: true});
		}
		
		// "Reveal" the leaf in case it is in a collapsed sidebar
		workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: FlashcardsFromTablePlugin;

	constructor(app: App, plugin: FlashcardsFromTablePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for Flashcard from Table plugin.'});

		new Setting(containerEl)
			.setName('Show answers')
			.setDesc('Show answers to the questions in flashcards')
			.addText(text => text
				.setPlaceholder('1: Show answers, 0: Hide answers')
				.setValue(this.plugin.settings.showAnswer)
				.onChange(async (value) => {
					this.plugin.settings.showAnswer = value;
					await this.plugin.saveSettings();
				}));
	}
}