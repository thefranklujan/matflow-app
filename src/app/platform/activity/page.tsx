import ActivityFeedClient from "@/app/app/activity/ActivityFeedClient";

export const dynamic = "force-dynamic";

export default function PlatformActivityPage() {
  return <ActivityFeedClient apiUrl="/api/platform/activity" showGym />;
}
