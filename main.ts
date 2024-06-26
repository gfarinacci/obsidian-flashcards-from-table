import { log } from 'console';
import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf, TFile } from 'obsidian';

interface DiceRollerSettings {
	showAnswer: string;
}

const DEFAULT_SETTINGS: DiceRollerSettings = {
	showAnswer: '1'
}

export const VIEW_TYPE_DICE_ROLLER = 'dice-roller';

export class DiceRollerView extends ItemView {
	showAnswer: string;
	noteFile: TFile | null;
	inputText: string;
	metaEnd: number;
	meta: { [key: string]: string };
	question: {
		'headers': string[],
		'data': string[][]
	}
	navigation: boolean;
	icon: string;
	randomIndex: number;

	constructor(leaf: WorkspaceLeaf) {
    	super(leaf);
		this.icon = 'dice';
		this.question = {headers: [], data: []};
		this.navigation = true;
		this.meta = {};
		this.randomIndex = 0;
	}

	getViewType() {
		return VIEW_TYPE_DICE_ROLLER;
	}

	getDisplayText() {
		return 'Dice Roller';
	}

	getSettings() {
		// TODO: Controllare se funziona o revertare
		return this.app.plugins.getPlugin('obsidian-flashcards-from-table')?.settings;
	}

	getActiveFile() {
		return this.app.workspace.getActiveFile();
	}

	async loadNoteFile(noteFile: TFile | null) {
		if(noteFile && noteFile.name) {
			this.inputText = await this.app.vault.read(noteFile)

			let text = this.inputText.split('\n');
			
			this.metaEnd = text.lastIndexOf('---');
			
			text.slice(1, this.metaEnd).map((line) => {
				const [key, value] = line.split(': ')
				this.meta[key] = value
			})

			if(this.meta['fileType'] && this.meta['fileType'] === 'flashcards') {
				text.slice(this.metaEnd + 1, text.length).map((line, index) => {
					if(index !== 1 && line !== '') {
						if(index === 0) {
							this.question['headers'] = line.split('|').map((cell) => cell.trim()).filter((cell) => cell !== '')
						} else {
							this.question['data'].push(line.split('|').map((cell) => cell.trim()).filter((cell) => cell !== ''))
						}
					}
				})
			}
		}
	}

	getRandomIndex() {
		this.question['data'].map((line) => {
			if(line.length === 4) {
				line.push('0')
			}
		})

		if (this.question['data'].filter((line) => line[4] === '0').length === 0) {
			this.question['data'].map((line) => {line[4] = '0'})
		}

		const min = Math.min(...this.question['data'].filter((line) => line[4] === '0').map((line) => {return Number(line[3])}))

		const minDataset = this.question['data'].filter((line) => Number(line[3]) === min)

		const randomIndex = Math.floor(Math.random() * minDataset.length);

		this.question['data'].map((line, index) => {
			if (line[0] === minDataset[randomIndex][0]) {
				this.randomIndex = index
			}
		})

		return this.randomIndex;
	}

	getEmptyContainer(): Element {
		const container = this.containerEl.children[1];
		container.empty();

		return container;
	}

	getContainerHeader(container: Element) {
		container.createEl("h4", { text: "Dice Roller" });
		container.createEl("hr");

	}

	getErrorContent(container: Element) {
		container.createEl("p", { text: "Unable to load flashcards" });
		container.createEl("p", { text: "Open the correct file and reopen" });
		container.createEl("hr");
	}

	getQuestionBody(container: Element, randomIndex: number) {
		const questionText = container.createEl("div", { text: this.question['data'][randomIndex][0]});
		container.createEl("br");

		let answerText : Element;
		let showAnswerButton: Element | null = null;

		if(this && this.showAnswer === '1') {
			answerText = container.createEl('div', { text: this.question['data'][randomIndex][1] });
		} else {
			showAnswerButton =  container.createEl("button", { text: "Show answer"});
			answerText = container.createEl('div', { text: this.question['data'][randomIndex][1], attr: { style: "visibility: hidden; display: none;" } });
			
			showAnswerButton.addEventListener("click", () => {
				answerText.setAttribute("style", "visibility: visible;");
				if (showAnswerButton) {
					showAnswerButton.setAttribute("style", "visibility: hidden; display: none;");
				}
			})
		}
		container.createEl("hr");

		return [questionText, answerText, showAnswerButton]
	}

	getSkipButton(container: Element, questionText: Element, answerText: Element, showAnswerButton: Element | null) {
		const skipButton = container.createEl("button", { text: "Skip", attr: { style: "margin-right: 10px" } });
		skipButton.addEventListener("click", () => {
			const randomIndex = this.getRandomIndex();
			
			questionText.setText(this.question['data'][randomIndex][0]);
			answerText.setText(this.question['data'][randomIndex][1]);
			if(showAnswerButton) {
				answerText.setAttribute("style", "visibility: hidden; display: none;");
				showAnswerButton.setAttribute("style", "visibility: visible;");
			}
		})
	}

	async updateFlashcardDataset() {
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

		if (this.noteFile) {
			this.app.vault.modify(this.noteFile, markdown.join('\n'))
		}
	}

	getToday() {
		return new Date().toISOString().split('T')[0]
	}

	updateDataset() {
		this.question['data'][this.randomIndex][2] = this.getToday()
		this.question['data'][this.randomIndex][3] = String(Number(this.question['data'][this.randomIndex][3]) + 1)
		this.updateFlashcardDataset();
	}

	getNextButton(container: Element, questionText: Element, answerText: Element, showAnswerButton: Element | null) {
		const nextButton = container.createEl("button", { text: "Next", attr: { style: "margin-right: 10px" } });
		nextButton.addEventListener("click", () => {
			this.updateDataset();

			const randomIndex = this.getRandomIndex();
			
			questionText.setText(this.question['data'][randomIndex][0]);
			answerText.setText(this.question['data'][randomIndex][1]);
			if(showAnswerButton) {
				answerText.setAttribute("style", "visibility: hidden; display: none;");
				showAnswerButton.setAttribute("style", "visibility: visible;");
			}
		});
	}

	getControlButtons(container: Element, questionText: Element | null, answerText: Element | null, showAnswerButton: Element | null, randomIndex: number) {
		if (questionText && answerText) {
			this.getSkipButton(container, questionText, answerText, showAnswerButton)
	
			this.getNextButton(container, questionText, answerText, showAnswerButton)
		}
	}

	getItemView() {
		const container = this.getEmptyContainer();

		this.getContainerHeader(container);

		let randomIndex = this.getRandomIndex();

		if(this.meta['fileType'] && this.meta['fileType'] === 'flashcards') {
			const [questionText, answerText, showAnswerButton] = this.getQuestionBody(container, randomIndex);

			this.getControlButtons(container, questionText, answerText, showAnswerButton, randomIndex)
		} else {
			this.getErrorContent(container);
			// TODO: Add a button to open the correct file
		}
	}

	async onOpen() {
		this.showAnswer = this.getSettings().showAnswer;

		this.noteFile = this.getActiveFile();

		await this.loadNoteFile(this.noteFile);

		this.getItemView();
	}

	async onClose() {
		// Nothing to clean up.
	}
}

export default class FlashcardsFromTablePlugin extends Plugin {
	settings: DiceRollerSettings;

	getToday() {
		return new Date().toISOString().split('T')[0]
	}

	getInitRow = (index: number) => {
		const today = this.getToday()
		return `| Question ${index} | Answer ${index} | ${today} | 0 |`
	}

	async onload() {
		// This adds a command that init the flashcards table
		this.addCommand({
			id: 'init-flashcards-table',
			name: 'Init Flashcards Table',
			editorCallback: (editor: Editor, view: MarkdownView) => {

				const markdown = [
					'---',
					'fileType: flashcards',
					'---',
					'| Question | Answer | Last Review | Count |',
					'| -- | -- | -- | -- |',
					this.getInitRow(1),
					this.getInitRow(2),
					this.getInitRow(3),
					this.getInitRow(4),
					this.getInitRow(5),
				]
				editor.replaceRange(markdown.join('\n'), editor.getCursor())
			}
		});

		
		this.registerView(
			VIEW_TYPE_DICE_ROLLER,
			(leaf) => new DiceRollerView(leaf)
		);
		
		this.addRibbonIcon('dice', 'Oper Dice Roller', () => {
			this.activateView();
		});

		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new DiceRollerSettingTab(this.app, this));

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
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_DICE_ROLLER, active: true});
			}
		}
		
		// "Reveal" the leaf in case it is in a collapsed sidebar
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class DiceRollerSettingTab extends PluginSettingTab {
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