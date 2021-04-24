import {
    clamp,
    deg,
    fract,
    mix,
    mod,
    rad,
    smoothStep,
    step,
} from "@thi.ng/math";
import type { JSBuiltinsFloat } from "../api";

export const FLOAT: JSBuiltinsFloat<number> = {
    abs: Math.abs,
    acos: Math.acos,
    asin: Math.asin,
    atan: Math.atan,
    atannn: Math.atan2,
    ceil: Math.ceil,
    clamp,
    cos: Math.cos,
    degrees: deg,
    dFdx: () => 0,
    dFdy: () => 0,
    exp: Math.exp,
    exp2: (x) => Math.pow(2, x),
    floor: Math.floor,
    fract,
    fwidth: () => 0,
    inversesqrt: (x) => 1 / Math.sqrt(x),
    log: Math.log,
    log2: Math.log2,
    max: Math.max,
    min: Math.min,
    mix,
    mixn: mix,
    mod,
    modn: mod,
    pow: Math.pow,
    radians: rad,
    sign: Math.sign,
    sin: Math.sin,
    smoothstep: smoothStep,
    sqrt: Math.sqrt,
    step,
    tan: Math.tan,
};
