import Relationship from "./Relationship.ts";
import QueryBuilder from "./QueryBuilder.ts";

export default class Model {
  static getTable() {
    const localTable = (this as { table?: string })?.table;

    if (localTable) {
      return localTable;
    }

    let name = this.name
      .replace(/([A-Z])/g, "_$1")
      .slice(1)
      .toLowerCase();

    if (!name.endsWith("s")) {
      name += "s";
    }
    return name;
  }

  static hasMany = Relationship.hasMany;
  static select = QueryBuilder.select;
  static create = QueryBuilder.create;
}
