# simple-orm

A simple ORM for building queries in Node.js. This ORM is largely built around the [Eloquent ORM](https://laravel.com/docs/8.x/eloquent) used by Laravel. **Note: this library currently only outputs SQL to be executed by MySQL client**.

## Warning

Please don't use this in production. This project isn't indended to be maintained, doesn't yet sanitise inputs/prepare statements. Please consider using one of these:

- [Knex](https://github.com/knex/knex)
- [TypeORM](https://typeorm.io/)
- [Sequelize](https://sequelize.org/)

## Usage

```ts
import { Model } from "@jamsch/simple-orm";

class ForumPost extends Model {}

class UserProduct extends Model {}

class User extends Model {
  static table = "users"; // Default: snake_case class name + "s" (e.g. "ForumPost" => "forum_posts")
  static relationships = {
    forumPosts: User.hasMany("forum_posts"), // or ForumPost.getTable()
    products: User.hasManyThrough("user_products"),
  };
}
```

```ts
// Find all users that have created a forum post since 2021-01-01
const query = User.select("id", "name").whereHas("forumPosts", (q) => {
  q.where("created_at", ">", "2021-01-01");
});
console.log(query.toString());
// SELECT id, name FROM users WHERE EXISTS (SELECT forum_posts.* FROM users JOIN `forum_posts` ON `users`.`forum_posts_id` = `forum_posts`.`id` WHERE `created_at` > `2021-01-01`)
```

```ts
// Find "james smith" or "jack"
// If the user's an admin, only find inactive accounts
const isAdmin = true;

const query = User.select("id", "first_name", "last_name")
  .where((q) => {
    q.where({
      first_name: "james",
      last_name: "smith",
    }).orWhere("first_name", "jack");
  })
  .when(isAdmin, (q) => {
    // If "isAdmin" is true, make sure we find only inactive users
    q.select("is_inactive").where("is_inactive", 1);
  })
  .limit(100);

console.log(query.toString());
// SELECT `id`, `first_name`, `last_name`, `is_inactive` FROM users WHERE (`first_name` = `james` AND `last_name` = `smith` OR `first_name` = `jack`) AND (`is_inactive` = 1) LIMIT 100
```

```ts
// Create a user
const query = User.create({
  first_name: "james",
  last_name: "smith",
  username: "jamessmith",
});

console.log(query.toString());
// INSERT INTO users (`first_name`, `last_name`, `username`) VALUES (`james`, `smith`, `jamessmith`)
```

## API

### Model

```ts
/** Creates a query builder INSERT statement. Doesn't execute any SQL */
static create(values: Record<string, string|number>): QueryBuilder;

/** Select query */
static select(...columns: string[]): QueryBuilder;

/** Define a one-to-many relationship */
static hasMany(table: string, foreignKey = "id", localKey = ""): Relationship;

/** Define a has-many-through relationship */
static hasManyThrough(relatedTable: string, throughTable: string, firstKey?: string, secondKey?: string, localKey?: string): Relationship;
```

### QueryBuilder

```ts
/** Creates a query builder INSERT statement. Doesn't execute any SQL */
static create(values: Record<string, string|number>): QueryBuilder;

/** Select query */
static select(...columns: string[]): QueryBuilder;
/** Adds additional columns */
select(...columns: string[]): QueryBuilder;

/** Alternative to if/else for cleaner query building */
when(condition: boolean, callback: (builder: QueryBuilder) => void): QueryBuilder;

where(callback: (builder: QueryBuilder) => void): QueryBuilder;
where(values: Record<string, string|number>): QueryBuilder;
where(column: string, value: string|number): QueryBuilder;
where(column: string, operator: string, value: string|number): QueryBuilder;

orWhere(callback: (builder: QueryBuilder) => void): QueryBuilder;
orWhere(values: Record<string, string|number>): QueryBuilder;
orWhere(column: string, value: string|number): QueryBuilder;
orWhere(column: string, operator: string, value: string|number): QueryBuilder;

whereHas(relationshipName: string, callback: (builder: QueryBuilder) => void): QueryBuilder
orWhereHas(relationshipName: string, callback: (builder: QueryBuilder) => void): QueryBuilder

whereIn(column: string; value: number[] | string[]): QueryBuilder;
orWhereIn(column: string; value: number[] | string[]): QueryBuilder;

orderBy({ column: string; direction: "asc" | "desc" }): QueryBuilder;
orderBy(column: string, direction: "asc" | "desc" = "asc"): QueryBuilder;

limit(n: number): QueryBuilder;
limit(from: number, to: number): QueryBuilder;

/** Generates the query SQL */
toString(): string;
```
