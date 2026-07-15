import { createServerFn } from "@tanstack/react-start";
import type {
  CreateUserAccessInput,
  CreateUserAccessResult,
} from "@/lib/create-user-access.server";

export type { CreateUserAccessInput, CreateUserAccessResult };

export const createUserAccessFn = createServerFn({ method: "POST" })
  .validator((data: CreateUserAccessInput) => data)
  .handler(async ({ data }): Promise<CreateUserAccessResult> => {
    const { createUserAccessImpl } = await import("@/lib/create-user-access.server");
    return createUserAccessImpl(data);
  });
