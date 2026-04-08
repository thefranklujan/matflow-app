"use client";

import { useState } from "react";
import { Send, Trash2, Users, Shield, Flag, EyeOff, Check, X, Clock, Heart, MessageCircle, Trophy } from "lucide-react";

interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
  authorBelt: string;
  isMine: boolean;
}

interface PostItem {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorBelt: string;
  authorJoinedAt: string;
  authorSessionCount: number;
  isMine: boolean;
  reportCount: number;
  hidden: boolean;
  likeCount: number;
  likedByMe: boolean;
  comments: CommentItem[];
}

interface MemberItem {
  studentId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: string;
  role: string;
  belt: string;
  sessionCount: number;
}

interface LeaderboardEntry {
  studentId: string;
  name: string;
  avatarUrl: string | null;
  belt: string;
  sessions: number;
}

interface GroupSummary {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  memberCount: number;
  myRole: string;
  myStatus: string;
  pendingCount: number;
}

function daysAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function Avatar({ name, url, className = "h-8 w-8 text-xs" }: { name: string; url: string | null; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={`${className} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${className} rounded-full bg-[#dc2626]/20 text-[#dc2626] flex items-center justify-center font-bold shrink-0`}>
      {initials(name)}
    </div>
  );
}

const BELT_DOT: Record<string, string> = {
  white: "bg-white",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  brown: "bg-amber-700",
  black: "bg-black border border-white/30",
};

export default function CommunityClient({
  groups,
  selectedGroupId,
  posts: initialPosts,
  members,
  pending,
  leaderboard = [],
  isMod,
  myStatus,
}: {
  groups: GroupSummary[];
  selectedGroupId: string | null;
  posts: PostItem[];
  members: MemberItem[];
  pending: MemberItem[];
  leaderboard?: LeaderboardEntry[];
  isMod: boolean;
  myStatus: string;
}) {
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [pendingMembers, setPendingMembers] = useState<MemberItem[]>(pending);
  const [activeMembers, setActiveMembers] = useState<MemberItem[]>(members);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const selected = groups.find((g) => g.id === selectedGroupId);

  async function submitPost(e: React.FormEvent) {
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
        authorId: "you",
        authorName: "You",
        authorBelt: "white",
        authorJoinedAt: new Date().toISOString(),
        authorSessionCount: 0,
        isMine: true,
        reportCount: 0,
        hidden: false,
      }, ...prev]);
      setBody("");
    }
    setPosting(false);
  }

  async function removePost(id: string) {
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/student/community/post?id=${id}`, { method: "DELETE" });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function modAction(postId: string, action: "hide" | "unhide" | "delete") {
    if (action === "delete" && !confirm("Delete this post permanently?")) return;
    const res = await fetch("/api/student/community/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, action }),
    });
    if (!res.ok) return;
    if (action === "delete") {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } else {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, hidden: action === "hide" } : p));
    }
  }

  async function toggleLike(postId: string) {
    // Optimistic
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likedByMe ? p.likeCount - 1 : p.likeCount + 1 }
          : p
      )
    );
    const res = await fetch("/api/student/community/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    if (!res.ok) {
      // Revert
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likedByMe ? p.likeCount - 1 : p.likeCount + 1 }
            : p
        )
      );
    }
  }

  function toggleComments(postId: string) {
    setOpenComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }

  async function submitComment(postId: string) {
    const draft = commentDrafts[postId]?.trim();
    if (!draft) return;
    const res = await fetch("/api/student/community/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, body: draft }),
    });
    if (!res.ok) return;
    const c = await res.json();
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: [...p.comments, c] } : p
      )
    );
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
  }

  async function deleteComment(postId: string, commentId: string) {
    const res = await fetch(`/api/student/community/comment?id=${commentId}`, { method: "DELETE" });
    if (!res.ok) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p
      )
    );
  }

  async function reportPost(postId: string) {
    const reason = prompt("Why are you reporting this post? (optional)");
    if (reason === null) return;
    const res = await fetch("/api/student/community/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, reason }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.alreadyReported) {
        alert("You've already reported this post.");
      } else {
        alert("Reported. Moderators will review.");
        if (data.hidden) {
          setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, hidden: true, reportCount: p.reportCount + 1 } : p));
        } else {
          setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, reportCount: p.reportCount + 1 } : p));
        }
      }
    }
  }

  async function vouch(memberStudentId: string, action: "approve" | "reject") {
    if (!selectedGroupId) return;
    const res = await fetch("/api/student/community/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: selectedGroupId, memberStudentId, action }),
    });
    if (!res.ok) return;
    const approved = pendingMembers.find((m) => m.studentId === memberStudentId);
    setPendingMembers((prev) => prev.filter((m) => m.studentId !== memberStudentId));
    if (action === "approve" && approved) {
      setActiveMembers((prev) => [...prev, { ...approved, status: "active" } as MemberItem]);
    }
  }

  async function promoteOrDemote(memberStudentId: string, action: "promote" | "demote") {
    if (!selectedGroupId) return;
    const res = await fetch("/api/student/community/promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: selectedGroupId, memberStudentId, action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed");
      return;
    }
    setActiveMembers((prev) =>
      prev.map((m) =>
        m.studentId === memberStudentId ? { ...m, role: action === "promote" ? "mod" : "member" } : m
      )
    );
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white font-semibold text-sm flex items-center gap-1.5">
                      {g.name}
                      {g.myRole === "mod" && <Shield className="h-3 w-3 text-yellow-400" />}
                    </p>
                    {g.pendingCount > 0 && (
                      <span className="bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {g.pendingCount}
                      </span>
                    )}
                  </div>
                  {(g.city || g.state) && (
                    <p className="text-gray-500 text-xs">{[g.city, g.state].filter(Boolean).join(", ")}</p>
                  )}
                  <p className="text-[#dc2626] text-xs font-semibold mt-1">
                    {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                    {g.myStatus === "pending" && <span className="ml-2 text-yellow-400">· Pending vouch</span>}
                  </p>
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
                  <h2 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
                    {selected.name}
                    {isMod && (
                      <span className="bg-yellow-400/20 text-yellow-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded inline-flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Moderator
                      </span>
                    )}
                  </h2>
                  {(selected.city || selected.state) && (
                    <p className="text-gray-500 text-sm">{[selected.city, selected.state].filter(Boolean).join(", ")}</p>
                  )}
                  <p className="text-[#dc2626] text-sm mt-2 font-semibold">
                    {selected.memberCount} student{selected.memberCount === 1 ? "" : "s"} from this gym
                  </p>
                </div>

                {/* Pending state for current user */}
                {myStatus === "pending" && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 mb-4 flex items-start gap-3">
                    <Clock className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-300 font-semibold text-sm">Awaiting vouch from a moderator</p>
                      <p className="text-yellow-200/80 text-xs mt-1">
                        A moderator from this group needs to approve you before you can see the feed or post. We&apos;ll let you in as soon as someone vouches.
                      </p>
                    </div>
                  </div>
                )}

                {/* Mod: pending vouches panel */}
                {isMod && pendingMembers.length > 0 && (
                  <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-5 mb-4">
                    <h3 className="text-yellow-400 text-xs uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" /> Pending Vouches ({pendingMembers.length})
                    </h3>
                    <div className="space-y-2">
                      {pendingMembers.map((m) => (
                        <div key={m.studentId} className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-xs font-bold">
                              {initials(m.name)}
                            </div>
                            <div>
                              <p className="text-white text-sm">{m.name}</p>
                              <p className="text-gray-500 text-xs">{m.sessionCount} sessions logged · joined {daysAgo(m.joinedAt)}d ago</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => vouch(m.studentId, "approve")}
                              className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded inline-flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" /> Vouch
                            </button>
                            <button
                              onClick={() => vouch(m.studentId, "reject")}
                              className="bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 text-xs font-bold px-3 py-1.5 rounded inline-flex items-center gap-1"
                            >
                              <X className="h-3 w-3" /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post composer (active members only) */}
                {myStatus === "active" && (
                  <form onSubmit={submitPost} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 mb-4">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Share something with your gym crew..."
                      className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#dc2626]"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-gray-600 text-xs">{body.length} / 500</span>
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
                )}

                {/* Feed */}
                {myStatus === "active" && (
                  <div className="space-y-3 mb-6">
                    {posts.length === 0 ? (
                      <p className="text-gray-600 text-sm text-center py-8">No posts yet. Be the first.</p>
                    ) : (
                      posts.map((p) => (
                        <div
                          key={p.id}
                          className={`bg-[#0a0a0a] border rounded-xl p-4 ${
                            p.hidden ? "border-yellow-500/30 opacity-60" : "border-white/10"
                          }`}
                        >
                          {p.hidden && (
                            <div className="text-yellow-400 text-[10px] uppercase tracking-wider font-bold mb-2 inline-flex items-center gap-1">
                              <EyeOff className="h-3 w-3" /> Hidden. {p.reportCount} report{p.reportCount === 1 ? "" : "s"}
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <Avatar name={p.authorName} url={p.authorAvatar} className="h-9 w-9 text-xs" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-white font-semibold text-sm">{p.authorName}</p>
                                <span className={`h-2 w-2 rounded-full ${BELT_DOT[p.authorBelt] || BELT_DOT.white}`} />
                                <span className="text-gray-500 text-xs capitalize">{p.authorBelt} belt</span>
                                <span className="text-gray-700 text-xs">·</span>
                                <span className="text-gray-500 text-xs">{p.authorSessionCount} sessions</span>
                                {p.authorJoinedAt && (
                                  <>
                                    <span className="text-gray-700 text-xs">·</span>
                                    <span className="text-gray-500 text-xs">{daysAgo(p.authorJoinedAt)}d on MatFlow</span>
                                  </>
                                )}
                              </div>
                              <p className="text-gray-300 text-sm mt-2 whitespace-pre-wrap">{p.body}</p>
                              <div className="flex items-center gap-4 mt-3 text-xs">
                                <button
                                  onClick={() => toggleLike(p.id)}
                                  className={`inline-flex items-center gap-1 transition ${
                                    p.likedByMe ? "text-[#dc2626]" : "text-gray-500 hover:text-[#dc2626]"
                                  }`}
                                >
                                  <Heart className="h-3.5 w-3.5" fill={p.likedByMe ? "currentColor" : "none"} />
                                  <span className="font-semibold">{p.likeCount}</span>
                                </button>
                                <button
                                  onClick={() => toggleComments(p.id)}
                                  className="inline-flex items-center gap-1 text-gray-500 hover:text-white transition"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  <span className="font-semibold">{p.comments.length}</span>
                                </button>
                                <span className="text-gray-700">{new Date(p.createdAt).toLocaleDateString()}</span>
                                {!p.isMine && (
                                  <button onClick={() => reportPost(p.id)} className="text-gray-600 hover:text-red-400 inline-flex items-center gap-1">
                                    <Flag className="h-3 w-3" /> Report
                                  </button>
                                )}
                                {isMod && !p.isMine && (
                                  <>
                                    {!p.hidden ? (
                                      <button onClick={() => modAction(p.id, "hide")} className="text-yellow-400/70 hover:text-yellow-400 inline-flex items-center gap-1">
                                        <EyeOff className="h-3 w-3" /> Hide
                                      </button>
                                    ) : (
                                      <button onClick={() => modAction(p.id, "unhide")} className="text-yellow-400/70 hover:text-yellow-400 inline-flex items-center gap-1">
                                        Unhide
                                      </button>
                                    )}
                                    <button onClick={() => modAction(p.id, "delete")} className="text-red-400/70 hover:text-red-400 inline-flex items-center gap-1">
                                      <Trash2 className="h-3 w-3" /> Delete
                                    </button>
                                  </>
                                )}
                                {p.isMine && (
                                  <button onClick={() => removePost(p.id)} className="text-gray-600 hover:text-red-400 inline-flex items-center gap-1">
                                    <Trash2 className="h-3 w-3" /> Delete
                                  </button>
                                )}
                              </div>

                              {(openComments[p.id] || p.comments.length > 0) && (
                                <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                                  {p.comments.map((c) => (
                                    <div key={c.id} className="flex items-start gap-2">
                                      <Avatar name={c.authorName} url={c.authorAvatar} className="h-6 w-6 text-[10px]" />
                                      <div className="flex-1 min-w-0 bg-white/5 rounded-lg px-2.5 py-1.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-white text-xs font-semibold">{c.authorName}</span>
                                          <span className={`h-1.5 w-1.5 rounded-full ${BELT_DOT[c.authorBelt] || BELT_DOT.white}`} />
                                          <span className="text-gray-600 text-[10px]">{new Date(c.createdAt).toLocaleDateString()}</span>
                                          {c.isMine && (
                                            <button onClick={() => deleteComment(p.id, c.id)} className="text-gray-600 hover:text-red-400 ml-auto">
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          )}
                                        </div>
                                        <p className="text-gray-300 text-xs mt-0.5 whitespace-pre-wrap">{c.body}</p>
                                      </div>
                                    </div>
                                  ))}

                                  <div className="flex items-center gap-2">
                                    <input
                                      value={commentDrafts[p.id] || ""}
                                      onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                          e.preventDefault();
                                          submitComment(p.id);
                                        }
                                      }}
                                      placeholder="Write a comment..."
                                      maxLength={500}
                                      className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#dc2626]"
                                    />
                                    <button
                                      onClick={() => submitComment(p.id)}
                                      disabled={!commentDrafts[p.id]?.trim()}
                                      className="bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                                    >
                                      Send
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Leaderboard (this month) */}
                {myStatus === "active" && leaderboard.length > 0 && (
                  <div className="bg-[#0a0a0a] border border-yellow-500/20 rounded-xl p-5 mb-4">
                    <h3 className="text-xs text-yellow-400 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                      <Trophy className="h-3.5 w-3.5" /> Leaderboard . This Month
                    </h3>
                    <div className="space-y-2">
                      {leaderboard.map((entry, i) => (
                        <div key={entry.studentId} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            i === 0 ? "bg-yellow-400 text-black"
                            : i === 1 ? "bg-gray-300 text-black"
                            : i === 2 ? "bg-amber-700 text-white"
                            : "bg-white/10 text-gray-400"
                          }`}>
                            {i + 1}
                          </div>
                          <Avatar name={entry.name} url={entry.avatarUrl} className="h-7 w-7 text-[10px]" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-semibold truncate">{entry.name}</p>
                            <p className="text-gray-500 text-[10px] capitalize">{entry.belt} belt</p>
                          </div>
                          <span className="text-yellow-400 text-xs font-bold">{entry.sessions}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Members */}
                {myStatus === "active" && (
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5">
                    <h3 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">
                      Members ({activeMembers.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeMembers.map((m) => (
                        <div key={m.studentId} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                          <Avatar name={m.name} url={m.avatarUrl} className="h-8 w-8 text-xs" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-semibold flex items-center gap-1.5 truncate">
                              {m.name}
                              {m.role === "mod" && (
                                <span title="Moderator" className="inline-flex">
                                  <Shield className="h-3 w-3 text-yellow-400 shrink-0" />
                                </span>
                              )}
                            </p>
                            <p className="text-gray-500 text-[10px] capitalize">{m.belt} belt · {m.sessionCount} sessions</p>
                          </div>
                          {isMod && m.role !== "mod" && (
                            <button
                              onClick={() => promoteOrDemote(m.studentId, "promote")}
                              className="text-[10px] text-yellow-400 hover:text-yellow-300 font-bold uppercase tracking-wider px-2 py-1 rounded bg-yellow-400/10 hover:bg-yellow-400/20"
                            >
                              + Mod
                            </button>
                          )}
                          {isMod && m.role === "mod" && (
                            <button
                              onClick={() => promoteOrDemote(m.studentId, "demote")}
                              className="text-[10px] text-gray-500 hover:text-gray-300 font-bold uppercase tracking-wider px-2 py-1 rounded hover:bg-white/5"
                              title="Demote to member"
                            >
                              − Mod
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
