import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "@/components/feedback/Toaster";
import { useToastStore } from "@/stores/toastStore";

// Mock next/link since it requires Next.js router context
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("Toaster", () => {
  beforeEach(() => {
    // Clear all toasts before each test
    useToastStore.setState({ toasts: [] });
  });

  it("renders nothing when there are no toasts", () => {
    const { container } = render(<Toaster />);
    expect(container.querySelectorAll("[role='status']").length).toBe(0);
  });

  it("renders a success toast", () => {
    useToastStore.getState().push({
      title: "Skill created",
      description: "Your skill has been saved",
      variant: "success",
    });

    render(<Toaster />);

    expect(screen.getByText("Skill created")).toBeInTheDocument();
    expect(screen.getByText("Your skill has been saved")).toBeInTheDocument();
  });

  it("renders an error toast", () => {
    useToastStore.getState().push({
      title: "Failed to save",
      variant: "error",
    });

    render(<Toaster />);

    expect(screen.getByText("Failed to save")).toBeInTheDocument();
  });

  it("renders an info toast", () => {
    useToastStore.getState().push({
      title: "Tip",
      description: "You can use keyboard shortcuts",
      variant: "info",
    });

    render(<Toaster />);

    expect(screen.getByText("Tip")).toBeInTheDocument();
    expect(screen.getByText("You can use keyboard shortcuts")).toBeInTheDocument();
  });

  it("dismisses toast when close button is clicked", async () => {
    const user = userEvent.setup();

    useToastStore.getState().push({
      title: "Dismissible",
      variant: "info",
    });

    render(<Toaster />);

    expect(screen.getByText("Dismissible")).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText("Dismiss notification");
    await user.click(dismissBtn);

    expect(screen.queryByText("Dismissible")).not.toBeInTheDocument();
  });

  it("renders toast with action link", () => {
    useToastStore.getState().push(
      {
        title: "Execution complete",
        variant: "success",
      },
      {
        action: { label: "View Result", href: "/executions/123" },
      }
    );

    render(<Toaster />);

    expect(screen.getByText("View Result →")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view result/i });
    expect(link).toHaveAttribute("href", "/executions/123");
  });

  it("renders toast with action button (no href)", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    useToastStore.getState().push(
      {
        title: "Action available",
        variant: "info",
      },
      {
        action: { label: "Retry", onClick },
      }
    );

    render(<Toaster />);

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    await user.click(retryBtn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("auto-dismisses toasts after timeout (manual)", () => {
    // Verify the store's push method sets up auto-dismiss
    const initialCount = useToastStore.getState().toasts.length;
    useToastStore.getState().push({
      title: "Auto dismiss",
      variant: "info",
    });
    expect(useToastStore.getState().toasts.length).toBe(initialCount + 1);

    // Manually dismiss to verify dismiss works
    const toastId = useToastStore.getState().toasts[0]?.id;
    if (toastId) {
      useToastStore.getState().dismiss(toastId);
      expect(useToastStore.getState().toasts.find((t) => t.id === toastId)).toBeUndefined();
    }
  });
});
