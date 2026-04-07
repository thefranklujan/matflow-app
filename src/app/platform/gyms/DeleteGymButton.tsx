"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteGymButton({ gymId, gymName }: { gymId: string; gymName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    const confirmation = window.prompt(
      `This will permanently delete "${gymName}" and ALL of its data (members, products, orders, etc). Type the gym name to confirm:`
    );
    if (confirmation !== gymName) {
      if (confirmation !== null) alert("Name did not match. Cancelled.");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/platform/gyms/${gymId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={onDelete}
      disabled={loading}
      className="text-red-400 hover:text-red-300 disabled:opacity-50 ml-3"
      title="Delete gym"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
