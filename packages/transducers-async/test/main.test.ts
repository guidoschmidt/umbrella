import { delayed } from "@thi.ng/compose";
import { expect, test } from "bun:test";
import {
	comp,
	filter,
	iterator,
	map,
	mapcat,
	multiplex,
	multiplexObj,
	partition,
	push,
	repeatedly,
	run,
	step,
	take,
	throttle,
	transduce,
} from "../src/index.js";

test("comp", async (done) => {
	expect(
		await transduce(
			comp(
				filter(async (x) => !!(x & 1)),
				map(async (x) => x * 10),
				partition(2, true)
			),
			push<number[]>(),
			repeatedly((i) => i, 10)
		)
	).toEqual([[10, 30], [50, 70], [90]]);
	done();
});

test("filter", async (done) => {
	expect(
		await transduce(
			filter(async (x) => !!(x & 1)),
			push<number>(),
			[1, 2, 3]
		)
	).toEqual([1, 3]);
	done();
});

test("iterator", async (done) => {
	expect(
		await push(
			iterator(
				comp(
					partition(2, true),
					map<number[], number[]>((x) => x.map((y) => y * 10))
				),
				repeatedly((i) => i + 1, 3, 10)
			)
		)
	).toEqual([[10, 20], [30]]);
	done();
});

test("map", async (done) => {
	expect(
		await transduce(
			map(async (x) => x * 10),
			push<number>(),
			[1, 2, 3]
		)
	).toEqual([10, 20, 30]);
	done();
});

test("mapcat", async (done) => {
	expect(
		await transduce(
			mapcat(async (x) => [x, x * 10]),
			push<number>(),
			[1, 2, 3]
		)
	).toEqual([1, 10, 2, 20, 3, 30]);
	done();
});

test("multiplex", async (done) => {
	expect(
		await transduce(
			multiplex(
				map(async (x) => [x, x * 10]),
				partition(2, 1),
				map(async (x) => `x=${x}`)
			),
			push(),
			[1, 2, 3]
		)
	).toEqual([
		[[1, 10], undefined, "x=1"],
		[[2, 20], [1, 2], "x=2"],
		[[3, 30], [2, 3], "x=3"],
	]);
	done();
});

test("multiplexObj", async (done) => {
	expect(
		await transduce(
			multiplexObj({
				a: map(async (x) => [x, x * 10]),
				b: partition(2, 1),
				c: map(async (x) => `x=${x}`),
			}),
			push(),
			[1, 2, 3]
		)
	).toEqual([
		{ a: [1, 10], b: undefined, c: "x=1" },
		{ a: [2, 20], b: [1, 2], c: "x=2" },
		{ a: [3, 30], b: [2, 3], c: "x=3" },
	]);
	done();
});

test("partition", async (done) => {
	expect(
		await transduce(partition(2, 1), push<number[]>(), [1, 2, 3])
	).toEqual([
		[1, 2],
		[2, 3],
	]);
	expect(await transduce(partition(2), push<number[]>(), [1, 2, 3])).toEqual([
		[1, 2],
	]);
	expect(
		await transduce(partition(2, true), push<number[]>(), [1, 2, 3])
	).toEqual([[1, 2], [3]]);
	done();
});

test("repeatedly", async (done) => {
	expect(await push(repeatedly(async (i) => i * 10, 3, 10))).toEqual([
		0, 10, 20,
	]);
	done();
});

test("run", async (done) => {
	const res: any[] = [];
	await run(
		map(async (x) => delayed(x * 10, 10)),
		async (x) => res.push(x),
		[1, 2, 3]
	);
	expect(res).toEqual([10, 20, 30]);
	done();
});

test("step", async (done) => {
	expect(await step(mapcat(async (x) => [x, x]))(1)).toEqual([1, 1]);
	expect(await step(mapcat(async (x) => [x]))(1)).toEqual(1);
	expect(
		await step(
			mapcat(async (x) => [x]),
			false
		)(1)
	).toEqual([1]);
	done();
});

test("take", async (done) => {
	expect(
		await transduce(
			take(3),
			push(),
			repeatedly(async (i) => i * 10)
		)
	).toEqual([0, 10, 20]);
	done();
});

test("throttle", async (done) => {
	expect(
		await transduce(
			throttle(() => {
				let last = -1;
				return async (x) => {
					let res = x !== last;
					last = x;
					return res;
				};
			}),
			push<number>(),
			[1, 1, 2, 3, 3, 2, 2, 1]
		)
	).toEqual([1, 2, 3, 2, 1]);
	done();
});
