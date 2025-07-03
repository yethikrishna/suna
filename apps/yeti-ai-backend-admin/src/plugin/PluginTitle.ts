import { Plugin as TPlugin } from "../api/plugin/Plugin";

export const PLUGIN_TITLE_FIELD = "name";

export const PluginTitle = (record: TPlugin): string => {
  return record.name?.toString() || String(record.id);
};
