import type { ModelClass } from "./typings.ts";

export default class Relationship {
  localTable = "";
  foreignTable = "";
  localKey = "";
  foreignKey = "";
  mode: "one-to-many" | "many-to-many" | "many-to-one" = "one-to-many";

  static hasMany(table: string, foreignKey = "id", localKey = "") {
    const localTable = (this as ModelClass)?.table;
    const relationship = new Relationship();
    relationship.localTable = localTable || "";
    relationship.foreignTable = table;
    relationship.foreignKey = foreignKey;
    relationship.localKey = localKey || `${table}_id`;
    relationship.mode = "one-to-many";
    return relationship;
  }
}
