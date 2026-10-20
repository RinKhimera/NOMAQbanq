// Vitest 5 ne lit plus le `jest.Matchers` global qu'augmentent les types de
// jest-dom : sans ce pont, chaque `toBeInTheDocument()` est une erreur TS2339.
// Les matchers restent enregistrés à l'exécution par `vitest.setup.ts`.
// Supprimer ce fichier quand jest-dom publiera le support de Vitest 5 :
// https://github.com/testing-library/jest-dom/issues/738
// Ne pas augmenter `AsymmetricMatchersContaining` : conflit TS2320.
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers"

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<R, T> extends TestingLibraryMatchers<unknown, R> {}
}
