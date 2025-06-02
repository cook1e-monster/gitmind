import { runGitMind } from "../../core/gitmind";

(async () => {
	try {
		await runGitMind();
	} catch (err) {
		console.error("❌ Error fatal:", err);
	}
})();
