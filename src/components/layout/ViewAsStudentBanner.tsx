"use client";

export default function ViewAsStudentBanner() {
  async function exit() {
    await fetch("/api/admin/view-as-student", { method: "DELETE" });
    window.location.href = "/app";
  }
  return (
    <div className="bg-yellow-500 text-black px-6 py-2 flex items-center justify-between text-sm font-medium">
      <span>👀 Viewing as student — admin actions are hidden until you exit.</span>
      <button onClick={exit} className="bg-black text-yellow-300 px-3 py-1 rounded font-bold hover:bg-gray-900 transition">
        Exit student view
      </button>
    </div>
  );
}
