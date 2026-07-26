import * as astro from "./hosts/astro.js";
import * as next from "./hosts/next.js";
import * as nuxt from "./hosts/nuxt.js";
import { hosts as spaHosts } from "./hosts/spa.js";
import * as sveltekit from "./hosts/sveltekit.js";

// Each host owns the shape of its own project, because a Next app and a Nuxt
// app should look like what their communities expect, not like each other.
// What they share (the adapter, the gate, the schema) lives in shared.js.
//
// The last three are client only: no server, so no database credentials and
// no gate. They either talk to an API you already run or keep the database in
// the browser.
export const HOSTS = [next, nuxt, sveltekit, astro, ...spaHosts];

const byValue = new Map(HOSTS.map((host) => [host.meta.value, host]));

export const isClientOnly = (value) =>
  byValue.get(value)?.meta.clientOnly === true;

export function buildFiles(answers) {
  const host = byValue.get(answers.host);
  if (!host) throw new Error(`Unknown host: ${answers.host}`);
  return host.files(answers);
}
