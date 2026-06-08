"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export default function CategoryManager({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(initial);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    // Re-fetch from the server component so product counts stay accurate.
    router.refresh();
    const r = await fetch("/api/categories");
    if (r.ok) {
      const data = await r.json();
      setCategories((prev) =>
        data.map((c: { id: string; name: string; slug: string }) => ({
          ...c,
          productCount: prev.find((p) => p.id === c.id)?.productCount ?? 0,
        }))
      );
    }
  }

  async function createCategory() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (res.ok) {
      const created = await res.json();
      setCategories((prev) => [...prev, { ...created, productCount: 0 }]);
      setNewName("");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create category");
    }
  }

  async function saveRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusyId(null);
    if (res.ok) {
      const updated = await res.json();
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: updated.name, slug: updated.slug } : c))
      );
      setEditingId(null);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to rename category");
    }
  }

  async function deleteCategory(c: Category) {
    const msg =
      c.productCount > 0
        ? `Delete "${c.name}"? Its ${c.productCount} product${c.productCount === 1 ? "" : "s"} will move to Uncategorized.`
        : `Delete "${c.name}"?`;
    if (!confirm(msg)) return;
    setBusyId(c.id);
    setError("");
    const res = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) {
      setCategories((prev) => prev.filter((x) => x.id !== c.id));
      if (c.productCount > 0) await reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete category");
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              createCategory();
            }
          }}
          placeholder="New category name"
          className="flex-1 px-4 py-2 bg-brand-black border border-brand-gray rounded-lg text-white focus:border-brand-accent focus:outline-none transition"
        />
        <button
          type="button"
          onClick={createCategory}
          disabled={creating || !newName.trim()}
          className="bg-brand-accent text-brand-black font-bold px-5 py-2 rounded-lg hover:bg-brand-accent/90 transition disabled:opacity-50 whitespace-nowrap"
        >
          {creating ? "Adding..." : "Add"}
        </button>
      </div>

      {/* List */}
      <div className="bg-brand-dark border border-brand-gray rounded-lg divide-y divide-brand-gray/50">
        {categories.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No categories yet. Add your first one above.
          </div>
        )}
        {categories.map((c) => {
          const isUncategorized = c.slug === "uncategorized";
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              {editingId === c.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveRename(c.id);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="flex-1 px-3 py-1.5 bg-brand-black border border-brand-gray rounded-lg text-white text-sm focus:border-brand-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => saveRename(c.id)}
                    disabled={busyId === c.id}
                    className="text-sm text-brand-accent hover:underline disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-white text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-gray-500">
                    {c.productCount} {c.productCount === 1 ? "product" : "products"}
                  </span>
                  {!isUncategorized && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditName(c.name);
                          setError("");
                        }}
                        className="text-sm text-gray-400 hover:text-brand-accent transition"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCategory(c)}
                        disabled={busyId === c.id}
                        className="text-sm text-gray-400 hover:text-red-400 transition disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
