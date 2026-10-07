import { describe, expect, it } from "vitest";
import type { UndoAction } from "../src/types";

import { UndoStack } from "../src/core/undoStack";

function action(label: string, entries = 1): UndoAction {
	return {
		label,
		caveats: [],
		entries: Array.from({ length: entries }, (_, i) => ({
			oldPath: `a${i}.md`,
			newPath: `b${i}.md`,
			propertyName: "domain",
			oldValue: undefined,
			newValue: "X",
		})),
	};
}

describe("UndoStack", () => {
	it("keeps only the latest action at depth 1", () => {
		const stack = new UndoStack(() => 1);
		stack.record(action("one"));
		stack.record(action("two"));
		expect(stack.size).toBe(1);
		expect(stack.take()?.label).toBe("two");
		expect(stack.take()).toBeNull();
	});
	it("keeps several actions at a greater depth, newest first out", () => {
		const stack = new UndoStack(() => 5);
		for (const label of ["a", "b", "c"]) {
			stack.record(action(label));
		}
		expect(stack.size).toBe(3);
		expect([stack.take()?.label, stack.take()?.label, stack.take()?.label]).toEqual(["c", "b", "a"]);
	});
	it("drops the oldest when the depth is exceeded", () => {
		const stack = new UndoStack(() => 2);
		for (const label of ["a", "b", "c"]) {
			stack.record(action(label));
		}
		expect([stack.take()?.label, stack.take()?.label, stack.take()]).toEqual(["c", "b", null]);
	});
	it("trims to a depth that was lowered afterwards", () => {
		let depth = 10;
		const stack = new UndoStack(() => depth);
		for (const label of ["a", "b", "c"]) {
			stack.record(action(label));
		}
		depth = 1;
		expect(stack.size).toBe(1);
		expect(stack.peek()?.label).toBe("c");
	});
	it("ignores an action that changed nothing, and keeps a registry-only action", () => {
		const stack = new UndoStack(() => 5);
		stack.record(action("real"));
		stack.record(action("empty", 0));
		expect(stack.peek()?.label).toBe("real");
		stack.record({ label: "registry", caveats: [], entries: [], registryRename: { from: "A", to: "B" } });
		expect(stack.peek()?.label).toBe("registry");
	});
	it("peek does not remove", () => {
		const stack = new UndoStack(() => 1);
		stack.record(action("a"));
		stack.peek();
		expect(stack.size).toBe(1);
	});
	it("treats a depth below 1 as 1", () => {
		const stack = new UndoStack(() => 0);
		stack.record(action("a"));
		expect(stack.size).toBe(1);
	});
});
