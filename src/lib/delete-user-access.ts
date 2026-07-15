import { createServerFn } from "@tanstack/react-start";
import type {
  DeleteUserAccessInput,
  DeleteUserAccessResult,
} from "@/lib/delete-user-access.server";

export type { DeleteUserAccessInput, DeleteUserAccessResult };

export const deleteUserAccessFn = createServerFn({ method: "POST" })
  .validator((data: DeleteUserAccessInput) => data)
  .handler(async ({ data }): Promise<DeleteUserAccessResult> => {
    const { deleteUserAccessImpl } = await import("@/lib/delete-user-access.server");
    return deleteUserAccessImpl(data);
  });
