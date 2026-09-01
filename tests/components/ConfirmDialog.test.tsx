import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

const defaultProps = {
  isOpen: true,
  title: "Delete Skill",
  description: "Are you sure you want to delete this skill?",
  confirmLabel: "Delete",
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

describe("ConfirmDialog", () => {
  it("renders when isOpen is true", () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText("Delete Skill")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to delete this skill?")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} isOpen={false} />
    );

    expect(container.innerHTML).toBe("");
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ConfirmDialog {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ConfirmDialog {...defaultProps} onClose={onClose} />);

    // The backdrop has aria-hidden and onClick={onClose}
    const backdrop = document.querySelector("[aria-hidden='true']");
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows processing state when isPending is true", () => {
    render(<ConfirmDialog {...defaultProps} isPending={true} />);

    expect(screen.getByRole('button', { name: /processing/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it("disables buttons when isPending is true", () => {
    render(<ConfirmDialog {...defaultProps} isPending={true} />);

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    const confirmBtn = screen.getByRole('button', { name: /processing/i });
    expect(cancelBtn).toBeDisabled();
    expect(confirmBtn).toBeDisabled();
  });

  it("has correct dialog accessibility attributes", () => {
    render(<ConfirmDialog {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Delete Skill");
  });

  it("uses warning variant styling when variant is warning", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        variant="warning"
        confirmLabel="Archive"
      />
    );

    expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
    // Warning variant should still render the dialog
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
