import type { Maybe } from "@thi.ng/api";
import type { MultiFn2 } from "@thi.ng/defmulti";
import { defmulti } from "@thi.ng/defmulti/defmulti";
import type { IShape } from "@thi.ng/geom-api";
import { Sampler } from "@thi.ng/geom-resample/sampler";
import { cubicSplitAt } from "@thi.ng/geom-splines/cubic-split";
import { quadraticSplitAt } from "@thi.ng/geom-splines/quadratic-split";
import { absDiff } from "@thi.ng/math/abs";
import { PI, TAU } from "@thi.ng/math/api";
import { fit01 } from "@thi.ng/math/fit";
import { set2 } from "@thi.ng/vectors/set";
import { Arc } from "./api/arc.js";
import { Circle } from "./api/circle.js";
import { Cubic } from "./api/cubic.js";
import { Line } from "./api/line.js";
import { Line3 } from "./api/line3.js";
import { Polyline } from "./api/polyline.js";
import { Polyline3 } from "./api/polyline3.js";
import { Quadratic } from "./api/quadratic.js";
import { __copyAttribsRaw } from "./internal/copy.js";
import { __dispatch } from "./internal/dispatch.js";
import { __pointArraysAsShapes } from "./internal/points-as-shape.js";
import { __splitLineAt } from "./internal/split.js";
import { Quadratic3 } from "./api/quadratic3.js";
import { Cubic3 } from "./api/cubic3.js";

/**
 * Function overrides for {@link splitAt}.
 */
export type SplitAtFn = {
	(shape: Arc, t: number): [Arc, Arc];
	(shape: Circle, t: number): [Arc, Arc];
	(shape: Cubic, t: number): [Cubic, Cubic];
	(shape: Line, t: number): [Line, Line];
	(shape: Polyline, t: number): [Polyline, Polyline];
	(shape: Quadratic, t: number): [Quadratic, Quadratic];
} & MultiFn2<IShape, number, Maybe<IShape[]>>;

/**
 * Splits given shape in 2 parts at normalized parametric position `t`.
 *
 * @remarks
 * Currently only implemented for:
 *
 * - {@link Arc}
 * - {@link Circle}
 * - {@link Cubic}
 * - {@link Cubic3}
 * - {@link Line}
 * - {@link Line3}
 * - {@link Polyline}
 * - {@link Polyline3}
 * - {@link Quadratic}
 * - {@link Quadratic3}
 *
 * @param shape
 * @param t
 */
export const splitAt = <SplitAtFn>defmulti<any, number, Maybe<IShape[]>>(
	__dispatch,
	{},
	{
		arc: ({ pos, r, start, end, axis, cw, attribs }: Arc, t: number) => {
			const theta = fit01(t, start, end);
			return [
				new Arc(
					set2([], pos),
					set2([], r),
					axis,
					start,
					theta,
					absDiff(start, theta) >= PI,
					cw,
					__copyAttribsRaw(attribs)
				),
				new Arc(
					set2([], pos),
					set2([], r),
					axis,
					theta,
					end,
					absDiff(theta, end) >= PI,
					cw,
					__copyAttribsRaw(attribs)
				),
			];
		},

		circle: ({ pos, r, attribs }: Circle, t) => {
			const theta = t * TAU;
			return [
				new Arc(
					set2([], pos),
					[r, r],
					0,
					0,
					theta,
					t >= 0.5,
					true,
					__copyAttribsRaw(attribs)
				),
				new Arc(
					set2([], pos),
					[r, r],
					0,
					theta,
					TAU,
					t < 0.5,
					true,
					__copyAttribsRaw(attribs)
				),
			];
		},

		cubic: ({ attribs, points }: Cubic, t: number) =>
			__pointArraysAsShapes(
				Cubic,
				cubicSplitAt(points[0], points[1], points[2], points[3], t),
				attribs,
				false
			),

		cubic3: ({ attribs, points }: Cubic3, t: number) =>
			__pointArraysAsShapes(
				Cubic3,
				cubicSplitAt(points[0], points[1], points[2], points[3], t),
				attribs,
				false
			),

		line: ({ attribs, points }: Line, t) =>
			__splitLineAt(Line, points, t, attribs),

		line3: ({ attribs, points }: Line, t) =>
			__splitLineAt(Line3, points, t, attribs),

		polyline: ({ attribs, points }: Polyline, t) =>
			__pointArraysAsShapes(
				Polyline,
				new Sampler(points).splitAt(t),
				attribs
			),

		polyline3: ({ attribs, points }: Polyline, t) =>
			__pointArraysAsShapes(
				Polyline3,
				new Sampler(points).splitAt(t),
				attribs
			),

		quadratic: ({ attribs, points }: Quadratic, t: number) =>
			__pointArraysAsShapes(
				Quadratic,
				quadraticSplitAt(points[0], points[1], points[2], t),
				attribs,
				false
			),

		quadratic3: ({ attribs, points }: Quadratic, t: number) =>
			__pointArraysAsShapes(
				Quadratic3,
				quadraticSplitAt(points[0], points[1], points[2], t),
				attribs,
				false
			),
	}
);
