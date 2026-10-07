import { createAuthClient } from "better-auth/react";

/** Browser-side auth client. Same origin, so no base URL is needed. Holds no secrets. */
export const authClient = createAuthClient();
