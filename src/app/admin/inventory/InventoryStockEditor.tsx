"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InventoryStockEditor({
  variantId,
  currentStock,
}: {
  variantId: string;
  currentStock: number;
}) {
  const router = useRouter();
  const [stock, setStock] = useState(currentStock);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/inventory/${variantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(parseInt(e.target.value) || 0)}
          className="w-20 px-2 py-1 bg-brand-black border border-brand-gray rounded text-white text-sm focus:border-brand-teal focus:outline-none"
          min="0"
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs text-brand-teal hover:underline"
        >
          {saving ? "..." : "Save"}
        </button>
        <button
          onClick={() => {
            setStock(currentStock);
            setEditing(false);
          }}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`text-sm font-medium cursor-pointer hover:text-brand-teal transition ${
        currentStock <= 3 ? "text-red-400" : "text-gray-300"
      }`}
    >
      {currentStock}
      {currentStock <= 3 && <span className="text-xs ml-1">(low)</span>}
    </button>
  );
}
