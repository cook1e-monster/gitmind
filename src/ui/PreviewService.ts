import type { CommitGroup } from "../core/commit-planner/CommitPlannerService";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "fs";

export class PreviewService {
	static async preview(groups: CommitGroup[]): Promise<boolean> {
		console.log("\n🔍 Vista previa de commits sugeridos:\n");
		for (const [i, group] of groups.entries()) {
			console.log(`Commit ${i + 1}: ${group.message}`);
			for (const file of group.files) {
				const exists = existsSync(file.path);
				const mark = exists ? "" : " ❌ archivo no encontrado";
				console.log(
					`  - [${file.type}] ${file.path}${file.isBinary ? " (binario)" : ""}${mark}`,
				);
			}
		}

		const rl = readline.createInterface({ input, output });
		const inputText = await rl.question(
			"¿Deseas continuar con estos commits? (y/n): ",
		);
		rl.close();
		return inputText.toLowerCase() === "y";
	}

	static async interactiveEdit(groups: CommitGroup[]): Promise<CommitGroup[]> {
		const rl = readline.createInterface({ input, output });
		console.log(
			"\n🛠 Puedes editar los mensajes de commit (deja vacío para mantener el actual):\n",
		);
		for (const group of groups) {
			const inputText = await rl.question(
				`Mensaje actual: "${group.message}"\nNuevo mensaje (opcional): `,
			);
			if (inputText.trim()) {
				group.message = inputText.trim();
			}
		}
		rl.close();
		return groups
			.map((group) => ({
				...group,
				files: group.files.filter((file) => {
					const exists = existsSync(file.path);
					if (!exists)
						console.warn(`⚠️ Archivo omitido por no existir: ${file.path}`);
					return exists;
				}),
			}))
			.filter((group) => group.files.length > 0);
	}
}
