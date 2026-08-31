import "server-only";

import { z } from "zod";
import type { JsonFileStore } from "@/lib/server/json-file-store";

export interface ValidatedMutation<T, R> {
  data: T;
  result: R;
}

export interface ValidatedStore<T> {
  read(): Promise<T>;
  mutate<R>(
    mutator: (
      data: T,
    ) => ValidatedMutation<T, R> | Promise<ValidatedMutation<T, R>>,
  ): Promise<R>;
}

/** Adds runtime validation and typed transactions to an untyped JSON store. */
export function createValidatedStore<T>(
  jsonStore: JsonFileStore,
  schema: z.ZodType<T>,
  documentName = "Stored document",
): ValidatedStore<T> {
  async function read(): Promise<T> {
    return parse(await jsonStore.read());
  }

  async function mutate<R>(
    mutator: (
      data: T,
    ) => ValidatedMutation<T, R> | Promise<ValidatedMutation<T, R>>,
  ): Promise<R> {
    return jsonStore.mutate(async (rawData) => {
      const currentData = parse(rawData);
      const mutation = await mutator(currentData);

      return {
        data:
          mutation.data === currentData
            ? rawData
            : parse(mutation.data),
        result: mutation.result,
      };
    });
  }

  function parse(value: unknown): T {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new Error(`${documentName} is corrupt: ${result.error.message}`);
    }
    return result.data;
  }

  return { read, mutate };
}
