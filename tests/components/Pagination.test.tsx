import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "@/components/common/Pagination";

describe("Pagination", () => {
  const onPageChange = vi.fn();

  it("renders nothing when totalPages <= 1", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={onPageChange} />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders page buttons for small page counts", () => {
    render(
      <Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("highlights the current page", () => {
    render(
      <Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />
    );

    const currentPageBtn = screen.getByText("2");
    expect(currentPageBtn).toHaveClass("bg-indigo-600");
    expect(currentPageBtn).toHaveClass("text-white");
  });

  it("calls onPageChange when a page button is clicked", async () => {
    const user = userEvent.setup();
    const change = vi.fn();

    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={change} />
    );

    await user.click(screen.getByText("3"));
    expect(change).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange(-1) when previous is clicked", async () => {
    const user = userEvent.setup();
    const change = vi.fn();

    render(
      <Pagination currentPage={2} totalPages={5} onPageChange={change} />
    );

    await user.click(screen.getByLabelText("Previous Page"));
    expect(change).toHaveBeenCalledWith(1);
  });

  it("calls onPageChange(+1) when next is clicked", async () => {
    const user = userEvent.setup();
    const change = vi.fn();

    render(
      <Pagination currentPage={2} totalPages={5} onPageChange={change} />
    );

    await user.click(screen.getByLabelText("Next Page"));
    expect(change).toHaveBeenCalledWith(3);
  });

  it("disables previous button on first page", () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />
    );

    expect(screen.getByLabelText("Previous Page")).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(
      <Pagination currentPage={5} totalPages={5} onPageChange={onPageChange} />
    );

    expect(screen.getByLabelText("Next Page")).toBeDisabled();
  });

  it("shows page info text", () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={10}
        onPageChange={onPageChange}
        totalCount={100}
      />
    );

    expect(screen.getByText("2 / 10 (100 total)")).toBeInTheDocument();
  });

  it("shows ellipsis for large page counts", () => {
    render(
      <Pagination currentPage={5} totalPages={20} onPageChange={onPageChange} />
    );

    // Should show ellipsis markers
    const ellipses = screen.getAllByText("...");
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });

  it("disables all buttons when loading", () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={10}
        onPageChange={onPageChange}
        loading={true}
      />
    );

    expect(screen.getByLabelText("Previous Page")).toBeDisabled();
    expect(screen.getByLabelText("Next Page")).toBeDisabled();
    // Page buttons should also be disabled
    const page3 = screen.getByText("3");
    expect(page3).toBeDisabled();
  });
});
