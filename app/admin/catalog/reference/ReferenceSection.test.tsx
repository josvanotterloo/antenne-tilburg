import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReferenceSection, type ReferenceItem } from "./ReferenceSection";

const INITIAL: ReferenceItem[] = [
  { id: "1", name: "Ambient", productCount: 0 },
  { id: "2", name: "House", productCount: 3 },
];

const SERVER: ReferenceItem[] = [
  ...INITIAL,
  { id: "3", name: "Techno", productCount: 5 },
];

function mockFetch(overrides: { post?: ReferenceItem } = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const method = init?.method ?? "GET";
    if (method === "POST") {
      return new Response(
        JSON.stringify(overrides.post ?? { id: "9", name: "Dub" }),
        { status: 201 },
      );
    }
    if (method === "PATCH" || method === "DELETE") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    const q = (
      new URL(String(url), "http://test").searchParams.get("q") ?? ""
    ).toLowerCase();
    const matches = SERVER.filter((o) => o.name.toLowerCase().includes(q));
    return new Response(JSON.stringify(matches), { status: 200 });
  }) as unknown as ReturnType<typeof vi.fn>;
}

// Same shape as Combobox.test.tsx's helper of the same name — extracts the
// ?q= search terms actually sent to the server, GET requests only, so tests
// can assert on debounce coalescing (how many requests, for which queries)
// instead of only the eventual DOM state.
function requestedQueries(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => !init || !init.method || init.method === "GET")
    .map(([url]) => new URL(String(url), "http://test").searchParams.get("q"))
    .filter((q): q is string => q !== null);
}

function setup(overrides: Partial<Parameters<typeof ReferenceSection>[0]> = {}) {
  render(
    <ReferenceSection
      title="Genres"
      endpoint="/api/admin/genres"
      initialItems={INITIAL}
      initialTotal={90}
      {...overrides}
    />,
  );
}

describe("ReferenceSection", () => {
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    fetchMock = mockFetch();
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders a search input scoped to the section", () => {
    setup();
    expect(
      screen.getByRole("searchbox", { name: /search genres/i }),
    ).toBeInTheDocument();
  });

  it("is not focused by default", () => {
    setup();
    expect(screen.getByRole("region", { name: "Genres" })).not.toHaveFocus();
  });

  it("receives focus on mount when focused is true", () => {
    setup({ focused: true });
    expect(screen.getByRole("region", { name: "Genres" })).toHaveFocus();
  });

  it("renders the total count", () => {
    setup();
    expect(screen.getByText(/90 genres/i)).toBeInTheDocument();
  });

  it("does not refetch on initial mount — initialItems already reflect the empty-query search", async () => {
    setup();
    // Wait past ReferenceSection's 200ms search debounce: a fetch fired by
    // a mount-triggered effect run would still be pending immediately after
    // render (it's behind that timer), so asserting synchronously here
    // wouldn't actually exercise the mount-skip guard.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updates results as the user types, debounced", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.getByText("Ambient")).toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: /search genres/i }),
      "tec",
    );

    expect(await screen.findByText("Techno")).toBeInTheDocument();
    expect(screen.queryByText("Ambient")).toBeNull();

    // Debounce coalescing: intermediate keystrokes ("t", "te") never reach
    // the server, and the settled query is only requested once.
    const queries = requestedQueries(fetchMock);
    expect(queries.filter((q) => q === "tec")).toHaveLength(1);
    expect(queries).not.toContain("t");
    expect(queries).not.toContain("te");
  });

  it("increments the total and shows a newly-added item that matches the empty query", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(
      screen.getByRole("textbox", { name: /new genres name/i }),
      "Dub",
    );
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(await screen.findByText("Dub")).toBeInTheDocument();
    expect(screen.getByText(/91 genres/i)).toBeInTheDocument();
  });

  it("increments the total but hides a newly-added item that doesn't match the active search", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(
      screen.getByRole("searchbox", { name: /search genres/i }),
      "tec",
    );
    await screen.findByText("Techno");

    await user.type(
      screen.getByRole("textbox", { name: /new genres name/i }),
      "Dub",
    );
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await screen.findByText(/91 genres/i);
    expect(screen.queryByText("Dub")).toBeNull();
  });

  it("keeps a renamed item visible even if the new name no longer matches the active search", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(
      screen.getByRole("searchbox", { name: /search genres/i }),
      "hou",
    );
    // "House" is already visible from the initial (unfiltered) list, so
    // waiting on it alone wouldn't prove the debounced search has actually
    // run. Wait for evidence the "hou" filter applied instead: Ambient,
    // which doesn't match, disappearing.
    await waitFor(() => expect(screen.queryByText("Ambient")).toBeNull());

    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const editInput = screen.getByRole("textbox", { name: /edit house/i });
    await user.clear(editInput);
    await user.type(editInput, "Techno Renamed");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText("Techno Renamed")).toBeInTheDocument();
  });

  it("removes a deleted item and decrements the total", async () => {
    const user = userEvent.setup();
    setup({ initialItems: [{ id: "1", name: "Ambient", productCount: 0 }] });

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(await screen.findByText(/89 genres/i)).toBeInTheDocument();
    expect(screen.queryByText("Ambient")).toBeNull();
  });

  it("ignores a slow, stale search response that resolves after a newer one (out-of-order request guard)", async () => {
    const user = userEvent.setup();

    // Replaces the shared beforeEach mock with one whose GET responses never
    // resolve on their own — each is held open until the test explicitly
    // resolves it, in whichever order the test chooses. This is what lets
    // us simulate a real out-of-order network response: the older request
    // ("tec") is made first but resolves *last*.
    type Resolver = (items: ReferenceItem[]) => void;
    const resolvers: Resolver[] = [];
    const fetchOrder: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const q = new URL(String(url), "http://test").searchParams.get("q") ?? "";
      fetchOrder.push(q);
      return new Promise<Response>((resolve) => {
        resolvers.push((items) =>
          resolve(new Response(JSON.stringify(items), { status: 200 })),
        );
      });
    });

    setup();
    const searchbox = screen.getByRole("searchbox", { name: /search genres/i });

    // First search settles and its (still-unresolved) request goes out.
    await user.type(searchbox, "tec");
    await waitFor(() => expect(fetchOrder).toContain("tec"));

    // Second, different search settles too — its request also goes out
    // while "tec"'s response is still pending.
    await user.clear(searchbox);
    await user.type(searchbox, "hou");
    await waitFor(() => expect(fetchOrder).toContain("hou"));

    expect(fetchOrder).toEqual(["tec", "hou"]);
    expect(resolvers).toHaveLength(2);

    // Resolve the newer request ("hou") first, then the older, slower one
    // ("tec") last — the guard should make the component keep "hou"'s
    // results and ignore "tec"'s late, stale arrival.
    resolvers[1]([{ id: "2", name: "House", productCount: 3 }]);
    expect(await screen.findByText("House")).toBeInTheDocument();

    resolvers[0]([{ id: "3", name: "Techno", productCount: 5 }]);
    // Let the now-resolving "tec" response's promise chain run to
    // completion (await fetch -> await res.json() -> state check) before
    // asserting it had no effect.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.getByText("House")).toBeInTheDocument();
    expect(screen.queryByText("Techno")).toBeNull();
  });

  it("does not let a stale search response clobber an optimistically-added item (search-vs-mutation race)", async () => {
    const user = userEvent.setup();

    // Same manually-controlled-resolver technique as the search-vs-search
    // race above, but this time the race is between an in-flight search and
    // a mutation: GET ("search") responses are held open until the test
    // explicitly resolves them; POST ("add") resolves immediately, so the
    // optimistic add can land *before* the stale search response does.
    type Resolver = (items: ReferenceItem[]) => void;
    const resolvers: Resolver[] = [];
    const fetchOrder: string[] = [];
    const created = { id: "9", name: "Technics" };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const method = init?.method ?? "GET";
      if (method === "POST") {
        return new Response(JSON.stringify(created), { status: 201 });
      }
      const q = new URL(String(url), "http://test").searchParams.get("q") ?? "";
      fetchOrder.push(q);
      return new Promise<Response>((resolve) => {
        resolvers.push((items) =>
          resolve(new Response(JSON.stringify(items), { status: 200 })),
        );
      });
    });

    setup();
    const searchbox = screen.getByRole("searchbox", { name: /search genres/i });

    // Search settles and its request goes out, but is held open — it's
    // still in flight when the mutation below happens.
    await user.type(searchbox, "tec");
    await waitFor(() => expect(fetchOrder).toContain("tec"));
    expect(resolvers).toHaveLength(1);

    // While the search is still pending, add a new item that matches the
    // active query ("Technics" matches "tec") — its POST resolves
    // immediately, so the optimistic setItems runs before the stale search
    // response below does.
    await user.type(
      screen.getByRole("textbox", { name: /new genres name/i }),
      "Technics",
    );
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(await screen.findByText("Technics")).toBeInTheDocument();

    // Now the earlier, now-stale "tec" search response finally resolves,
    // with results computed from before the mutation happened server-side.
    // It must not clobber the optimistic add.
    resolvers[0]([{ id: "3", name: "Techno", productCount: 5 }]);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.getByText("Technics")).toBeInTheDocument();
  });

  it("shows an empty-state message when a search matches nothing", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(
      screen.getByRole("searchbox", { name: /search genres/i }),
      "zzznomatch",
    );

    expect(await screen.findByText(/no matches/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("hints that results are truncated when the 20-result cap is hit", async () => {
    const user = userEvent.setup();
    const twenty: ReferenceItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
      productCount: 0,
    }));
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify(twenty), { status: 200 });
    });

    setup();
    await user.type(
      screen.getByRole("searchbox", { name: /search genres/i }),
      "a",
    );

    expect(await screen.findByText(/showing the first 20/i)).toBeInTheDocument();
  });

  it("does not show the truncation hint when results are under the cap", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(
      screen.getByRole("searchbox", { name: /search genres/i }),
      "tec",
    );

    await screen.findByText("Techno");
    expect(screen.queryByText(/showing the first 20/i)).toBeNull();
  });

  describe("supplier field (Labels only)", () => {
    it("does not render a supplier field when supplierEndpoint is absent", () => {
      setup();
      expect(screen.queryByRole("combobox", { name: /supplier/i })).toBeNull();
    });

    it("sends supplierId when adding an item with supplierEndpoint set", async () => {
      const user = userEvent.setup();
      fetchMock = mockFetch({
        post: {
          id: "l1",
          name: "Warp",
          productCount: 0,
          supplierId: "s1",
          supplierName: "Beta",
        },
      });

      render(
        <ReferenceSection
          title="Labels"
          endpoint="/api/admin/labels"
          initialItems={[]}
          initialTotal={0}
          supplierEndpoint="/api/admin/suppliers"
        />,
      );
      await user.type(screen.getByLabelText(/new labels name/i), "Warp");
      await user.click(screen.getByRole("button", { name: /^add$/i }));

      expect(await screen.findByText("Warp")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/labels",
        expect.objectContaining({
          body: JSON.stringify({ name: "Warp", supplierId: null }),
        }),
      );
    });
  });
});
