import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { PluginConfig } from "streamdown";

/** Shared Streamdown plugin set. Requires a single shiki version (see root overrides). */
export const streamdownPlugins: PluginConfig = { cjk, code, math, mermaid };
