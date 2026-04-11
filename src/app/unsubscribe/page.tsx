export default function UnsubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080808] px-4">
      <div className="text-center max-w-md">
        <div style={{ marginBottom: "24px" }}>
          <div
            className="flex items-center justify-center mx-auto"
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "rgba(196,181,160,0.1)",
            }}
          >
            <span style={{ fontSize: "28px" }}>&#10003;</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white" style={{ marginBottom: "8px" }}>
          You have been unsubscribed
        </h1>
        <p className="text-gray-400" style={{ marginBottom: "24px", lineHeight: "1.6" }}>
          You will no longer receive marketing emails from MatFlow. If this was a mistake, reach out to us anytime.
        </p>
        <a
          href="https://mymatflow.com"
          className="text-sm text-gray-500 hover:text-white transition"
        >
          mymatflow.com
        </a>
      </div>
    </div>
  );
}
