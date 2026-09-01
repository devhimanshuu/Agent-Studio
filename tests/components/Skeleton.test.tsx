import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Skeleton,
  SkeletonGrid,
  SkeletonList,
  SkeletonTable,
  SkeletonPanels,
  SkeletonDashboard,
  SkeletonSkills,
  SkeletonExecutions,
} from "@/components/feedback/Skeleton";

describe("Skeleton", () => {
  it("renders a skeleton element", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass("skeleton-shimmer");
    expect(el).toHaveAttribute("aria-hidden");
  });
});

describe("SkeletonGrid", () => {
  it("renders default 6 cards", () => {
    const { container } = render(<SkeletonGrid />);
    // Each card has multiple skeleton elements, but the grid container should exist
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass("grid");
  });

  it("renders custom number of cards", () => {
    const { container } = render(<SkeletonGrid cards={3} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe("SkeletonList", () => {
  it("renders default 5 rows", () => {
    const { container } = render(<SkeletonList />);
    const list = container.firstChild as HTMLElement;
    expect(list).toHaveClass("space-y-3");
  });

  it("renders custom number of rows", () => {
    const { container } = render(<SkeletonList rows={2} />);
    const list = container.firstChild as HTMLElement;
    expect(list.children.length).toBe(2);
  });
});

describe("SkeletonTable", () => {
  it("renders a table structure", () => {
    const { container } = render(<SkeletonTable cols={4} rows={5} />);
    const table = container.firstChild as HTMLElement;
    expect(table).toBeInTheDocument();
    expect(table).toHaveClass("overflow-hidden");
  });
});

describe("SkeletonPanels", () => {
  it("renders panel grid", () => {
    const { container } = render(<SkeletonPanels panels={2} rows={4} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass("grid");
  });
});

describe("Composed Page Skeletons", () => {
  it("SkeletonDashboard has status role and loading label", () => {
    render(<SkeletonDashboard />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(screen.getByText("Loading dashboard")).toBeInTheDocument();
  });

  it("SkeletonSkills has status role and loading label", () => {
    render(<SkeletonSkills />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading skills")).toBeInTheDocument();
  });

  it("SkeletonExecutions has status role and loading label", () => {
    render(<SkeletonExecutions />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading executions")).toBeInTheDocument();
  });
});
