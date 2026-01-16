/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as examParticipations from "../examParticipations.js";
import type * as exams from "../exams.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as payments from "../payments.js";
import type * as questions from "../questions.js";
import type * as stripe from "../stripe.js";
import type * as training from "../training.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  examParticipations: typeof examParticipations;
  exams: typeof exams;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  payments: typeof payments;
  questions: typeof questions;
  stripe: typeof stripe;
  training: typeof training;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
