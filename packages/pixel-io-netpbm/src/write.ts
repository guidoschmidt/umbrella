import type { IntBuffer } from "@thi.ng/pixel";
import { GRAY16 } from "@thi.ng/pixel/format/gray16";

/** @internal */
const __formatComments = (
	comments: string[] = ["generated by @thi.ng/pixel-io-netpbm"]
) => comments.map((x) => `# ${x}`).join("\n");

/** @internal */
const __luminance = (c: number) =>
	(((c >>> 16) & 0xff) * 29 + ((c >>> 8) & 0xff) * 150 + (c & 0xff) * 76) /
	255;

/**
 * Initializes byte array & PBM header for given {@link IntBuffer} and format
 * details.
 *
 * @param magic -
 * @param limits -
 * @param size -
 * @param buf -
 *
 * @internal
 */
const __initHeader = (
	magic: string,
	limits: number,
	size: number,
	buf: IntBuffer,
	comments?: string[]
) => {
	const { width, height } = buf;
	let header = magic + "\n";
	const comm = __formatComments(comments);
	if (comm.length) header += comm + "\n";
	header += `${width} ${height}\n`;
	if (limits > 0) header += limits + "\n";
	const dest = new Uint8Array(size + header.length);
	dest.set([...header].map((x) => x.charCodeAt(0)));
	return { dest, start: header.length, abgr: buf.format.toABGR };
};

/**
 * Converts a {@link IntBuffer} into a 1bit PBM byte array (binary format).
 *
 * @remarks
 * Reference: http://netpbm.sourceforge.net/doc/pbm.html
 *
 * @param buf -
 * @param comments -
 */
export const asPBM = (buf: IntBuffer, comments?: string[]) => {
	const { data, width, height } = buf;
	const { dest, start, abgr } = __initHeader(
		"P4",
		0,
		Math.ceil(width / 8) * height,
		buf,
		comments
	);
	const w1 = width - 1;
	for (let y = 0, i = start, j = 0; y < height; y++) {
		for (let x = 0, b = 0; x <= w1; x++, j++) {
			const xx = ~x & 7;
			if (__luminance(abgr(data[j])) < 128) {
				b |= 1 << xx;
			}
			if (xx === 0 || x === w1) {
				dest[i++] = b;
				b = 0;
			}
		}
	}
	return dest;
};

/**
 * Converts a {@link IntBuffer} into a 8bit grayscale PGM byte array (binary
 * format).
 *
 * @remarks
 * Reference: http://netpbm.sourceforge.net/doc/pgm.html
 *
 * @param buf -
 * @param comments -
 */
export const asPGM = (buf: IntBuffer, comments?: string[]) => {
	const { data, width, height } = buf;
	const { dest, start, abgr } = __initHeader(
		"P5",
		0xff,
		width * height,
		buf,
		comments
	);
	for (let i = start, j = 0; j < data.length; i++, j++) {
		dest[i] = __luminance(abgr(data[j]));
	}
	return dest;
};

/**
 * Converts a {@link IntBuffer} into a 16bit grayscale PGM byte array (binary
 * format).
 *
 * @remarks
 * Reference: http://netpbm.sourceforge.net/doc/pgm.html
 *
 * @param buf -
 * @param comments -
 */
export const asPGM16 = (buf: IntBuffer, comments?: string[]) => {
	if (buf.format !== GRAY16) buf = buf.as(GRAY16);
	const { data, width, height } = buf;
	const { dest, start } = __initHeader(
		"P5",
		0xffff,
		width * height * 2,
		buf,
		comments
	);
	for (let i = start, j = 0; j < data.length; i += 2, j++) {
		dest[i] = data[j] >> 8;
		dest[i + 1] = data[j] & 0xff;
	}
	return dest;
};

/**
 * Converts a {@link IntBuffer} into a 24bit PPM byte array (binary format).
 *
 * @remarks
 * Reference: http://netpbm.sourceforge.net/doc/ppm.html
 *
 * @param buf -
 * @param comments -
 */
export const asPPM = (buf: IntBuffer, comments?: string[]) => {
	const { data, width, height } = buf;
	const { dest, start, abgr } = __initHeader(
		"P6",
		255,
		width * 3 * height,
		buf,
		comments
	);
	for (let i = start, j = 0; j < data.length; i += 3, j++) {
		const col = abgr(data[j]);
		dest[i] = col & 0xff;
		dest[i + 1] = (col >> 8) & 0xff;
		dest[i + 2] = (col >> 16) & 0xff;
	}
	return dest;
};
