/* eslint-disable no-eval */
/* eslint-disable no-undef */
import fs from "fs";
import store from "../Modules/Store";
import { accountsList } from "../Config";
import { logger } from "../Libs";

export default class ScriptLoader {
	async mount() {
		for (const username in accountsList) {
			const scriptName = accountsList[username].script;

			if (scriptName) {
				const unSubscribe = store.subscribe(() => {
					if (store.getState().accounts[username].status == "IDLE") {
						this.runScript(username, scriptName);
						unSubscribe();
					}
				});
			}
		}
	}

	async runScript(username, scriptName) {
		let textCode;
		try {
			textCode = await this.getScriptFile(scriptName);
		} catch (error) {
			logger.warn(`Script ${scriptName} not found`);
			return false;
		}
		(async function() {
			Object.defineProperty(global, "Account", {
				get: () => {
					return store.getState().accounts[username];
				},
				enumerable: true
			});
			try {
				eval.call(global, textCode);
			} catch (error) {
				return logger.error(error);
			}
			const generator = start();
			logger.info(`Script ${scriptName} executed`);
			let s = 1;

			while (true) {
				const next = await generator.next();

				if (this.isGeneratorFunction(next.value)) {
					const generator2 = next.value;

					while (true) {
						if ((await generator2.next(username)).done == true) {
							break;
						}
					}
				}
				if (next.done === true) {
					logger.info(`Script ${scriptName} ended`);
					break;
				}
				if (s == 5000) {
					logger.error(
						"Infinite loop detected in script " + scriptName
					);
					break;
				}
				s++;
			}
		}.call(this));
	}

	isGeneratorFunction(fn) {
		try {
			const name = fn.toString();
			if (
				name == "[object Generator]" ||
				name == "[object AsyncGenerator]"
			) {
				return true;
			}
		} catch (error) {}

		return false;
	}

	getScriptFile(fileName) {
		return new Promise((resolve, reject) => {
			fs.readFile(`./src/Scripts/${fileName}.js`, (error, data) =>
				error ? reject(error) : resolve(data.toString())
			);
		});
	}
}