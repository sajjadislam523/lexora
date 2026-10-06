import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/auth/auth";

// Better Auth's endpoints (sign-up, sign-in, sign-out, session). The only API route in Lexora.
export const { GET, POST } = toNextJsHandler(auth);
