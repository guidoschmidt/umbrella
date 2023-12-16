// thing:no-export
import type { IObjectOf } from "@thi.ng/api";
import type { Command } from "@thi.ng/args";
import { peek } from "@thi.ng/arrays";
import { delayed } from "@thi.ng/compose";
import { assert, illegalArgs, illegalState } from "@thi.ng/errors";
import { readJSON, readText } from "@thi.ng/file-io";
import {
	COMPACT,
	PRETTY,
	at_media,
	css,
	type Format,
} from "@thi.ng/hiccup-css";
import { type ILogger } from "@thi.ng/logger";
import { Stream, reactive, sync } from "@thi.ng/rstream";
import { Z3, split } from "@thi.ng/strings";
import { assocObj, map } from "@thi.ng/transducers";
import { watch } from "fs";
import { resolve } from "path";
import {
	ARG_INCLUDE,
	ARG_NO_HEADER,
	ARG_PRETTY,
	ARG_SPECS,
	ARG_WATCH,
	type AppCtx,
	type CommonOpts,
	type CompiledSpecs,
} from "./api.js";
import { generateHeader, maybeWriteText } from "./utils.js";

type State = "sel" | "class" | "nest";

interface ConvertOpts extends CommonOpts {
	specs: string;
	include?: string[];
	pretty: boolean;
	noHeader: boolean;
	watch: boolean;
}

interface Scope {
	state: State;
	sel: string[];
	path: string;
	parent?: Scope;
}

interface ProcessCtx {
	root: Scope;
	curr: Scope;
	scopes: Scope[];
}

interface ProcessOpts {
	logger: ILogger;
	format: Format;
	specs: CompiledSpecs;
	plainRules: IObjectOf<Set<string>>;
	mediaQueryIDs: Set<string>;
	mediaQueryRules: IObjectOf<IObjectOf<Set<string>>>;
}

export const CONVERT: Command<ConvertOpts, CommonOpts, AppCtx<ConvertOpts>> = {
	desc: "Convert & bundle meta declarations to CSS",
	opts: {
		...ARG_SPECS,
		...ARG_INCLUDE,
		...ARG_PRETTY,
		...ARG_NO_HEADER,
		...ARG_WATCH,
	},
	fn: async (ctx) => {
		const specs = readJSON<CompiledSpecs>(
			resolve(ctx.opts.specs),
			ctx.logger
		);
		if (ctx.opts.watch) {
			await watchInputs(ctx, specs);
		} else {
			processInputs(
				ctx,
				specs,
				ctx.inputs.map((file) => readText(resolve(file), ctx.logger))
			);
		}
	},
};

const watchInputs = async (ctx: AppCtx<ConvertOpts>, specs: CompiledSpecs) => {
	let active = true;
	const close = () => {
		ctx.logger.info("closing watchers...");
		inputs.forEach((i) => i.watcher.close());
		active = false;
	};
	const inputs = ctx.inputs.map((file, i) => {
		file = resolve(file);
		const input = reactive(readText(file, ctx.logger), {
			id: `in${Z3(i)}`,
		});
		return {
			input,
			watcher: watch(file, {}, (event) => {
				if (event === "change") {
					try {
						input.next(readText(file, ctx.logger));
					} catch (e) {
						ctx.logger.warn((<Error>e).message);
						close();
					}
				} else {
					ctx.logger.warn(`input removed:`, file);
					close();
				}
			}),
		};
	});
	sync({
		src: assocObj<Stream<string>>(
			map(
				({ input }) => <[string, Stream<string>]>[input.id, input],
				inputs
			)
		),
	}).subscribe({
		next(ins) {
			try {
				processInputs(
					ctx,
					specs,
					// process in deterministic order (same as given in CLI)
					Object.keys(ins)
						.sort()
						.map((k) => ins[k])
				);
			} catch (e) {
				ctx.logger.warn((<Error>e).message);
			}
		},
	});
	// close watchers when ctrl-c is pressed
	process.on("SIGINT", close);
	while (active) {
		await delayed(null, 250);
	}
};

const processInputs = (
	{ logger, opts: { include, noHeader, out, pretty } }: AppCtx<ConvertOpts>,
	specs: CompiledSpecs,
	inputs: string[]
) => {
	const procOpts: ProcessOpts = {
		logger,
		specs,
		format: pretty ? PRETTY : COMPACT,
		mediaQueryIDs: new Set(Object.keys(specs.media)),
		mediaQueryRules: {},
		plainRules: {},
	};
	const bundle: string[] = include
		? include.map((x) => readText(resolve(x), logger).trim())
		: [];
	if (!noHeader) bundle.push(generateHeader(specs));
	inputs.forEach((input) => processSpec(input, procOpts));
	processPlainRules(bundle, procOpts);
	processMediaQueries(bundle, procOpts);
	maybeWriteText(out, bundle, logger);
};

const processMediaQueries = (
	result: string[],
	{ logger, specs, format, mediaQueryRules }: ProcessOpts
) => {
	for (let queryID in mediaQueryRules) {
		const rules = buildDecls(mediaQueryRules[queryID], specs);
		logger.debug("mediaquery rules", queryID, rules);
		result.push(
			css(at_media(mergeMediaQueries(specs.media, queryID), rules), {
				format,
			})
		);
	}
};

const processPlainRules = (
	result: string[],
	{ logger, specs, format, plainRules }: ProcessOpts
) => {
	const rules = buildDecls(plainRules, specs);
	logger.debug("plain rules", rules);
	result.push(css(rules, { format }));
};

const processSpec = (
	src: string,
	{ specs, mediaQueryIDs, mediaQueryRules, plainRules }: ProcessOpts
) => {
	const root = defScope();
	const initial = defScope(root);
	const ctx: ProcessCtx = {
		root,
		curr: initial,
		scopes: [initial],
	};

	// process line by line, skip comment lines
	for (let line of split(src)) {
		if (!line || /^\s*\/\//.test(line)) continue;
		for (let token of split(line, /\s+/g)) {
			if (!token) continue;
			let $scope = ctx.curr;
			switch ($scope.state) {
				case "sel":
				case "nest":
					if (token === "{") {
						if ($scope.state === "sel") {
							$scope.sel = $scope.sel.map((x) =>
								x.replace(",", "")
							);
							$scope.path = buildScopePath(ctx.scopes);
						}
						$scope.state = "class";
					} else if (token === "}") {
						endScope(ctx);
					} else {
						const last = peek($scope.sel);
						if (!last || last.endsWith(",")) {
							$scope.sel.push(token);
						} else {
							$scope.sel[$scope.sel.length - 1] += " " + token;
						}
					}
					break;
				case "class":
					if (token === "{") {
						$scope.state = "nest";
						ctx.scopes.push((ctx.curr = defScope($scope)));
					} else if (token === "}") {
						endScope(ctx);
					} else {
						let { token: id, query } = parseMediaQueryToken(
							token,
							mediaQueryIDs
						);
						if (!specs.defs[id])
							illegalArgs(`unknown rule ID: ${id}`);
						if (query) {
							if (!mediaQueryRules[query])
								mediaQueryRules[query] = {};
							(
								mediaQueryRules[query][$scope.path] ||
								(mediaQueryRules[query][$scope.path] =
									new Set())
							).add(id);
						} else {
							(
								plainRules[$scope.path] ||
								(plainRules[$scope.path] = new Set())
							).add(id);
						}
					}
					break;
				default:
					illegalState($scope.state);
			}
		}
	}
};

const QUERY_SEP = ":";
const PATH_SEP = "///";

const defScope = (parent?: Scope): Scope => ({
	state: "sel",
	sel: parent ? [] : ["<root>"],
	path: "",
	parent,
});

const endScope = (ctx: ProcessCtx) => {
	const isEmpty = !ctx.curr.sel.length;
	assert(!!ctx.curr.parent, "stack underflow");
	ctx.scopes.pop();
	if (ctx.scopes.length > 0) {
		ctx.curr = peek(ctx.scopes);
		if (!isEmpty && ctx.curr.state === "nest") {
			ctx.scopes.push((ctx.curr = defScope(ctx.curr)));
		}
	} else {
		ctx.scopes.push((ctx.curr = defScope(ctx.root)));
	}
};

const buildScopePath = (scopes: Scope[]) =>
	scopes.map((x) => x.sel.join(",")).join(PATH_SEP);

const buildDecls = (rules: IObjectOf<Set<string>>, specs: CompiledSpecs) =>
	Object.entries(rules).map(([path, ids]) =>
		buildDeclsForPath(path, ids, specs)
	);

const buildDeclsForPath = (
	selectorPath: string,
	ids: Iterable<string>,
	specs: CompiledSpecs
) => {
	const root: any[] = [];
	let parent = root;
	const parts = selectorPath.split(PATH_SEP);
	for (let i = 0; i < parts.length; i++) {
		const curr = parts[i].split(",");
		if (i == parts.length - 1) {
			curr.push(Object.assign({}, ...map((x) => specs.defs[x], ids)));
		}
		parent.push(curr);
		parent = curr;
	}
	return root[0];
};

const parseMediaQueryToken = (token: string, mediaQueries: Set<string>) => {
	if (/^::?/.test(token)) return { token };
	const idx = token.lastIndexOf(QUERY_SEP);
	if (idx < 0) return { token };
	const query = token.substring(0, idx);
	const parts = query.split(QUERY_SEP);
	if (!parts.every((x) => mediaQueries.has(x)))
		illegalArgs(`invalid media query in token: ${token}`);
	return { token: token.substring(idx + 1), query };
};

/**
 * Takes an object of media query definitions and a query ID (possibly composed
 * of multiple media query IDs, separated by `:`). Splits the query ID into
 * components, looks up definition for each sub-query ID and returns merged
 * media query definition.
 *
 * @remarks
 * See
 * [`at_media()`](https://docs.thi.ng/umbrella/hiccup-css/functions/at_media.html)
 * for details
 *
 * @param mediaQueryDefs
 * @param query
 * @returns
 */
const mergeMediaQueries = (mediaQueryDefs: IObjectOf<any>, query: string) =>
	query
		.split(QUERY_SEP)
		.reduce((acc, id) => Object.assign(acc, mediaQueryDefs[id]), <any>{});
