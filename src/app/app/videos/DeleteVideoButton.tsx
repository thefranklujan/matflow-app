"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteVideoButton({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this video?")) return;
    setLoading(true);
    await fetch(`/api/admin/videos/${videoId}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-sm text-red-400 hover:text-red-300 transition disabled:opacity-50"
    >
      Delete
    </button>
  );
}
