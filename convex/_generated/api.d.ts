/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as crons from "../crons.js";
import type * as examParticipations from "../examParticipations.js";
import type * as examPause from "../examPause.js";
import type * as examStats from "../examStats.js";
import type * as exams from "../exams.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_batchFetch from "../lib/batchFetch.js";
import type * as lib_bunny from "../lib/bunny.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_examStats from "../lib/examStats.js";
import type * as lib_stripe from "../lib/stripe.js";
import type * as marketing from "../marketing.js";
import type * as migrations_backfillExplanations from "../migrations/backfillExplanations.js";
import type * as migrations_backfillHasImagesComputed from "../migrations/backfillHasImagesComputed.js";
import type * as migrations_cleanupOldFieldsFromQuestions from "../migrations/cleanupOldFieldsFromQuestions.js";
import type * as migrations_runner from "../migrations/runner.js";
import type * as migrations_verifyExplanations from "../migrations/verifyExplanations.js";
import type * as payments from "../payments.js";
import type * as questions from "../questions.js";
import type * as rateLimit from "../rateLimit.js";
import type * as stripe from "../stripe.js";
import type * as testing from "../testing.js";
import type * as training from "../training.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  crons: typeof crons;
  examParticipations: typeof examParticipations;
  examPause: typeof examPause;
  examStats: typeof examStats;
  exams: typeof exams;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/batchFetch": typeof lib_batchFetch;
  "lib/bunny": typeof lib_bunny;
  "lib/errors": typeof lib_errors;
  "lib/examStats": typeof lib_examStats;
  "lib/stripe": typeof lib_stripe;
  marketing: typeof marketing;
  "migrations/backfillExplanations": typeof migrations_backfillExplanations;
  "migrations/backfillHasImagesComputed": typeof migrations_backfillHasImagesComputed;
  "migrations/cleanupOldFieldsFromQuestions": typeof migrations_cleanupOldFieldsFromQuestions;
  "migrations/runner": typeof migrations_runner;
  "migrations/verifyExplanations": typeof migrations_verifyExplanations;
  payments: typeof payments;
  questions: typeof questions;
  rateLimit: typeof rateLimit;
  stripe: typeof stripe;
  testing: typeof testing;
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
