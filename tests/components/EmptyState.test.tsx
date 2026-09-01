import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/feedback/EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        title="No skills found"
        description="Create your first skill to get started"
      />
    );

    expect(screen.getByText("No skills found")).toBeInTheDocument();
    expect(screen.getByText("Create your first skill to get started")).toBeInTheDocument();
  });

  it("renders default Terminal icon when no icon provided", () => {
    render(
      <EmptyState title="Empty" description="Nothing here" />
    );

    // The Terminal icon from lucide-react should be in the DOM
    const iconContainer = document.querySelector(".text-indigo-600, .dark\\:text-indigo-400");
    expect(iconContainer).toBeInTheDocument();
  });

  it("renders custom icon when provided", () => {
    const customIcon = <span data-testid="custom-icon">🔧</span>;
    render(
      <EmptyState
        title="Custom"
        description="With custom icon"
        icon={customIcon}
      />
    );

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders action slot when provided", () => {
    const action = <button data-testid="action-btn">Create Skill</button>;
    render(
      <EmptyState
        title="No skills"
        description="Start building"
        action={action}
      />
    );

    expect(screen.getByTestId("action-btn")).toBeInTheDocument();
    expect(screen.getByText("Create Skill")).toBeInTheDocument();
  });

  it("does not render action slot when not provided", () => {
    const { container } = render(
      <EmptyState title="Empty" description="Nothing" />
    );

    // The action div should not exist
    const actionBtn = container.querySelector("[data-testid='action-btn']");
    expect(actionBtn).not.toBeInTheDocument();
  });

  it("applies correct accessibility structure", () => {
    render(
      <EmptyState title="Title" description="Desc" />
    );

    // Title should be an h3
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("Title");
  });
});
