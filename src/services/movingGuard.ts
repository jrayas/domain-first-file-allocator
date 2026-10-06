/**
 * Records the paths the plugin is itself moving, so that the vault `rename`
 * handler can ignore the events those moves cause.
 */
export class MovingGuard {
	private readonly paths = new Map<string, number>();

	has(path: string): boolean {
		return (this.paths.get(path) ?? 0) > 0;
	}

	async run<T>(paths: readonly string[], task: () => Promise<T>): Promise<T> {
		for (const path of paths) {
			this.paths.set(path, (this.paths.get(path) ?? 0) + 1);
		}
		try {
			return await task();
		} finally {
			for (const path of paths) {
				const remaining = (this.paths.get(path) ?? 1) - 1;
				if (remaining <= 0) {
					this.paths.delete(path);
				} else {
					this.paths.set(path, remaining);
				}
			}
		}
	}
}
