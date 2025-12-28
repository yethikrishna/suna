import { Plugin as TPlugin } from "../api/plugin/Plugin";

export const PLUGIN_TITLE_FIELD = "id";

export const PluginTitle = (record: TPlugin): string => {
  return record.id?.toString() || String(record.id);
};
