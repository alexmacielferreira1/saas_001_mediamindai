import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import MCPExpress from "./MCPExpress";

describe("MCPExpress", () => {
  it("uses tool-specific actions and opens the matching MCP flow", () => {
    const opened = vi.fn();
    window.addEventListener("mm:mcp-open", opened);
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=photocraft"]}><MCPExpress /></MemoryRouter>);

    expect(screen.getByRole("button", { name: /Recortar/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Executar/ }));
    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.objectContaining({ appId: "mmphoto" }) }));
    window.removeEventListener("mm:mcp-open", opened);
  });
});
