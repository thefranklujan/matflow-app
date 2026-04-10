"use client";

import { useState, useEffect, use, useCallback } from "react";
import { Delete } from "lucide-react";

interface GymInfo {
  name: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  phone: string | null;
  website: string | null;
}

export default function KioskPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [gym, setGym] = useState<GymInfo | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "already" | "error">("idle");
  const [message, setMessage] = useState("");
  const [memberInfo, setMemberInfo] = useState<{ name: string; belt: string; stripes: number } | null>(null);

  useEffect(() => {
    fetch(`/api/kiosk/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.gym) setGym(data.gym);
      });
  }, [slug]);

  const handleSubmit = useCallback(async (pinCode: string) => {
    if (!pinCode || pinCode.length < 4) return;
    setStatus("loading");
    try {
      const res = await fetch(`/api/kiosk/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: pinCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Invalid code");
        setTimeout(() => { setStatus("idle"); setCode(""); setMessage(""); }, 3000);
        return;
      }

      setMemberInfo(data.member);
      if (data.alreadyCheckedIn) {
        setStatus("already");
        setMessage("Already checked in today");
      } else {
        setStatus("success");
        setMessage("Training day logged");
      }

      setTimeout(() => {
        setStatus("idle");
        setCode("");
        setMemberInfo(null);
        setMessage("");
      }, 4000);
    } catch {
      setStatus("error");
      setMessage("Something went wrong");
      setTimeout(() => { setStatus("idle"); setCode(""); setMessage(""); }, 3000);
    }
  }, [slug]);

  function handleKey(key: string) {
    if (status !== "idle") return;
    if (key === "backspace") {
      setCode(prev => prev.slice(0, -1));
      return;
    }
    if (key === "clear") {
      setCode("");
      return;
    }
    if (code.length >= 6) return;
    const newCode = code + key;
    setCode(newCode);
    if (newCode.length >= 4) {
      handleSubmit(newCode);
    }
  }

  const primaryColor = gym?.primaryColor || "#c4b5a0";

  // Belt color mapping
  const beltColors: Record<string, string> = {
    white: "#ffffff",
    blue: "#1e40af",
    purple: "#7c3aed",
    brown: "#92400e",
    black: "#1a1a1a",
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  if (!gym) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808]">
        <div className="h-8 w-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#080808] select-none" style={{ touchAction: "manipulation" }}>
      {/* Header with gym branding */}
      <div className="flex items-center justify-between" style={{ padding: "24px 32px", borderBottom: `1px solid ${primaryColor}20` }}>
        <div className="flex items-center gap-4">
          {gym.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gym.logo} alt={gym.name} style={{ height: "48px", width: "auto", objectFit: "contain" }} />
          ) : (
            <div
              className="flex items-center justify-center font-bold text-lg"
              style={{
                height: "48px",
                width: "48px",
                borderRadius: "12px",
                backgroundColor: `${primaryColor}15`,
                color: primaryColor,
              }}
            >
              {gym.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{gym.name}</h1>
            <p className="text-sm text-gray-500">{dateStr}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-600 uppercase tracking-wider">Check In</p>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center" style={{ padding: "32px" }}>

        {/* Success / Already / Error States */}
        {(status === "success" || status === "already") && memberInfo ? (
          <div className="text-center animate-in fade-in" style={{ maxWidth: "400px" }}>
            <div
              className="flex items-center justify-center mx-auto"
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                backgroundColor: status === "success" ? `${primaryColor}15` : "rgba(234,179,8,0.1)",
                marginBottom: "24px",
              }}
            >
              <span style={{ fontSize: "40px", color: status === "success" ? primaryColor : "#eab308" }}>
                {status === "success" ? "\u2713" : "\u2713"}
              </span>
            </div>
            <h2 className="text-3xl font-bold text-white" style={{ marginBottom: "8px" }}>{memberInfo.name}</h2>
            <div className="flex items-center justify-center gap-3" style={{ marginBottom: "16px" }}>
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "4px",
                    backgroundColor: beltColors[memberInfo.belt] || "#666",
                    border: memberInfo.belt === "white" ? "1px solid #555" : "none",
                  }}
                />
                <span className="text-lg text-gray-300 capitalize">{memberInfo.belt} Belt</span>
              </div>
              {memberInfo.stripes > 0 && (
                <span className="text-lg text-gray-500">
                  {memberInfo.stripes} stripe{memberInfo.stripes > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p
              className="text-lg font-medium"
              style={{ color: status === "success" ? primaryColor : "#eab308" }}
            >
              {message}
            </p>
          </div>
        ) : status === "error" ? (
          <div className="text-center" style={{ maxWidth: "400px" }}>
            <div
              className="flex items-center justify-center mx-auto"
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                backgroundColor: "rgba(239,68,68,0.1)",
                marginBottom: "24px",
              }}
            >
              <span style={{ fontSize: "40px", color: "#ef4444" }}>{"\u2717"}</span>
            </div>
            <p className="text-xl text-red-400 font-medium">{message}</p>
          </div>
        ) : (
          /* Keypad */
          <div style={{ width: "100%", maxWidth: "360px" }}>
            {/* Code display */}
            <div className="text-center" style={{ marginBottom: "40px" }}>
              <p className="text-sm text-gray-500 uppercase tracking-widest font-medium" style={{ marginBottom: "16px" }}>
                Enter your check-in code
              </p>
              <div className="flex items-center justify-center gap-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: code.length > i ? primaryColor : "transparent",
                      border: `2px solid ${code.length > i ? primaryColor : "#333"}`,
                      transition: "all 150ms ease",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Number pad */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
              }}
            >
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"].map((key) => (
                <button
                  key={key}
                  onClick={() => handleKey(key)}
                  disabled={status === "loading"}
                  className="transition-all active:scale-95"
                  style={{
                    height: "72px",
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    backgroundColor: key === "clear" || key === "backspace" ? "#1a1a1a" : "#141414",
                    color: key === "clear" ? "#ef4444" : key === "backspace" ? "#999" : "#fff",
                    fontSize: key === "clear" ? "14px" : key === "backspace" ? "14px" : "28px",
                    fontWeight: key === "clear" || key === "backspace" ? "500" : "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    letterSpacing: key === "clear" ? "0.05em" : "0",
                    textTransform: key === "clear" ? "uppercase" : "none",
                  }}
                >
                  {key === "backspace" ? <Delete className="h-6 w-6" /> : key === "clear" ? "CLR" : key}
                </button>
              ))}
            </div>

            {status === "loading" && (
              <div className="flex items-center justify-center" style={{ marginTop: "24px" }}>
                <div
                  className="animate-spin"
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    border: `2px solid ${primaryColor}30`,
                    borderTopColor: primaryColor,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center" style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-xs text-gray-700">Powered by MatFlow</p>
      </div>
    </div>
  );
}
