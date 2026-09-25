/**
 * Server-only access to the CV data in `sample_data/`.
 *
 * `toSharedCv` is the single place that decides which CV fields may leave the
 * system: contact details (email, phone, profiles) and conversion notes
 * (`meta`, `x-note`) are left out.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "sample_data");

export interface IndexVersion {
	file: string;
	variant: string;
	cvYear?: string;
}

export interface IndexPerson {
	personId: string;
	name: string;
	primary: string;
	versions: Array<IndexVersion>;
}

// CV files follow sample_data/schema/cv.schema.json; only the fields used here are typed.
type Entry = Record<string, unknown>;
export interface Cv {
	basics: Entry & { label?: string };
	work?: Array<Entry>;
	projects?: Array<Entry>;
	meta?: Entry;
	[key: string]: unknown;
}

async function readJson<T>(relativePath: string): Promise<T> {
	return JSON.parse(await readFile(path.join(DATA_DIR, relativePath), "utf8"));
}

export async function readPeople(): Promise<Array<IndexPerson>> {
	return (await readJson<{ people: Array<IndexPerson> }>("index.json")).people;
}

/**
 * Reads one CV version. Only files listed in `index.json` can be read, which
 * also keeps the path inside `sample_data/cvs`. Returns null for any other name.
 */
export async function readCv(
	file: string,
	people?: Array<IndexPerson>,
): Promise<Cv | null> {
	const listed = (people ?? (await readPeople())).some((p) =>
		p.versions.some((v) => v.file === file),
	);
	return listed ? readJson<Cv>(path.join("cvs", file)) : null;
}

function withoutNote({ "x-note": _note, ...entry }: Entry): Entry {
	return entry;
}

/** The CV as it may be shared outside the system. */
export function toSharedCv(cv: Cv) {
	const { email: _e, phone: _p, profiles: _pr, ...basics } = cv.basics;
	const { $schema: _s, meta, work, projects, ...rest } = cv;
	return {
		...rest,
		basics,
		work: work?.map(withoutNote),
		projects: projects?.map(withoutNote),
		meta: meta && { variant: meta.variant, cvYear: meta["x-cvYear"] },
	};
}
