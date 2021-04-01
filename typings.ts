import Relationship from "./Relationship.ts";

export type ModelClass = {
  table?: string;
  getTable?: () => string;
  relationships?: Record<string, Relationship>;
};
