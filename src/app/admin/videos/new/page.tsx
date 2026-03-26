
import Link from "next/link";
import VideoForm from "../VideoForm";

export default function AdminNewVideoPage() {
  return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/videos"
            className="text-gray-400 hover:text-white transition text-sm"
          >
            &larr; Back to Videos
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white mb-6">Add Video</h1>
        <VideoForm />
      </div>
  );
}
