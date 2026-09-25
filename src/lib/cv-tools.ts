/**
 * Server-side tools that let the chatbot search and read CVs.
 *
 * Their results are sent to the Claude API, so they only return CVs through
 * `toSharedCv`, which leaves out contact details and conversion notes.
 */
import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

import { type Cv, readCv, readPeople, toSharedCv } from "#/lib/cv-data";

export const searchPeopleToolDef = toolDefinition({
	name: "searchPeople",
	description:
		"Search Kipinä people by skill, technology, role, industry or past client. Every term must match somewhere in the person's CV. Returns each matching person with their CV versions. Pass an empty query to list everyone.",
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				'Space-separated search terms, e.g. "react aws" or "product owner insurance"',
			),
	}),
});

export const searchPeople = searchPeopleToolDef.server(async ({ query }) => {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	const people = await readPeople();
	const results = await Promise.all(
		people.map(async (person) => {
			const cvs = (await Promise.all(
				person.versions.map((v) => readCv(v.file, people)),
			)) as Array<Cv>;
			// Search everything the model may see, so a match here is a match in getCv.
			const text = cvs
				.map((cv) => JSON.stringify(toSharedCv(cv)))
				.join(" ")
				.toLowerCase();
			if (!terms.every((term) => text.includes(term))) return null;
			const primary =
				cvs[person.versions.findIndex((v) => v.file === person.primary)];
			return {
				personId: person.personId,
				name: person.name,
				label: primary?.basics.label,
				primary: person.primary,
				versions: person.versions.map(({ file, variant, cvYear }) => ({
					file,
					variant,
					cvYear,
				})),
			};
		}),
	);
	return results.filter((r) => r !== null);
});

export const getCvToolDef = toolDefinition({
	name: "getCv",
	description:
		"Read one CV version in full: summary, strengths, key roles and skills, skill years, projects, certificates and testimonials. Contact details are not included. Use a file name returned by searchPeople.",
	inputSchema: z.object({
		file: z.string().describe('CV version file name, e.g. "p10-v3.json"'),
	}),
});

export const getCv = getCvToolDef.server(async ({ file }) => {
	const cv = await readCv(file);
	return cv ? toSharedCv(cv) : { error: `No CV version named ${file}` };
});
