import { randomUUID } from "node:crypto"

/** Application-generated primary key (UUID v4). Used as the `text` PK on every table. */
export const createId = (): string => randomUUID()
