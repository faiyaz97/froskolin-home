export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function validationFailure<T = undefined>(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): ActionResult<T> {
  const fieldErrors = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter((entry): entry is [string, string[]] =>
      Array.isArray(entry[1]),
    ),
  );
  return { ok: false, error: "Please correct the highlighted information.", fieldErrors };
}

export function actionFailure(error: unknown): ActionResult {
  if (error instanceof Error) {
    if (error.name === "AuthorizationError") return { ok: false, error: error.message };
    return { ok: false, error: "We couldn't save that change. Please try again." };
  }
  return { ok: false, error: "We couldn't save that change. Please try again." };
}
