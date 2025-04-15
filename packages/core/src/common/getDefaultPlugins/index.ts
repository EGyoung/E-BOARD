import { DrawPlugin } from "../../plugins";
import { CorePlugins } from "../../types";
const DEFAULT_PLUGINS = {
  [CorePlugins.DRAW]: DrawPlugin
} as const;
export const getDefaultPlugins = () => {
  return DEFAULT_PLUGINS;
};
