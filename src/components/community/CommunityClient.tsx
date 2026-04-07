"use client";

import { useState } from "react";
import { Send, Trash2, Users } from "lucide-react";

interface GroupSummary {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  memberCount: number;
}

interface PostItem {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorBelt: string;
  isMine: boolean;
}

interface MemberItem {
  studentId: string;
  name: string;
  joinedAt: string;
}

export default function CommunityClient({
  groups,
  selectedGroupId,
  posts: initialPosts,
  members,
}: {
  groups: GroupSummary[];
  selectedGroupId: string | null;
  posts: PostItem[];
  members: MemberItem[];
}) {
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const selected = groups.find((g) => g.id === selectedGroupId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroupId || !body.trim()) return;
    setPosting(true);
    const res = await fetch("/api/student/community/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: selectedGroupId, body }),
    });
    if (res.ok) {
      const created = await res.json();
      setPosts((prev) => [{
        id: created.id,
        body: created.body,
        createdAt: created.createdAt,
        authorName: "You",
        authorBelt: "white",
        isMine: true,
      }, ...prev]);
      setBody("");
    }
    setPosting(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/student/community/post?id=${id}`, { method: "DELETE" });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Community</h1>
      </div>

      {groups.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-10 text-center">
          <Users className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">You&apos;re not in any community yet</p>
          <p className="text-gray-500 text-sm mb-4">
            Nominate a gym to start a private group with everyone else from your academy.
          </p>
          <a href="/student/nominate" className="inline-block bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold px-4 py-2 rounded-lg text-sm transition">
            Nominate Your Gym
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Group list */}
          <div className="lg:col-span-1">
            <h2 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Your Groups</h2>
            <div className="space-y-2">
              {groups.map((g) => (
                <a
                  key={g.id}
                  href={`?group=${g.id}`}
                  className={`block bg-[#0a0a0a] border rounded-lg p-3 transition ${
                    g.id === selectedGroupId ? "border-[#dc2626]" : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <p className="text-white font-semibold text-sm">{g.name}</p>
                  {(g.city || g.state) && (
                    <p className="text-gray-500 text-xs">{[g.city, g.state].filter(Boolean).join(", ")}</p>
                  )}
                  <p className="text-[#dc2626] text-xs font-semibold mt-1">{g.memberCount} member{g.memberCount === 1 ? "" : "s"}</p>
                </a>
              ))}
            </div>
          </div>

          {/* Selected group */}
          <div className="lg:col-span-2">
            {selected ? (
              <>
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Group</p>
                  <h2 className="text-2xl font-bold text-white mt-1">{selected.name}</h2>
                  {(selected.city || selected.state) && (
                    <p className="text-gray-500 text-sm">{[selected.city, selected.state].filter(Boolean).join(", ")}</p>
                  )}
                  <p className="text-[#dc2626] text-sm mt-2 font-semibold">
                    {selected.memberCount} student{selected.memberCount === 1 ? "" : "s"} from this gym
                  </p>
                </div>

                {/* Post composer */}
                <form onSubmit={submit} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 mb-4">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                    placeholder="Share something with your gym crew..."
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#dc2626]"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={posting || !body.trim()}
                      className="inline-flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {posting ? "Posting..." : "Post"}
                    </button>
                  </div>
                </form>

                {/* Feed */}
                <div className="space-y-3 mb-6">
                  {posts.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-8">No posts yet. Be the first.</p>
                  ) : (
                    posts.map((p) => (
                      <div key={p.id} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-semibold text-sm">{p.authorName}</p>
                              <span className="text-gray-600 text-xs capitalize">{p.authorBelt} belt</span>
                              <span className="text-gray-700 text-xs">·</span>
                              <span className="text-gray-600 text-xs">{new Date(p.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-gray-300 text-sm mt-2 whitespace-pre-wrap">{p.body}</p>
                          </div>
                          {p.isMine && (
                            <button onClick={() => remove(p.id)} className="text-gray-600 hover:text-red-400 transition">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Members */}
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">
                    Members ({members.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {members.map((m) => (
                      <div key={m.studentId} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                        <div className="h-7 w-7 rounded-full bg-[#dc2626]/20 text-[#dc2626] flex items-center justify-center text-xs font-bold">
                          {m.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <span className="text-white text-xs truncate">{m.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-10 text-center text-gray-500">
                Select a group to view its feed.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
