// @vitest-environment jsdom

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "@/components/household/app-shell";
import { announceSaveComplete } from "@/lib/save-feedback";

vi.mock("next/navigation", () => ({
  usePathname: () => "/h/group/add/expense",
  useRouter: () => ({ replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/components/household/app-navigation", () => ({ AppNavigation: () => null }));
vi.mock("@/components/ui/brand", () => ({ CatMark: () => null }));

afterEach(cleanup);

function Form() {
  const [pending, setPending] = useState(false);
  return React.createElement(
    "form",
    {
      "data-mobile-submit": true,
      "aria-busy": pending,
      onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPending(true);
      },
    },
    React.createElement(
      "button",
      { type: "submit", disabled: pending },
      pending ? "Saving…" : "Add",
    ),
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          announceSaveComplete("Expense added");
          setPending(false);
        },
      },
      "Complete save",
    ),
  );
}

it("shows mobile saving state and completion feedback for a shell-submitted form", async () => {
  render(
    React.createElement(
      AppShell as React.ComponentType<Omit<React.ComponentProps<typeof AppShell>, "children">>,
      {
        householdId: "group",
        memberName: "Member",
        memberAvatarColor: null,
        mustChangePin: false,
      },
      React.createElement(Form),
    ),
  );

  fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Saving…" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Saving" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  fireEvent.click(screen.getByRole("button", { name: "Complete save" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Expense added"));
  expect(screen.getByRole("button", { name: "Add expense" })).toBeTruthy();
});
